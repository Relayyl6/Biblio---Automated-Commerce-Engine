import { jidNormalizedUser, type WAMessage, type WASocket } from "@whiskeysockets/baileys";
import { redis } from "@ace/shared/clients";
import { enqueueInboundMessage } from "../../comms-router/src/debounce.js";
import type { InboundMessage } from "@ace/shared/types";
import type { VendorConfig } from "./sessionManager.js";
import { parseVendorSubmission, flushVendorBuffer } from "./inventoryParser.js";
import { resolveMessageContent } from "./mediaProcessor.js";

function extractRawText(msg: WAMessage): string {
  const m = msg.message;
  if (!m) return "";
  return (
    m.conversation ||
    m.extendedTextMessage?.text ||
    m.imageMessage?.caption ||
    m.videoMessage?.caption ||
    m.documentMessage?.caption ||
    ""
  ).trim();
}

function stripBusinessPrefix(msg: WAMessage): void {
  const m = msg.message;
  if (!m) return;
  const clean = (t?: string | null) => {
    if (!t) return t;
    return t.replace(/^business(?:\s+status)?[:\s]*/i, "").trim();
  };
  if (m.conversation) m.conversation = clean(m.conversation) || "";
  if (m.extendedTextMessage?.text) m.extendedTextMessage.text = clean(m.extendedTextMessage.text) || "";
  if (m.imageMessage?.caption) m.imageMessage.caption = clean(m.imageMessage.caption) || "";
  if (m.videoMessage?.caption) m.videoMessage.caption = clean(m.videoMessage.caption) || "";
  if (m.documentMessage?.caption) m.documentMessage.caption = clean(m.documentMessage.caption) || "";
}

// ─── Classify and route ───────────────────────────────────────────────────────

export async function classifyAndRoute(
  msg: WAMessage,
  vendor: VendorConfig,
  sock: WASocket
): Promise<void> {
  const rawText = extractRawText(msg);
  const isFromMe = !!msg.key.fromMe;
  const isEndBusiness = /^(end-business|end\s+business|exit-business|exit\s+business)$/i.test(rawText);
  const isStartBusinessStatusOnly = /^(business\s+status)$/i.test(rawText);
  const isStartBusinessOnly = /^(business|start-business|start\s+business)$/i.test(rawText);
  const hasBusinessPrefix = /^business[:\s]+/i.test(rawText);
  const selfJid = msg.key.remoteJid || (vendor.business_line_number ? `${vendor.business_line_number}@s.whatsapp.net` : null);

  // ── Note-to-Self / "Message Yourself" Stateful Business Mode ────────────────
  if (isFromMe) {
    // 1. Explicitly end business session
    if (isEndBusiness) {
      // Flush any pending debounced items immediately so nothing is lost
      await flushVendorBuffer(vendor, sock).catch(() => {});
      await redis.del(`vendor:${vendor.id}:business_mode`);
      if (selfJid) {
        await sock.sendMessage(selfJid, {
          text: "⏸️ *Business Mode DEACTIVATED*\n\nYour notes here are now regular personal messages again. You can message yourself freely without worry. Send *business* anytime to start managing your store.",
        });
      }
      return;
    }

    // 2. Standalone start business command (Status Mode)
    if (isStartBusinessStatusOnly) {
      await redis.setex(`vendor:${vendor.id}:business_mode`, 86400, "status");
      if (selfJid) {
        await sock.sendMessage(selfJid, {
          text: "💼✨ *Business Status Mode ACTIVATED!* 🚀\n\nAll photos, prices, and voice notes you send here will be saved to your catalog *AND automatically posted to your WhatsApp Status*.\n\nType *end-business* anytime when you are done.",
        });
      }
      return;
    }

    // 3. Standalone start business command (Regular Mode)
    if (isStartBusinessOnly) {
      await redis.setex(`vendor:${vendor.id}:business_mode`, 86400, "1");
      if (selfJid) {
        await sock.sendMessage(selfJid, {
          text: "💼 *Business Mode ACTIVATED!* 🚀\n\nAll photos, captions, prices, and voice notes you send here will now be parsed into your catalog.\n\nEverything sent within 10 seconds will be grouped into a single product.\n\nType *end-business* anytime when you are done to switch back to personal notes.",
        });
      }
      return;
    }

    // 4. Check if business mode is active or started with prefix
    let isBusinessModeActive = await redis.get(`vendor:${vendor.id}:business_mode`);
    if (isBusinessModeActive || hasBusinessPrefix) {
      if (hasBusinessPrefix) {
        const isStatusPrefix = /^business\s+status[:\s]+/i.test(rawText);
        // Auto-activate business mode for subsequent messages, but don't downgrade from "status" to "1"
        const modeToSet = (isBusinessModeActive === "status" || isStatusPrefix) ? "status" : "1";
        await redis.setex(`vendor:${vendor.id}:business_mode`, 86400, modeToSet);
        stripBusinessPrefix(msg);
        if (isStatusPrefix) isBusinessModeActive = "status";
      }
      
      // If we are in "status" mode, inject " post now" into the message so inventoryParser posts it automatically
      if (isBusinessModeActive === "status") {
        const m = msg.message;
        if (m) {
          if (m.conversation) m.conversation += " post now";
          else if (m.extendedTextMessage?.text) m.extendedTextMessage.text += " post now";
          else if (m.imageMessage?.caption) m.imageMessage.caption += " post now";
          else if (m.videoMessage?.caption) m.videoMessage.caption += " post now";
          // If none of these, it's just media/audio, but the instruction string " post now" will be picked up
          // when parsed later as long as we inject it somewhere. If it's pure audio, we can't easily inject, 
          // but if they send a price it will have text.
        }
      }

      console.log(`[MessageClassifier] Routing Note-to-Self message to 10s debounced inventory buffer (Business Mode active: ${isBusinessModeActive})`);
      await parseVendorSubmission(msg, vendor, sock);
      return;
    }

    // Personal message without business mode — ignore completely
    return;
  }

  const senderJid = resolveSenderJid(msg);
  console.log(`[MessageClassifier] Received message from JID: ${senderJid}, fromMe: ${isFromMe}`);
  if (!senderJid) {
    console.log(`[MessageClassifier] NULL JID MESSAGE:`, JSON.stringify(msg, null, 2));
    return; // Cannot determine sender — skip
  }

  // Ignore group messages and status broadcasts entirely
  const rawJid = msg.key.remoteJid || "";
  if (rawJid.endsWith("@g.us") || rawJid === "status@broadcast") {
    console.log(`[MessageClassifier] Ignoring group/status message from ${rawJid}`);
    return;
  }

  const senderPhone = jidToPhone(senderJid);
  const vendorPersonalPhone = normalisePhone(vendor.personal_number || "");
  const vendorBusinessPhone = normalisePhone(vendor.business_line_number || "");

  // If sender matches personal number (or business line itself)
  const isFromVendor = (senderPhone === vendorPersonalPhone || senderPhone === vendorBusinessPhone) && !isFromMe;

  if (isFromVendor) {
    // ── Vendor product submission path ─────────────────────────────────────
    if (hasBusinessPrefix) {
      stripBusinessPrefix(msg);
    }
    await parseVendorSubmission(msg, vendor, sock);
  } else {
    // ── Customer query path ────────────────────────────────────────────────
    await routeToNegotiator(msg, vendor, sock);
  }
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
  const windowExpiresAt = timestamp + 24 * 60 * 60 * 1000;
  await redis
    .set(windowKey, String(windowExpiresAt), "EX", 60 * 60 * 25)
    .catch(() => {});

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
 * "2348012345678:1@s.whatsapp.net" → "2348012345678"
 */
function jidToPhone(jid: string): string {
  return jidNormalizedUser(jid).split("@")[0];
}

/**
 * Normalise a phone number to bare digits for comparison.
 * Handles: "+2348012345678", "2348012345678", "+234 801 234 5678"
 */
function normalisePhone(phone: string): string {
  return phone.replace(/^\+/, "").replace(/[\s\-()]/g, "");
}
