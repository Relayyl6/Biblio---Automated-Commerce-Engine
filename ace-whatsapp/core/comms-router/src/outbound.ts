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
//      (vendor business line model), messages go through that socket instead
//      of the Graph API. Baileys sends are always free (no per-message cost,
//      no 24h session window constraint). The same classifyWindow() path
//      still runs for telemetry/logging purposes.
//
// The actual template registry (pre-approved WhatsApp templates) is a Phase-2
// gap; until it exists we still send via the session API when the window is
// closed, but we log the billable classification so the cost-monitoring work
// has real data to build on.

import { redis } from "@ace/shared/clients";
import type { OutboundMessage } from "@ace/shared/types";
import { sendWhatsAppMessage } from "./whatsapp";
import {
  canSendViaBaileys,
  sendViaBaileys,
} from "../../baileys-gateway/src/outboundAdapter.js";

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
 * logs the classification (for cost monitoring), and delegates to the correct
 * sender — either the vendor's Baileys session (always free) or the Meta
 * Graph API (subject to the 24h session window cost model).
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

  // ── Baileys fast path ────────────────────────────────────────────────────
  // If this merchant has an active Baileys session, use it.
  // Baileys sends are always free (no per-message Meta cost, no 24h window).
  if (merchantId && canSendViaBaileys(merchantId)) {
    await sendViaBaileys(msg, merchantId);
    return "free_session";
  }

  // ── Meta Graph API path ──────────────────────────────────────────────────
  const raw = await redis.get(windowKey(toPhone));
  const expiresAt = raw ? Number(raw) : null;
  const sendClass = classifyWindow(expiresAt, Date.now());

  if (sendClass === "billable_business_initiated") {
    // Flaw 1: this send is outside the free window and will cost money. Once a
    // template registry exists this is where we'd swap to a pre-approved
    // template; for now we log so per-merchant cost can be tracked.
    console.info(
      `[outbound] billable send to ${toPhone} (service window closed) — ` +
        `candidate for template fallback`,
    );
  }

  await sendWhatsAppMessage(msg, phoneNumberId ?? "", merchantId ?? "");
  return sendClass;
}