// core/comms-router/src/vendorCommunique.ts
//
// Role: The single channel for delivering escalations to the merchant.
// Implements the Vendor Communiqué SMS reply-code system described in BIBLO.docx.
//
// When the AI Negotiator hits a circuit breaker (e.g. customer pushes below the
// authorized floor), it calls `escalateToHuman`. This service formats that
// escalation into a WhatsApp message and sends it to the merchant's actual phone.
//
// ── BAILEYS INTEGRATION (Phase 2) ──────────────────────────────────────────────
// If the merchant has a Baileys session active, we send the escalation directly
// via the vendor's business-line socket (free, instant, no 24h window needed).
// If no Baileys session exists, we fall back to the Graph API sender.
//
// The REPLY intercept path is also updated: if a merchant replies "1", "2", or "3"
// on the Baileys session, the messageClassifier routes the message here ONLY if
// the vendor's personal_number matches AND there is an active communiqué session
// in Redis. The numeric-code session is still stored in Redis regardless of channel.

import { redis, sql } from "@ace/shared/clients";
import { sendWhatsAppMessage } from "./whatsapp.js";
import { dataIntelligence } from "@ace/shared/data-intelligence/engine";
import type { ConversationTurn } from "@ace/shared/types";
import type { NegotiationArc } from "../../ai-negotiator/src/negotiationArc.js";

// Lazy-import the Baileys adapter so this file doesn't hard-depend on the
// baileys-gateway package at startup (the gateway is an optional service).
async function getBaileysAdapter() {
  try {
    return await import("../../baileys-gateway/src/outboundAdapter.js");
  } catch {
    return null;
  }
}

export interface EscalationContext {
  turn: ConversationTurn;
  arc: NegotiationArc;
}

export class VendorCommuniqueEngine {

  /**
   * Dispatches an escalation to the merchant's phone.
   *
   * Priority:
   *   1. Baileys session for the vendor → send via the business-line socket (free)
   *   2. Graph API fallback → `sendWhatsAppMessage` (billable if window closed)
   */
  public async dispatchEscalation(
    merchantId: string,
    merchantPhone: string,
    customerId: string,
    reason: string,
    context: EscalationContext
  ): Promise<void> {
    const { arc } = context;

    const customerOffer = arc.customerLastOffer
      ? `₦${arc.customerLastOffer.toLocaleString()}`
      : "an unknown price";
    const floorPrice = arc.floor > 0 ? `₦${arc.floor.toLocaleString()}` : "unknown";

    const text =
      `*ACE ESCALATION* ⚠️\n` +
      `Customer ${customerId} wants *${arc.productSku}* at ${customerOffer}.\n` +
      `Your authorized floor is ${floorPrice}.\n\n` +
      `Reply with a number:\n` +
      `*1* — Approve exception (sell at customer's price)\n` +
      `*2* — Hold firm at your floor\n` +
      `*3* — Offer a bundle pivot`;

    // ── Try Baileys first ───────────────────────────────────────────────────
    let sentViaBaileys = false;
    const adapter = await getBaileysAdapter();

    if (adapter) {
      // Look up the vendor record for this merchant — the vendorId is the
      // session key in the Baileys gateway's session registry.
      const vendorRows = await sql<{ id: string }[]>`
        SELECT id FROM vendors
        WHERE merchant_id = ${merchantId}
          AND session_status = 'connected'
        LIMIT 1
      `.catch(() => []);

      const vendorId = vendorRows[0]?.id;

      if (vendorId && adapter.canSendViaBaileys(vendorId)) {
        try {
          await adapter.sendViaBaileys(
            { toPhone: merchantPhone, text },
            vendorId
          );
          sentViaBaileys = true;
        } catch (err) {
          console.warn(
            `[VendorCommunique] Baileys send failed for merchant ${merchantId}, falling back to Graph API:`,
            err
          );
        }
      }
    }

    // ── Graph API fallback ──────────────────────────────────────────────────
    if (!sentViaBaileys) {
      await sendWhatsAppMessage(
        { toPhone: merchantPhone, text },
        "default_phone_id",
        merchantId
      );
    }

    // ── Store the active decision session in Redis ───────────────────────────
    // TTL: 4 hours — merchant has 4 hours to reply before the session expires.
    const sessionKey = `communique:${merchantId}:active`;
    await redis.setex(
      sessionKey,
      60 * 60 * 4,
      JSON.stringify({
        customerId,
        arcSessionId: arc.sessionId,
        pendingReason: reason,
        channel: sentViaBaileys ? "baileys" : "graph_api",
      })
    );

    await dataIntelligence.auditLog({
      service: "vendor-communique",
      merchantId,
      action: "escalation_dispatched",
      metadata: {
        customerId,
        reason,
        channel: sentViaBaileys ? "baileys" : "graph_api",
      },
    });
  }

  /**
   * Processes an inbound reply from the merchant.
   * If an active communiqué session exists in Redis, intercepts numeric codes.
   *
   * Returns true if the message was a valid reply code and consumed.
   * Returns false if there's no active session (message goes to normal flow).
   */
  public async handleMerchantReply(
    merchantId: string,
    replyText: string
  ): Promise<boolean> {
    const sessionKey = `communique:${merchantId}:active`;
    const sessionRaw = await redis.get(sessionKey);

    if (!sessionRaw) {
      return false; // No active communiqué — not a reply we own
    }

    const session = JSON.parse(sessionRaw);
    const code = replyText.trim();

    let decision = "unknown";
    if (code === "1") decision = "approve_exception";
    if (code === "2") decision = "hold_firm";
    if (code === "3") decision = "offer_bundle";

    if (decision === "unknown") {
      return false; // Not a valid code — pass to normal message flow
    }

    // Persist decision (vendor_decisions table)
    await sql`
      INSERT INTO vendor_decisions (merchant_id, decision_type, channel, choice)
      VALUES (
        ${merchantId},
        'escalation_reply',
        ${session.channel ?? "unknown"},
        ${decision}
      )
    `;

    await redis.del(sessionKey);

    // TODO (Phase 2): Resume the AI negotiator loop with new constraints.
    // The arc sessionId is in session.arcSessionId — look up the BullMQ job
    // and re-enqueue with the merchant's decision as context.
    console.log(
      `[VendorCommunique] Merchant ${merchantId} resolved escalation ` +
        `for ${session.customerId} with: ${decision}`
    );

    await dataIntelligence.auditLog({
      service: "vendor-communique",
      merchantId,
      action: "escalation_resolved",
      metadata: { customerId: session.customerId, decision },
    });

    return true;
  }
}

export const vendorCommunique = new VendorCommuniqueEngine();
