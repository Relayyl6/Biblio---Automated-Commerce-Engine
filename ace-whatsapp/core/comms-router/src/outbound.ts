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
// The actual template registry (pre-approved WhatsApp templates) is a Phase-2
// gap; until it exists we still send via the session API when the window is
// closed, but we log the billable classification so the cost-monitoring work
// has real data to build on.

import { redis } from "@ace/shared/clients";
import type { OutboundMessage } from "@ace/shared/types";
import { sendWhatsAppMessage } from "./whatsapp";

/** How a send is billed by Meta. */
export type SendClass = "free_session" | "billable_business_initiated";

function windowKey(phone: string) {
  return `conv:${phone}:window`;
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
 * The one outbound entry point. Reads the service window, classifies the send,
 * logs the classification (for cost monitoring), and delegates to the Graph API
 * sender. Returns the classification so callers/metrics can act on it.
 */
export async function sendCustomerMessage(
  msg: OutboundMessage,
  phoneNumberId: string,
): Promise<SendClass> {
  const raw = await redis.get(windowKey(msg.toPhone));
  const expiresAt = raw ? Number(raw) : null;
  const sendClass = classifyWindow(expiresAt, Date.now());

  if (sendClass === "billable_business_initiated") {
    // Flaw 1: this send is outside the free window and will cost money. Once a
    // template registry exists this is where we'd swap to a pre-approved
    // template; for now we log so per-merchant cost can be tracked.
    console.info(
      `[outbound] billable send to ${msg.toPhone} (service window closed) — ` +
        `candidate for template fallback`,
    );
  }

  await sendWhatsAppMessage(msg, phoneNumberId);
  return sendClass;
}