import crypto from "crypto";
import { logger } from "@ace/shared/logger.js";
import { jidNormalizedUser, type WAMessage, type WASocket } from "@whiskeysockets/baileys";
import { redis, sql } from "@ace/shared/clients";
import { enqueueInboundMessage } from "../../comms-router/src/debounce.js";
import type { InboundMessage } from "@ace/shared/types";
import type { VendorConfig } from "./sessionManager.js";
import { parseVendorSubmission, flushVendorBuffer, isVendorBuffering } from "./inventoryParser.js";
import { resolveMessageContent, unwrapWAMessage } from "./mediaProcessor.js";
import { isSourceCommand, handleSourceCommand } from "./sourceCommandHandler.js";

function extractRawText(msg: WAMessage): string {
  const m = unwrapWAMessage(msg.message);
  if (!m) return "";
  return (
    m.conversation ||
    m.extendedTextMessage?.text ||
    m.imageMessage?.caption ||
    m.videoMessage?.caption ||
    m.documentMessage?.caption ||
    m.buttonsResponseMessage?.selectedDisplayText ||
    m.buttonsResponseMessage?.selectedButtonId ||
    m.templateButtonReplyMessage?.selectedDisplayText ||
    m.templateButtonReplyMessage?.selectedId ||
    m.listResponseMessage?.title ||
    m.listResponseMessage?.singleSelectReply?.selectedRowId ||
    m.interactiveResponseMessage?.body?.text ||
    m.interactiveResponseMessage?.nativeFlowResponseMessage?.name ||
    (m.locationMessage ? (m.locationMessage.name || m.locationMessage.address || "Location Pin") : "") ||
    (m.contactMessage ? (m.contactMessage.displayName || "Contact Card") : "") ||
    ""
  ).trim();
}

// ─── Classify and route ───────────────────────────────────────────────────────

export async function classifyAndRoute(
  msg: WAMessage,
  vendor: VendorConfig,
  sock: WASocket
): Promise<void> {
  const rawText = extractRawText(msg);
  const isFromMe = !!msg.key.fromMe;
  const selfJid = msg.key.remoteJid || (vendor.business_line_number ? `${vendor.business_line_number}@s.whatsapp.net` : null);

  const vendorPersonalPhone = normalisePhone(vendor.personal_number || "");
  const vendorBusinessPhone = normalisePhone(vendor.business_line_number || "");

  const inner = unwrapWAMessage(msg.message);
  const hasImage = !!inner?.imageMessage;
  const hasAudio = !!inner?.audioMessage;
  const isStatusCommand = /^status\s+(on|off)$/i.test(rawText.trim());
  const isInventoryPostInstruction = /\bpost(?:\s+(?:this|it))?\s+(?:now|in\s+\d+|to\s+[+\d])/i.test(rawText);
  // Check if vendor already has an active inventory debounce window collecting photos/audio
  const isBuffering = isVendorBuffering(vendor.id);
  const isInventorySubmission = hasImage || hasAudio || isStatusCommand || isInventoryPostInstruction || isBuffering;

  if (isFromMe) {
    const receiverJid = msg.key.remoteJid;
    const receiverPhone = receiverJid ? jidToPhone(receiverJid) : "";
    const isSelfNote = isPhoneMatch(receiverPhone, vendorBusinessPhone) || receiverJid === selfJid;

    if (isSelfNote) {
      // Merchant's Note-to-Self ("Message yourself") is explicitly excluded from the agent loop.
      // The merchant's personal notes remain private. The merchant interacts with the autonomous
      // Biblio Agent directly through the Biblio WhatsApp Agent contact.
      return;
    }

    // Human operator (vendor) replied via their linked WhatsApp device to a customer!
    // We must pause the AI and log the message.
    if (receiverJid && !receiverJid.endsWith('@g.us') && receiverJid !== 'status@broadcast' && !isSelfNote) {
      const customerId = jidToPhone(receiverJid);
      const merchantId = vendor.merchant_id;
      const content = extractRawText(msg);
      
      sql`
        INSERT INTO conversation_messages (merchant_id, customer_id, source, content)
        VALUES (${merchantId}, ${customerId}, 'human_operator', ${content})
      `.catch(e => logger.error("Log failed", e));
      
      const arcKey = `arc:${merchantId}:${customerId}`;
      redis.get(arcKey).then(rawArc => {
        if (rawArc) {
          let arc = JSON.parse(rawArc);
          if (arc.stage !== 'paused') {
            arc.stage = 'paused';
            redis.setex(arcKey, 60 * 60 * 24, JSON.stringify(arc));
            logger.log(`[MessageClassifier] Paused AI for customer ${customerId} due to manual vendor reply.`);
          }
        }
      }).catch(e => logger.error("Arc pause failed", e));
    }
    return;
  }

  const senderJid = resolveSenderJid(msg);
  logger.log(`[MessageClassifier] Received message from JID: ${senderJid}, fromMe: ${isFromMe}`);
  if (!senderJid) {
    logger.log(`[MessageClassifier] NULL JID MESSAGE:`, JSON.stringify(msg, null, 2));
    return; // Cannot determine sender — skip
  }

  // Ignore group messages and status broadcasts entirely
  const rawJid = msg.key.remoteJid || "";
  if (rawJid.endsWith("@g.us") || rawJid === "status@broadcast") {
    logger.log(`[MessageClassifier] Ignoring group/status message from ${rawJid}`);
    return;
  }

  const senderPhone = jidToPhone(senderJid);

  // If sender matches personal number or business line
  const isFromVendor = (isPhoneMatch(senderPhone, vendorPersonalPhone) || isPhoneMatch(senderPhone, vendorBusinessPhone)) && !isFromMe;

  if (isFromVendor) {
    if (isInventorySubmission) {
      // ── Vendor Inventory Ingestion ─────────────────────────────────────────
      // Media or catalog push: parse with Whisper / Groq Vision / CLIP and upsert
      logger.info("[MessageClassifier] Routing vendor media to parseVendorSubmission", { vendorId: vendor.id, senderPhone });
      await parseVendorSubmission(msg, vendor, sock);
    } else {
      // ── Biblio Agent Command Center ────────────────────────────────────────
      // If the vendor's personal number messages conversational text, they chat
      // with the Biblio Agent to manage the store and escalations.
      await routeToBiblioAgent(msg, vendor, sock);
    }
  } else {
    // ── Customer query path ────────────────────────────────────────────────
    await routeToNegotiator(msg, vendor, sock);
  }
}

// ─── Biblio Agent ─────────────────────────────────────────────────────────────

async function routeToBiblioAgent(
  msg: WAMessage,
  vendor: VendorConfig,
  sock: WASocket
): Promise<void> {
  const senderJid = resolveSenderJid(msg);
  if (!senderJid) return;

  const fromPhone = jidToPhone(senderJid);
  const timestamp = (Number(msg.messageTimestamp) * 1000) || Date.now();

  const content = await resolveMessageContent(msg, sock);
  if (!content) return;

  const inbound: InboundMessage = {
    waMessageId: msg.key.id!,
    fromPhone,
    toPhoneNumberId: vendor.merchant_id, // The business number
    timestamp,
    content,
    isMerchantCommand: true, // Custom flag or just rely on a new queue/function
  };

  // We need to enqueue this to a dedicated biblio-agent queue, 
  // or we can reuse `enqueueInboundMessage` but handle it differently in the router.
  // Actually, we can import `enqueueBiblioAgentMessage` from debounce!
  const { enqueueBiblioAgentMessage } = await import("../../comms-router/src/debounce.js");
  await enqueueBiblioAgentMessage(inbound);
}

// ─── Customer → Negotiator ────────────────────────────────────────────────────

async function routeToNegotiator(
  msg: WAMessage,
  vendor: VendorConfig,
  sock: WASocket
): Promise<void> {
  const senderJid = resolveSenderJid(msg);
  if (!senderJid) return;

  const fromPhone = jidToPhone(senderJid);
  const timestamp = (Number(msg.messageTimestamp) * 1000) || Date.now();

  // resolveMessageContent downloads media, transcribes audio via Groq Whisper,
  // encodes images as base64 for Claude Vision, and reads reply-thread context.
  // Returns null for message types we should silently ignore (stickers, reactions, etc.)
  const content = await resolveMessageContent(msg, sock);
  if (!content) return;

  const inbound: InboundMessage = {
    waMessageId: msg.key.id!,
    fromPhone,
    // The comms-router and negotiator use this merchant_id for DB constraints and catalog
    toPhoneNumberId: vendor.merchant_id,
    timestamp,
    content,
  };

  // Refresh the 24h service window key for compatibility with outbound.ts
  // cost-classification logic. In Baileys mode all messages are free, but
  // keeping this key means the classifyWindow() function still works correctly.
  const windowKey = `conv:${fromPhone}:window`;
  const merchantWindowKey = `conv:${vendor.merchant_id}:${fromPhone}:window`;
  const windowExpiresAt = timestamp + 24 * 60 * 60 * 1000;
  await Promise.all([
    redis.set(windowKey, String(windowExpiresAt), "EX", 60 * 60 * 25),
    redis.set(merchantWindowKey, String(windowExpiresAt), "EX", 60 * 60 * 25),
  ]).catch(err => logger.error("[MessageClassifier] Non-critical audit log failed", err));

  
  // Log customer message to Expo Hub DB
  sql`
    INSERT INTO conversation_messages (merchant_id, customer_id, source, content)
    VALUES (${vendor.merchant_id}, ${fromPhone}, 'customer', ${extractRawText(msg) || '[Media]'})
  `.catch(e => logger.error("Log failed", e));

  await enqueueInboundMessage(inbound);

}


// ─── JID helpers ─────────────────────────────────────────────────────────────

/**
 * Resolve the effective sender JID from a WAMessage, handling v7.0.0 LIDs and senderPn.
 * For DMs: remoteJid is the sender.
 * If remoteJid is a LID, extract senderPn, participantPn, or remoteJidAlt.
 */
function resolveSenderJid(msg: WAMessage): string | null {
  const key = msg.key as Record<string, unknown>;
  const jid = msg.key.remoteJid;
  if (!jid) return null;

  // LID check: @lid suffix means it's an anonymous/privacy identifier
  if (jid.endsWith("@lid")) {
    // 1. Check senderPn on key (e.g. "2348142462789@s.whatsapp.net")
    if (typeof key.senderPn === "string" && !key.senderPn.endsWith("@lid")) {
      return key.senderPn;
    }
    // 2. Check participantPn on key
    if (typeof key.participantPn === "string" && !key.participantPn.endsWith("@lid")) {
      return key.participantPn;
    }
    // 3. remoteJidAlt is the phone number JID equivalent (v7.0.0 feature)
    const alt = key.remoteJidAlt as string | undefined;
    if (alt && !alt.endsWith("@lid")) return alt;

    // 4. Check participant if present and not a LID
    if (msg.key.participant && !msg.key.participant.endsWith("@lid")) {
      return msg.key.participant;
    }

    // 5. Fallback to the LID JID itself rather than dropping the message
    return jid;
  }

  // If group or broadcast, sender is participant or participantPn
  if (jid.endsWith("@g.us") || jid === "status@broadcast") {
    if (typeof key.participantPn === "string" && !key.participantPn.endsWith("@lid")) {
      return key.participantPn;
    }
    if (msg.key.participant && !msg.key.participant.endsWith("@lid")) {
      return msg.key.participant;
    }
    return msg.key.participant || null;
  }

  return jid;
}

/**
 * Strip the JID suffix (@s.whatsapp.net, @g.us, etc.) to get bare phone number.
 * Preserves @lid if the identifier is an anonymous privacy LID.
 * "2348012345678:1@s.whatsapp.net" → "2348012345678"
 * "123456789@lid" → "123456789@lid"
 */
function jidToPhone(jid: string): string {
  const normalized = jidNormalizedUser(jid);
  if (normalized.endsWith("@lid")) {
    return normalized;
  }
  return normalized.split("@")[0];
}

/**
 * Normalise a phone number to bare digits for comparison.
 * Handles: "+2348012345678", "2348012345678", "+234 801 234 5678"
 */
function normalisePhone(phone: string): string {
  return phone.replace(/^\+/, "").replace(/[\s\-()]/g, "");
}

/**
 * Robust phone match that handles national prefixes (0801..., 234801..., +234...)
 * and anonymous privacy LIDs.
 */
function isPhoneMatch(phoneA: string, phoneB: string): boolean {
  if (!phoneA || !phoneB) return false;
  if (phoneA.endsWith("@lid") || phoneB.endsWith("@lid")) {
    return phoneA === phoneB;
  }
  const a = phoneA.replace(/\D/g, "");
  const b = phoneB.replace(/\D/g, "");
  if (a === b) return true;
  const aTail = a.startsWith("234") ? a.slice(3) : a.startsWith("0") ? a.slice(1) : a;
  const bTail = b.startsWith("234") ? b.slice(3) : b.startsWith("0") ? b.slice(1) : b;
  return aTail.length >= 7 && aTail === bTail;
}
