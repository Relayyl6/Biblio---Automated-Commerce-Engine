import { logger } from "@ace/shared/logger.js";
// core/comms-router/src/sourceReplyHandler.ts

import { sql, redis, jsonb } from "@ace/shared/clients";
import type { InboundMessage, PricingExpression } from "@ace/shared/types";
import { extractPriceFromText, evaluatePricingRules } from "@ace/shared/pricingEngine";
import { advanceArc, type NegotiationArc, ArcTransitionError } from "../../ai-negotiator/src/negotiationArc.js";
import { runNegotiatorTurn } from "../../ai-negotiator/src/agentLoop.js";
import { sendCustomerMessage } from "./outbound.js";
import { vendorCommunique } from "./vendorCommunique.js";

interface SourceRow {
  id: string;
  name: string;
  pricing_rules: PricingExpression[];
}

export async function handleSourceReply(msg: InboundMessage, source: SourceRow): Promise<boolean> {
  // Find a pending quote for this source + merchant
  const pendingQuotes = await sql<{id: string, customer_id: string, product_query: string}[]>`
    SELECT id, customer_id, product_query 
    FROM source_quotes 
    WHERE source_id = ${source.id} 
      AND merchant_id = ${msg.toPhoneNumberId!}
      AND status = 'pending'
    ORDER BY sent_at DESC
    LIMIT 1
  `;

  if (pendingQuotes.length === 0) {
    // If it's a warehouse API or similar, this shouldn't happen. If it's WhatsApp, they might just be chatting.
    // We return false so it gets ignored or routed elsewhere (though it shouldn't go to debounce either).
    return true; // Return true to swallow the message so the source doesn't get treated as a customer
  }

  const quote = pendingQuotes[0];
  const replyText = msg.content.type === "text" ? msg.content.text : "";
  
  const extractedCost = extractPriceFromText(replyText);
  if (extractedCost === null) {
    // If they replied but we couldn't find a price, we might ask them again or escalate.
    // For MVP, we escalate to the merchant to clarify.
    await sql`
      UPDATE source_quotes SET status = 'escalated', reply_received = ${replyText}, replied_at = NOW() 
      WHERE id = ${quote.id}
    `;
    
    // Fallback to merchant
    const merchantRows = await sql<{contact_phone: string}[]>`select contact_phone from merchants where id = ${msg.toPhoneNumberId!} limit 1`;
    const merchantPhone = merchantRows[0]?.contact_phone;
    if (merchantPhone) {
      await sendCustomerMessage({ toPhone: merchantPhone, text: `Supplier ${source.name} replied to query for ${quote.product_query}, but I couldn't understand the price. Reply: "${replyText}"` }, undefined, msg.toPhoneNumberId!);
    }
    return true;
  }

  // Load merchant defaults
  const defaultsRows = await sql<{pricing_rules: PricingExpression[]}[]>`
    SELECT pricing_rules FROM merchant_pricing_defaults WHERE merchant_id = ${msg.toPhoneNumberId!}
  `;
  const defaultRules = defaultsRows[0]?.pricing_rules ?? [];

  const rules = source.pricing_rules.length > 0 ? source.pricing_rules : defaultRules;
  const result = evaluatePricingRules(rules, extractedCost);

  let customerPrice = 0;
  let markup = 0;

  if (result.action === "ask_merchant") {
    // We update the quote to escalated
    await sql`
      UPDATE source_quotes SET status = 'escalated', reply_received = ${replyText}, extracted_cost = ${extractedCost}, replied_at = NOW() 
      WHERE id = ${quote.id}
    `;
    const merchantRows = await sql<{contact_phone: string}[]>`select contact_phone from merchants where id = ${msg.toPhoneNumberId!} limit 1`;
    const merchantPhone = merchantRows[0]?.contact_phone;
    if (merchantPhone) {
      await sendCustomerMessage({ toPhone: merchantPhone, text: `Supplier ${source.name} quoted ₦${extractedCost.toLocaleString()} for ${quote.product_query}. Your pricing rules say to ask you. What price should we quote the customer?` }, undefined, msg.toPhoneNumberId!);
    }
    return true;
  }

  customerPrice = result.customerPrice;
  markup = result.markup;

  // Update quote
  await sql`
    UPDATE source_quotes SET 
      status = 'replied', 
      reply_received = ${replyText}, 
      extracted_cost = ${extractedCost}, 
      markup_applied = ${markup}, 
      customer_price = ${customerPrice}, 
      replied_at = NOW() 
    WHERE id = ${quote.id}
  `;

  // Resume the Arc
  const arcKey = `arc:${msg.toPhoneNumberId!}:${quote.customer_id}`;
  const rawArc = await redis.get(arcKey);
  
  if (rawArc) {
    let arc = JSON.parse(rawArc) as NegotiationArc;
    if (arc.stage === "awaiting_source") {
      try {
        arc = advanceArc(arc, { type: "SOURCE_REPLIED", customerPrice, sourceName: source.name });
        await redis.setex(arcKey, 60 * 60 * 24, JSON.stringify(arc));
        
        // We now need to trigger the agent loop so it resumes the conversation!
        // We can just construct a ConversationTurn with a system prompt message injected.
        // But runNegotiatorTurn pulls orderState from DB, which is fine.
        // To pass the system context without it being a real message:
        
        const orderRows = await sql<{state: any}[]>`
          SELECT state FROM orders WHERE customer_id = ${quote.customer_id} AND merchant_id = ${msg.toPhoneNumberId!} ORDER BY updated_at DESC LIMIT 1
        `;
        const orderState = orderRows[0]?.state ?? { status: "no_order" };
        
        // Trigger agent loop
        await runNegotiatorTurn({
          customerId: quote.customer_id,
          merchantId: msg.toPhoneNumberId!,
          orderState,
          messages: [{
            waMessageId: `sys_${Date.now()}`,
            fromPhone: quote.customer_id,
            toPhoneNumberId: msg.toPhoneNumberId!,
            timestamp: Date.now(),
            content: {
              type: "text",
              text: `[SYSTEM: Supplier ${source.name} replied with a wholesale price. After markup, you should quote the customer ₦${customerPrice.toLocaleString("en-NG")}. Make the offer now.]`
            }
          }]
        });
      } catch (err) {
        logger.error(`[sourceReply] Failed to advance arc for customer ${quote.customer_id}:`, err);
      }
    }
  }

  return true;
}
