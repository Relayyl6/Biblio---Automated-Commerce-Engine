import { logger } from "@ace/shared/logger.js";
// core/comms-router/src/outbound.ts
//
// BIBLO Flaw 1 (the WhatsApp API Margin Death Spiral): every business-initiated
// message costs money; every message inside the customer's 24h service window
// is free. This module is the single chokepoint every customer-bound message
// passes through so the two Flaw-1 levers live in one place:
//
//   1. SERVICE-WINDOW CLASSIFICATION — ingestion-service stamps
//      `conv:{phone}:window` = expiry-ms on every inbound message. We read it
//      here to decide whether this send is free (session) or billable
//      (template/business-initiated), and surface that so cost can be tracked
//      against BIBLO's <$2.50/merchant/month target.
//
//   2. MESSAGE CONSOLIDATION — BIBLO target is 2.3 messages per completed
//      order (vs 5-7 industry). `consolidate()` merges what would have been
//      several short sends into one structured message before it ever hits the
//      Graph API.
//
//   3. BAILEYS ADAPTER PATH — if the merchant has an active Baileys session
//      (vendor business line model), messages go through the gateway's HTTP
//      /send endpoint instead of the Graph API. The gateway process holds the
//      live socket in its own memory; we can only reach it via HTTP since these
//      are separate Node.js processes.
//
// The actual template registry (pre-approved WhatsApp templates) is a Phase-2
// gap; until it exists we still send via the session API when the window is
// closed, but we log the billable classification so the cost-monitoring work
// has real data to build on.

import { redis } from "@ace/shared/clients";
import type { OutboundMessage } from "@ace/shared/types";
import { sendWhatsAppMessage } from "./whatsapp";

/** How a send is billed by Meta. */
export type SendClass = "free_session" | "billable_business_initiated";

const GATEWAY_URL = process.env.BAILEYS_GATEWAY_URL ?? "http://localhost:3005";

function windowKey(merchantId: string, phone: string) {
  return `conv:${merchantId}:${phone}:window`;
}

/**
 * Pure classifier: given the window expiry (epoch ms, or null if none) and the
 * current time, is a send free or billable? Separated out so it is trivially
 * testable without Redis.
 */
export function classifyWindow(expiresAtMs: number | null, nowMs: number): SendClass {
  if (expiresAtMs !== null && expiresAtMs > nowMs) return "free_session";
  return "billable_business_initiated";
}

/**
 * Merge multiple message fragments into ONE structured message. Empty/blank
 * fragments are dropped. This is the outbound complement to the inbound
 * debounce — it stops the agent loop from emitting three sends when one will do.
 */
export function consolidate(parts: Array<string | undefined | null>): string {
  return parts
    .map((p) => (p ?? "").trim())
    .filter((p) => p.length > 0)
    .join("\n\n");
}

/**
 * Try to send via the Baileys gateway's HTTP /send endpoint.
 * Returns true if sent successfully, false if no session is active.
 */
async function tryBaileysHttpSend(msg: OutboundMessage, merchantId: string): Promise<boolean> {
  try {
    const res = await fetch(`${GATEWAY_URL}/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...msg, merchantId }),
    });
    if (res.status === 503) {
      // Gateway says no active session for this merchant — fall through to Graph API
      return false;
    }
    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as Record<string, unknown>;
      throw new Error(`Gateway /send returned ${res.status}: ${body.error ?? "unknown error"}`);
    }
    return true;
  } catch (err: any) {
    // If the gateway is down entirely, fall through to Graph API rather than silently dropping
    if (
      err.code === "ECONNREFUSED" || 
      (err.cause && err.cause.code === "ECONNREFUSED") ||
      (err.cause && err.cause instanceof AggregateError && err.cause.errors.some((e: any) => e.code === "ECONNREFUSED"))
    ) {
      logger.warn("[outbound] Baileys gateway unreachable — falling back to Graph API");
      return false;
    }
    throw err;
  }
}

/**
 * The one outbound entry point. Reads the service window, classifies the send,
 * logs the classification (for cost monitoring), and delegates to the correct
 * sender — either the vendor's Baileys session (always free, via HTTP) or the
 * Meta Graph API (subject to the 24h session window cost model).
 *
 * Returns the SendClass so callers/metrics can track cost attribution.
 */
export async function sendCustomerMessage(
  msg: OutboundMessage,
  phoneNumberId?: string,
  merchantId?: string,
): Promise<SendClass> {
  // toPhone is optional on OutboundMessage (Phase-2 multi-channel); the
  // service-window key is keyed by the customer's phone, so resolve it here.
  const toPhone = msg.toPhone ?? msg.toSenderId;
  if (!toPhone) {
    throw new Error("OutboundMessage has no recipient (toPhone/toSenderId)");
  }

  // ── Baileys fast path (HTTP to gateway process) ───────────────────────────
  // The gateway holds live Baileys sockets in its own process memory.
  // We reach them via HTTP — never via direct function import.
  if (merchantId) {
    const sent = await tryBaileysHttpSend(msg, merchantId);
    if (sent) return "free_session";
  }

  // ── Meta Graph API path ──────────────────────────────────────────────────
  const raw = await redis.get(windowKey(merchantId ?? "", toPhone));
  const expiresAt = raw ? Number(raw) : null;
  const sendClass = classifyWindow(expiresAt, Date.now());

  if (sendClass === "billable_business_initiated") {
    console.info(
      `[outbound] billable send to ${toPhone} (service window closed) — ` +
        `candidate for template fallback`,
    );
  }

  try {
    await sendWhatsAppMessage(msg, phoneNumberId ?? "", merchantId ?? "");
  } catch (err: any) {
    logger.error(`[outbound] Failed to send WhatsApp message to ${toPhone}:`, err.message);
  }
  return sendClass;
}

/**
 * Triggers a "composing" (typing) indicator on WhatsApp via Baileys.
 */
export async function setTypingIndicator(
  toPhone: string,
  merchantId: string,
  presence: "composing" | "paused" = "composing"
): Promise<void> {
  const toJid = toPhone.includes("@") ? toPhone : `${toPhone}@s.whatsapp.net`;
  try {
    const res = await fetch(`${GATEWAY_URL}/presence`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ merchantId, toJid, presence }),
    });
    if (!res.ok) {
      logger.warn(`[outbound] failed to set typing indicator: ${res.status}`);
    }
  } catch (err) {
    logger.warn("[outbound] error setting typing indicator:", err);
  }
}