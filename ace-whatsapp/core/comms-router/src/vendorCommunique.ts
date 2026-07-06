// core/comms-router/src/vendorCommunique.ts
//
// Role: The single channel for delivering escalations to the merchant.
// Implements the Vendor Communiqué SMS reply-code system described in BIBLO.docx.
// 
// When the AI Negotiator hits a circuit breaker (e.g. customer pushes below the
// authorized floor), it calls `escalateToHuman`. This service formats that 
// escalation into an SMS or WhatsApp message and sends it to the merchant's 
// actual phone, setting up a Redis session to intercept their numeric reply.

import { redis, sql } from '@ace/shared/clients';
import { sendWhatsAppMessage } from './whatsapp.js'; // Fallback to WA for now
import { dataIntelligence } from '@ace/shared/data-intelligence/engine';
import type { ConversationTurn, OrderState } from '@ace/shared/types';
import type { NegotiationArc } from '../../ai-negotiator/src/negotiationArc.js';

export interface EscalationContext {
  turn: ConversationTurn;
  arc: NegotiationArc;
}

export class VendorCommuniqueEngine {
  
  /**
   * Dispatches an escalation to the merchant's phone.
   */
  public async dispatchEscalation(
    merchantId: string, 
    merchantPhone: string, 
    customerId: string, 
    reason: string, 
    context: EscalationContext
  ): Promise<void> {
    const { arc } = context;

    // Formatting the digest for the merchant
    // Example: "Customer Amaka wants the dress at ₦12K. Your floor is ₦14,250. 
    // Reply 1 to approve special exception, 2 to hold firm, 3 to offer bundle."
    const customerOffer = arc.customerLastOffer ? `₦${arc.customerLastOffer.toLocaleString()}` : "an unknown price";
    const floorPrice = arc.floor > 0 ? `₦${arc.floor.toLocaleString()}` : "unknown";

    const text = `ACE ESCALATION:\nCustomer ${customerId} wants ${arc.productSku} at ${customerOffer}.\nYour floor is ${floorPrice}.\n\nReply:\n1 = Approve exception\n2 = Hold firm at floor\n3 = Offer bundle pivot`;

    // Send the message to the merchant (using WA graph sender as SMS stub)
    // In production, this would route through Africa's Talking or Twilio SMS if offline.
    await sendWhatsAppMessage({ toPhone: merchantPhone, text }, "default_phone_id");

    // Create the active decision session in Redis
    const sessionKey = `communique:${merchantId}:active`;
    await redis.setex(sessionKey, 60 * 60 * 4, JSON.stringify({
      customerId,
      arcSessionId: arc.sessionId,
      pendingReason: reason
    }));

    await dataIntelligence.auditLog({
      service: 'vendor-communique',
      merchantId,
      action: 'escalation_dispatched',
      metadata: { customerId, reason }
    });
  }

  /**
   * Processes an inbound reply from the merchant.
   * If an active session exists, it intercepts numeric codes.
   */
  public async handleMerchantReply(merchantId: string, replyText: string): Promise<boolean> {
    const sessionKey = `communique:${merchantId}:active`;
    const sessionRaw = await redis.get(sessionKey);

    if (!sessionRaw) {
      return false; // Not an active communiqué reply
    }

    const session = JSON.parse(sessionRaw);
    const code = replyText.trim();

    let decision = 'unknown';
    if (code === '1') decision = 'approve_exception';
    if (code === '2') decision = 'hold_firm';
    if (code === '3') decision = 'offer_bundle';

    if (decision === 'unknown') {
      return false; // Not a valid code
    }

    // Persist decision
    await sql`
      INSERT INTO vendor_decisions (merchant_id, decision_type, channel, choice)
      VALUES (${merchantId}, 'escalation_reply', 'sms', ${decision})
    `;

    // Clear session
    await redis.del(sessionKey);

    // TODO: Resume the AI negotiator loop with the new constraints
    console.log(`[VendorCommunique] Merchant ${merchantId} resolved escalation for ${session.customerId} with choice: ${decision}`);

    return true;
  }
}

export const vendorCommunique = new VendorCommuniqueEngine();
