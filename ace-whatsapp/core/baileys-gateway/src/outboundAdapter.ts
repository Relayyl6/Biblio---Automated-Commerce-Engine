// core/baileys-gateway/src/outboundAdapter.ts
//
// Outbound send adapter using Baileys WhatsApp sockets.
//
// KEY RELIABILITY & ANTI-SPAM PROTECTIONS:
// 1. RATE LIMITING & PACING:
//    - Enforces a minimum 1000ms inter-message gap per session.
//    - Sliding window rate limit (max 25 messages per minute per session)
//      to prevent WhatsApp anti-spam bans (403 forbidden).
//    - Simulates human typing indicator before sending text messages.
// 2. RETRY STORM PREVENTION (Message ID Caching):
//    - Every sent message is cached in Redis keyed by its WAMessage ID (`msg_cache:<id>`)
//      using BufferJSON.replacer. This ensures when a customer device sends a retry
//      receipt, Baileys getMessage() can resolve and re-encrypt the original message.
// 3. MULTI-FORMAT MEDIA SUPPORT:
//    - Dispatches images, PDF/Word documents, and audio voice notes cleanly.

import { jidNormalizedUser, BufferJSON, type WASocket } from "@whiskeysockets/baileys";
import P from "pino";
import { redis } from "@ace/shared/clients.js";
import { getSession } from "./sessionManager.js";
import type { OutboundMessage } from "@ace/shared/types";

const logger = P({ level: "info" });

// ─── Anti-Spam Rate Limiter & Pacer ──────────────────────────────────────────
interface RateLimitState {
  lastSendTime: number;
  timestamps: number[];
}

const sessionRateLimits = new Map<string, RateLimitState>();
const MIN_INTER_MESSAGE_MS = 1000;
const MAX_MESSAGES_PER_WINDOW = 25;
const WINDOW_MS = 60_000;

export function resetSessionRateLimit(merchantId: string): void {
  sessionRateLimits.delete(merchantId);
}

async function paceOutboundSend(merchantId: string, recipientJid: string, textLength: number, sock: WASocket): Promise<void> {
  let state = sessionRateLimits.get(merchantId);
  const now = Date.now();
  if (!state) {
    state = { lastSendTime: 0, timestamps: [] };
    sessionRateLimits.set(merchantId, state);
  }

  // Prune timestamps older than 60s
  state.timestamps = state.timestamps.filter(t => now - t < WINDOW_MS);

  if (state.timestamps.length >= MAX_MESSAGES_PER_WINDOW) {
    const oldest = state.timestamps[0];
    const waitTime = WINDOW_MS - (now - oldest) + 500;
    logger.warn({ merchantId, waitTime }, "[OutboundAdapter] Rate limit approaching. Pacing send.");
    await new Promise(r => setTimeout(r, Math.min(waitTime, 10_000)));
  }

  // Enforce inter-message gap
  const elapsed = Date.now() - state.lastSendTime;
  if (elapsed < MIN_INTER_MESSAGE_MS) {
    await new Promise(r => setTimeout(r, MIN_INTER_MESSAGE_MS - elapsed));
  }

  // Natural typing simulation: show typing indicator briefly
  if (textLength > 0) {
    try {
      await sock.sendPresenceUpdate("composing", recipientJid);
      // Realistic brief typing delay: 200ms + ~5ms per character, capped at 1000ms
      const typingDelay = Math.min(200 + Math.floor(textLength * 5), 1000);
      await new Promise(r => setTimeout(r, typingDelay));
    } catch {}
  }

  state.lastSendTime = Date.now();
  state.timestamps.push(Date.now());
}

// ─── Public interface ─────────────────────────────────────────────────────────

/**
 * Returns true if this merchant has an active Baileys session that can
 * be used to send messages.
 */
export function canSendViaBaileys(merchantId: string): boolean {
  return getSession(merchantId) !== undefined;
}

/**
 * Send an outbound message to a customer via the vendor's Baileys session.
 * Supports text, images, documents, audio, and interactive buttons with rate limiting
 * and retry caching.
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

  const recipientJid = toJid(toPhone);
  const textContent = (msg.text ?? "").trim();

  // Pace send & simulate presence to avoid spam flags
  await paceOutboundSend(merchantId, recipientJid, textContent.length, sock);

  try {
    let sentMsg: any = null;

    if (msg.mediaUrl) {
      const lowerUrl = msg.mediaUrl.toLowerCase();

      if (lowerUrl.endsWith(".pdf") || lowerUrl.endsWith(".docx") || lowerUrl.endsWith(".doc")) {
        // Document message
        const fileName = lowerUrl.split("/").pop()?.split("?")[0] || "document.pdf";
        const mimeType = lowerUrl.endsWith(".pdf") ? "application/pdf" : "application/octet-stream";
        sentMsg = await sock.sendMessage(recipientJid, {
          document: { url: msg.mediaUrl },
          fileName,
          mimetype: mimeType,
          caption: textContent || undefined,
        });
      } else if (lowerUrl.endsWith(".ogg") || lowerUrl.endsWith(".opus") || lowerUrl.endsWith(".mp3") || lowerUrl.endsWith(".m4a")) {
        // Audio message
        sentMsg = await sock.sendMessage(recipientJid, {
          audio: { url: msg.mediaUrl },
          mimetype: lowerUrl.endsWith(".mp3") ? "audio/mpeg" : "audio/ogg; codecs=opus",
          ptt: false,
        });
      } else {
        // Image message with optional caption
        sentMsg = await sock.sendMessage(recipientJid, {
          image: { url: msg.mediaUrl },
          caption: textContent || undefined,
        });
      }
    } else if (msg.buttons && msg.buttons.length > 0) {
      // Format buttons clearly
      const buttonList = msg.buttons
        .slice(0, 3)
        .map((b: { label: string }, i: number) => `[${i + 1}] ${b.label}`)
        .join("\n");
      const fullText = textContent ? `${textContent}\n\n${buttonList}` : buttonList;
      sentMsg = await sock.sendMessage(recipientJid, { text: fullText });
    } else {
      // Plain text message
      sentMsg = await sock.sendMessage(recipientJid, { text: textContent });
    }

    // Clear typing presence after sending
    sock.sendPresenceUpdate("paused", recipientJid).catch(() => {});

    // Cache sent message in Redis for Baileys getMessage() retry handling
    if (sentMsg?.key?.id && sentMsg?.message) {
      await redis
        .setex(`msg_cache:${sentMsg.key.id}`, 3600, JSON.stringify(sentMsg.message, BufferJSON.replacer))
        .catch(err => logger.warn({ err }, "[OutboundAdapter] Failed to cache sent message in Redis"));
    }

    logger.debug(
      { merchantId, to: toPhone, msgId: sentMsg?.key?.id, hasMedia: !!msg.mediaUrl },
      "Message sent via Baileys and cached for retry resilience"
    );
  } catch (err) {
    logger.error({ err, merchantId, to: toPhone }, "Baileys send failed");
    throw err;
  }
}

/**
 * Send a typing indicator to the customer.
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
  } catch {}
}

/**
 * Mark a customer's message as read.
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
  } catch {}
}

// ─── JID helper ───────────────────────────────────────────────────────────────

function toJid(phone: string): string {
  if (phone.endsWith("@lid") || phone.endsWith("@g.us")) {
    return phone;
  }
  const normalized = phone.includes("@") ? jidNormalizedUser(phone) : phone;
  let bare = normalized.split("@")[0].replace(/\D/g, "");
  if (bare.startsWith("0") && bare.length === 11) {
    bare = `234${bare.slice(1)}`;
  }
  return `${bare}@s.whatsapp.net`;
}
