import { logger } from "@ace/shared/logger.js";
import { sql, redis } from "@ace/shared/clients";
import type { InboundMessage, PricingExpression } from "@ace/shared/types";
import { extractPriceFromText, evaluatePricingRules } from "@ace/shared/pricingEngine";
import { advanceArc, type NegotiationArc } from "../../ai-negotiator/src/negotiationArc.js";
import { runNegotiatorTurn } from "../../ai-negotiator/src/agentLoop.js";
import { sendCustomerMessage } from "./outbound.js";

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
  `.catch(() => []);

  if (pendingQuotes.length === 0) {
    return true; // Return true to swallow the message so the source doesn't get treated as a customer
  }

  const quote = pendingQuotes[0];
  const replyText = msg.content.type === "text" ? msg.content.text : "";
  
  const extractedCost = extractPriceFromText(replyText);
  if (extractedCost === null) {
    // If they replied but we couldn't find a price, escalate to merchant
    await sql`
      UPDATE source_quotes SET status = 'escalated', reply_received = ${replyText}, replied_at = NOW() 
      WHERE id = ${quote.id}
    `.catch(() => {});
    
    // Fallback to merchant
    const merchantRows = await sql<{contact_phone: string}[]>`select contact_phone from merchants where id = ${msg.toPhoneNumberId!}::uuid limit 1`.catch(() => []);
    const merchantPhone = merchantRows[0]?.contact_phone;
    if (merchantPhone) {
      await sendCustomerMessage({ toPhone: merchantPhone, text: `Supplier ${source.name} replied to query for ${quote.product_query}, but I couldn't understand the price. Reply: "${replyText}"` }, undefined, msg.toPhoneNumberId!);
    }
    return true;
  }

  // Load merchant defaults
  const defaultsRows = await sql<{pricing_rules: PricingExpression[]}[]>`
    SELECT pricing_rules FROM merchant_pricing_defaults WHERE merchant_id = ${msg.toPhoneNumberId!}
  `.catch(() => []);
  const defaultRules = defaultsRows[0]?.pricing_rules ?? [];

  const rules = source.pricing_rules.length > 0 ? source.pricing_rules : defaultRules;
  const result = evaluatePricingRules(rules, extractedCost);

  let customerPrice = 0;
  let markup = 0;

  if (result.action === "ask_merchant") {
    await sql`
      UPDATE source_quotes SET status = 'escalated', reply_received = ${replyText}, extracted_cost = ${extractedCost}, replied_at = NOW() 
      WHERE id = ${quote.id}
    `.catch(() => {});
    const merchantRows = await sql<{contact_phone: string}[]>`select contact_phone from merchants where id = ${msg.toPhoneNumberId!}::uuid limit 1`.catch(() => []);
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
  `.catch(() => {});

  // Resume the Arc
  const arcKey = `arc:${msg.toPhoneNumberId!}:${quote.customer_id}`;
  const rawArc = await redis.get(arcKey);
  
  if (rawArc) {
    let arc = JSON.parse(rawArc) as NegotiationArc;
    if (arc.stage === "awaiting_source") {
      try {
        arc = advanceArc(arc, { type: "SOURCE_REPLIED", customerPrice, sourceName: source.name });
        await redis.setex(arcKey, 60 * 60 * 24, JSON.stringify(arc));
        
        const orderRows = await sql<{state: any}[]>`
          SELECT state FROM orders 
          WHERE (user_id = ${quote.customer_id}::uuid OR tenant_id = ${msg.toPhoneNumberId!}::uuid)
          ORDER BY updated_at DESC LIMIT 1
        `.catch(() => []);
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
