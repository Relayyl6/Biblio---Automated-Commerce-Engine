// core/baileys-gateway/src/messageClassifier.ts
//
// THE SINGLE MOST IMPORTANT ROUTING DECISION in the Baileys pipeline.
//
// Every inbound message on the business line is EITHER:
//   (A) From the vendor's own personal number → product submission
//   (B) From any customer → existing negotiator pipeline
//
// The heuristic is simple: compare the sender's bare phone number to the
// vendor's registered personal_number. If they match → product submission.
// Everything else is a customer query.
//
// v7.0.0 LID HANDLING:
// In group contexts and for some users, WhatsApp now sends a LID JID
// (@lid suffix) instead of a phone number JID (@s.whatsapp.net). For the
// business line scenario (1-on-1 DMs only), this is rare, but we handle it
// by falling back to remoteJidAlt when the primary JID is a LID.
//
// WHAT DOESN'T CHANGE DOWNSTREAM:
// The customer query path calls the exact same enqueueInboundMessage()
// that the Meta webhook ingestion-service calls. The negotiator, debounce
// queue, and agent loop are completely unaware of whether the message
// arrived via Meta or via Baileys.

import { jidNormalizedUser, type WAMessage, type WASocket } from "@whiskeysockets/baileys";
import { redis } from "@ace/shared/clients";
import { enqueueInboundMessage } from "../../comms-router/src/debounce.js";
import type { InboundMessage } from "@ace/shared/types";
import type { VendorConfig } from "./sessionManager.js";
import { parseVendorSubmission } from "./inventoryParser.js";

// ─── Classify and route ───────────────────────────────────────────────────────

export async function classifyAndRoute(
  msg: WAMessage,
  vendor: VendorConfig,
  sock: WASocket
): Promise<void> {
  const senderJid = resolveSenderJid(msg);
  if (!senderJid) return; // Cannot determine sender — skip

  const senderPhone = jidToPhone(senderJid);
  const vendorPersonalPhone = normalisePhone(vendor.personal_number);

  const isFromVendor = senderPhone === vendorPersonalPhone;

  if (isFromVendor) {
    // ── Vendor product submission path ─────────────────────────────────────
    await parseVendorSubmission(msg, vendor, sock);
  } else {
    // ── Customer query path ────────────────────────────────────────────────
    await routeToNegotiator(msg, vendor);
  }
}

// ─── Customer → Negotiator ────────────────────────────────────────────────────

async function routeToNegotiator(msg: WAMessage, vendor: VendorConfig): Promise<void> {
  const msgContent = msg.message;
  if (!msgContent) return;

  const senderJid = resolveSenderJid(msg);
  if (!senderJid) return;

  const fromPhone = jidToPhone(senderJid);
  const timestamp = (Number(msg.messageTimestamp) * 1000) || Date.now();

  const base = {
    waMessageId: msg.key.id!,
    fromPhone,
    // vendorId used as the "phone number ID" — the comms-router uses this to
    // resolve which merchant to talk to. Same role as Meta's phone_number_id.
    toPhoneNumberId: vendor.id,
    timestamp,
  };

  let inbound: InboundMessage | null = null;

  if (msgContent.conversation || msgContent.extendedTextMessage) {
    const text =
      msgContent.conversation || msgContent.extendedTextMessage?.text || "";
    if (!text.trim()) return; // Empty message — skip
    inbound = { ...base, content: { type: "text", text } };
  } else if (msgContent.audioMessage) {
    // Voice note — we pass the message ID as mediaId.
    // The intent parser can use downloadMediaMessage with the Baileys socket
    // if voice transcription is needed (Phase 2 — not wired yet).
    inbound = { ...base, content: { type: "audio", mediaId: msg.key.id! } };
  } else if (msgContent.imageMessage) {
    inbound = {
      ...base,
      content: {
        type: "image",
        mediaId: msg.key.id!,
        caption: msgContent.imageMessage.caption ?? undefined,
      },
    };
  } else if (msgContent.orderMessage) {
    // Native WhatsApp Business order — surface it as interactive payload
    // so the negotiator can handle it (Phase 2: dedicated order handler)
    inbound = {
      ...base,
      content: { type: "interactive", payload: msgContent.orderMessage },
    };
  }
  // All other message types (reactions, stickers, location, etc.) — skip.
  // Deliberately silent: an unrecognised type shouldn't break the pipeline.

  if (!inbound) return;

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
 * Resolve the effective sender JID from a WAMessage, handling v7.0.0 LIDs.
 * For DMs: remoteJid is the sender.
 * If remoteJid is a LID, fall back to remoteJidAlt (the PN equivalent).
 */
function resolveSenderJid(msg: WAMessage): string | null {
  const jid = msg.key.remoteJid;
  if (!jid) return null;

  // LID check: @lid suffix means it's an anonymous group identifier
  if (jid.endsWith("@lid")) {
    // remoteJidAlt is the phone number JID equivalent (v7.0.0 feature)
    const alt = (msg.key as Record<string, unknown>).remoteJidAlt as string | undefined;
    if (alt && !alt.endsWith("@lid")) return alt;
    // Cannot resolve to a phone — skip (shouldn't happen in 1:1 DM context)
    return null;
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
