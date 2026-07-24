import { jidNormalizedUser, type WAMessage, type WASocket } from "@whiskeysockets/baileys";
import { redis } from "@ace/shared/clients";
import { enqueueInboundMessage } from "../../comms-router/src/debounce.js";
import type { InboundMessage } from "@ace/shared/types";
import type { VendorConfig } from "./sessionManager.js";
import { parseVendorSubmission } from "./inventoryParser.js";
import { resolveMessageContent } from "./mediaProcessor.js";

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
    // vendorId used as the "phone number ID" — the comms-router uses this to
    // resolve which merchant to talk to. Same role as Meta's phone_number_id.
    toPhoneNumberId: vendor.id,
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
