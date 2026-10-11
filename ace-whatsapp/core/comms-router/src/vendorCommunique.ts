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
import { logger } from "@ace/shared/logger";
import type { ConversationTurn } from "@ace/shared/types";
import type { NegotiationArc } from "../../ai-negotiator/src/negotiationArc.js";

// Lazy-import the Baileys adapter so this file doesn't hard-depend on the
// baileys-gateway package at startup (the gateway is an optional service).
async function getBaileysAdapter() {
  if (process.env.USE_BAILEYS !== "true") return null;
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

    // ── Try Baileys first (Biblio Agent) ───────────────────────────────────────────────────
    let sentViaBaileys = false;
    const adapter = await getBaileysAdapter();

    if (adapter) {
      const vendorRows = await sql<{ id: string }[]>`
        SELECT id FROM vendors
        WHERE merchant_id = ${merchantId}
          AND session_status = 'connected'
        LIMIT 1
      `.catch((err) => { console.error('[VendorCommunique] DB error:', err); return []; });

      const vendorId = vendorRows[0]?.id;

      if (vendorId && adapter.canSendViaBaileys(vendorId)) {
        try {
          await adapter.sendViaBaileys(
            { toPhone: merchantPhone, text },
            vendorId
          );
          sentViaBaileys = true;
        } catch (err) {
          logger.warn(
            `[VendorCommunique] Baileys send failed for merchant ${merchantId}, falling back to SMS:`
          );
        }
      }
    }

    if (!sentViaBaileys) {
      // Send SMS immediately if Baileys is offline
      await this.sendSms(merchantId, merchantPhone, text);
    } else {
      // Schedule an SMS fallback job in 5 minutes
      const { Queue } = await import("bullmq");
      const smsQueue = new Queue("sms-fallback", {
        connection: { ...redis.options, maxRetriesPerRequest: null }
      });
      await smsQueue.add(
        "fallback-sms",
        { merchantId, merchantPhone, text },
        { delay: 5 * 60 * 1000 }
      );
    }

    // ── Store the active decision session in Redis ───────────────────────────
    // TTL: 4 hours — merchant has 4 hours to reply before the session expires.
    const sessionKey = `communique:${merchantId}:active`;
    try { await redis.setex(sessionKey, 60 * 60 * 4, JSON.stringify({
        customerId,
        arcSessionId: arc.sessionId,
        pendingReason: reason,
        channel: sentViaBaileys ? "baileys" : "sms",
      })); } catch (err) { console.error('[VendorCommunique] Redis setex error:', err); }

    await dataIntelligence.auditLog({
      service: "vendor-communique",
      merchantId,
      action: "escalation_dispatched",
      metadata: {
        customerId,
        reason,
        channel: sentViaBaileys ? "baileys" : "sms",
      },
    });
  }

  public async sendSms(merchantId: string, merchantPhone: string, text: string) {
    if (!process.env.AT_API_KEY) {
      logger.warn("[VendorCommunique] AT_API_KEY missing, skipping real SMS send.");
      return;
    }

    try {
      const africastalking = (await import("africastalking")).default;
      const at = africastalking({
        apiKey: process.env.AT_API_KEY,
        username: process.env.AT_USERNAME || "sandbox"
      });
      const sms = at.SMS;
      
      const formattedPhone = merchantPhone.startsWith("+") 
        ? merchantPhone 
        : `+${merchantPhone}`;
        
      await logger.log(`[VendorCommunique] Sending SMS to ${formattedPhone} via Africa's Talking Sandbox...`, { merchantId });
      
      const response = await sms.send({
        to: [formattedPhone],
        message: text
      });
      
      await logger.log(`[VendorCommunique] SMS sent successfully:`, { merchantId, response });
    } catch (err) {
      await logger.error(`[VendorCommunique] Africa's Talking SMS failed:`, { merchantId, err });
      throw new Error("Failed to deliver escalation to vendor via SMS.");
    }
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
    let sessionRaw: string | null = null;
    try { sessionRaw = await redis.get(sessionKey); } catch (err) { console.error('[VendorCommunique] Redis get error:', err); return false; }

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

    // Resume the AI negotiator loop with new constraints.
    // We inject a SYSTEM message acting as the customer, so the AI sees the decision.
    const { enqueueInboundMessage } = await import("./debounce.js");
    await enqueueInboundMessage({
      waMessageId: `sys_${Date.now()}`,
      fromPhone: session.customerId,
      toPhoneNumberId: merchantId,
      timestamp: Date.now(),
      content: {
        type: "text",
        text: `[SYSTEM: The merchant responded to your escalation. Decision: ${decision}. Use this to inform your next reply to the customer.]`
      }
    });

    logger.log(
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

import { Worker, type Job } from "bullmq";
export const smsFallbackWorker = new Worker<{ merchantId: string, merchantPhone: string, text: string }>(
  "sms-fallback",
  async (job: Job<{ merchantId: string, merchantPhone: string, text: string }>) => {
    const { merchantId, merchantPhone, text } = job.data;
    const sessionKey = `communique:${merchantId}:active`;
    const isActive = await redis.exists(sessionKey);
    
      if (isActive) {
      logger.log(`[VendorCommunique] WhatsApp timeout reached for ${merchantId}. Dispatching SMS fallback.`);
      await vendorCommunique.sendSms(merchantId, merchantPhone, text);
    } else {
      logger.log(`[VendorCommunique] Skipping SMS fallback for ${merchantId} — already resolved via WhatsApp.`);
    }
  },
  { connection: { ...redis.options, maxRetriesPerRequest: null } }
);
