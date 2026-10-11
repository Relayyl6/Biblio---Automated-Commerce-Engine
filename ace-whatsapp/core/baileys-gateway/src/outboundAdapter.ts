// core/baileys-gateway/src/outboundAdapter.ts
//
// WHAT THIS FILE DOES:
// Provides the Baileys-powered outbound send path. Replaces the Graph API
// call in comms-router/src/whatsapp.ts for vendors who have a Baileys session.
//
// DESIGN PRINCIPLE:
// The existing sendWhatsAppMessage() in whatsapp.ts calls Meta's Graph API.
// Rather than modifying that file heavily, we create this adapter which
// comms-router/src/outbound.ts checks FIRST. If a Baileys session exists
// for the merchant, we use it. Otherwise we fall through to the Graph API.
//
// BAILEYS vs GRAPH API DIFFERENCES:
// - No 24-hour session window: Baileys sends are always free-form
//   (no per-message cost, no template requirement after 24h)
// - JID format: Baileys needs "phone@s.whatsapp.net" not just "phone"
// - Media: Baileys accepts { url: string } or Buffer — we prefer URL
// - Interactive buttons: Baileys supports them but differently to Graph API
//   (for now we fall back to text for interactive messages)
//
// HOW comms-router/outbound.ts CALLS THIS:
// The modified outbound.ts checks baileysAdapter.canSend(merchantId) before
// deciding which outbound path to use.

import { jidNormalizedUser, type WASocket } from "@whiskeysockets/baileys";
import P from "pino";
import { getSession } from "./sessionManager.js";
import type { OutboundMessage } from "@ace/shared/types";

const logger = P({ level: "info" });

// ─── Public interface ─────────────────────────────────────────────────────────

/**
 * Returns true if this merchant has an active Baileys session that can
 * be used to send messages. Called by outbound.ts before deciding which path.
 */
export function canSendViaBaileys(merchantId: string): boolean {
  // merchantId maps 1-to-1 with vendorId for the vendor business line model.
  // In a future multi-vendor-per-merchant model, this lookup would need to
  // resolve via a vendor→merchant join.
  return getSession(merchantId) !== undefined;
}

/**
 * Send an outbound message to a customer via the vendor's Baileys session.
 * Supports text, image + caption, and interactive (degraded to text).
 */
export async function sendViaBaileys(
  msg: OutboundMessage,
  merchantId: string
): Promise<void> {
  const sock = getSession(merchantId);
  if (!sock) {
    throw new Error(
      `No active Baileys session for merchant ${merchantId} — cannot send`
    );
  }

  const toPhone = msg.toPhone ?? msg.toSenderId;
  if (!toPhone) {
    throw new Error("OutboundMessage has no recipient (toPhone/toSenderId)");
  }

  // Baileys requires the full JID format
  const recipientJid = toJid(toPhone);

  try {
    if (msg.mediaUrl) {
      // Image message with caption
      await sock.sendMessage(recipientJid, {
        image: { url: msg.mediaUrl },
        caption: msg.text,
      });
    } else if (msg.buttons && msg.buttons.length > 0) {
      // Interactive button messages — send as numbered text list for now.
      // Full Baileys button support can be added in Phase 2.
      const buttonText = msg.buttons
        .slice(0, 3) // Max 3 buttons on WhatsApp
        .map((b: { label: string }, i: number) => `${i + 1}. ${b.label}`)
        .join("\n");
      await sock.sendMessage(recipientJid, {
        text: `${msg.text ?? ""}\n\n${buttonText}`,
      });
    } else {
      // Plain text message
      await sock.sendMessage(recipientJid, { text: msg.text ?? "" });
    }

    logger.debug(
      { merchantId, to: toPhone, hasMedia: !!msg.mediaUrl },
      "Message sent via Baileys"
    );
  } catch (err) {
    logger.error({ err, merchantId, to: toPhone }, "Baileys send failed");
    throw err;
  }
}

/**
 * Send a typing indicator to the customer (optional — enhances UX).
 * Call before starting Claude processing, clear when done.
 */
export async function sendTypingIndicator(
  merchantId: string,
  customerPhone: string,
  isTyping: boolean
): Promise<void> {
  const sock = getSession(merchantId);
  if (!sock) return;

  try {
    await sock.sendPresenceUpdate(
      isTyping ? "composing" : "paused",
      toJid(customerPhone)
    );
  } catch {
    // Typing indicators are best-effort — never throw on failure
  }
}

/**
 * Mark a customer's message as read (shows blue ticks on their end).
 * Call after successfully processing a message turn.
 */
export async function markMessageAsRead(
  merchantId: string,
  msg: { id: string; remoteJid: string }
): Promise<void> {
  const sock = getSession(merchantId);
  if (!sock) return;

  try {
    await sock.readMessages([
      { id: msg.id, remoteJid: msg.remoteJid, fromMe: false },
    ]);
  } catch {
    // Best-effort
  }
}

// ─── JID helper ───────────────────────────────────────────────────────────────

function toJid(phone: string): string {
  if (phone.endsWith("@lid") || phone.endsWith("@g.us")) {
    return phone;
  }
  // Strip any existing suffix and re-apply the standard DM suffix
  // We use jidNormalizedUser to safely strip device suffixes (e.g. :1) if a full JID is passed
  const normalized = phone.includes("@") ? jidNormalizedUser(phone) : phone;
  const bare = normalized.split("@")[0].replace(/^\+/, "");
  return `${bare}@s.whatsapp.net`;
}
