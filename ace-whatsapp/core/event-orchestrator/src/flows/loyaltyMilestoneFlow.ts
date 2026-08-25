import { logger } from "@ace/shared/logger.js";
import { redis, sql } from "@ace/shared/clients.js";
import { Queue } from "bullmq";

export async function setupLoyaltyMilestoneFlow() {
  const sub = redis.duplicate();
  await sub.subscribe("events:order_completed");

  sub.on("message", async (channel, message) => {
    if (channel === "events:order_completed") {
      try {
        const payload = JSON.parse(message);
        await handleLoyaltyCheck(payload.merchantId, payload.customerId);
      } catch (err) {
        logger.error("[LoyaltyMilestone] Error processing event:", err);
      }
    }
  });

  logger.log("[LoyaltyMilestone] Listening for order_completed events...");
}

async function handleLoyaltyCheck(merchantId: string, customerId: string) {
  // #5 Idempotency: only fire once per customer per milestone tier per day
  const dedupe = `idempotency:loyalty:${merchantId}:${customerId}:${new Date().toISOString().slice(0, 10)}`;
  const isNew = await redis.set(dedupe, "1", "EX", 86400, "NX");
  if (!isNew) return;

  const rows = await sql`
    SELECT SUM(total) as ltv, COUNT(id) as order_count 
    FROM orders 
    WHERE merchant_id = ${merchantId} AND customer_id = ${customerId} AND state->>'status' = 'completed'
  `;

  if (rows.length === 0) return;
  const ltv = Number(rows[0].ltv);
  const orderCount = Number(rows[0].order_count);

  // Milestone thresholds — just log it to merchant, no automated reward
  const hitMilestone = orderCount === 5 || orderCount === 10 || orderCount === 20 || ltv > 100000;
  if (!hitMilestone) return;

  logger.log(`[LoyaltyMilestone] Customer ${customerId} hit milestone! LTV: ₦${ltv.toLocaleString()}, Orders: ${orderCount}`);

  const customerRows = await sql`SELECT name FROM customers WHERE id = ${customerId} OR phone = ${customerId} LIMIT 1`;
  const customerName = customerRows[0]?.name?.split(" ")[0] || "there";

  // Inform the merchant — that's all. No discount, no suggestion.
  const merchantRows = await sql`SELECT contact_phone FROM merchants WHERE id = ${merchantId} LIMIT 1`;
  const merchantPhone = merchantRows[0]?.contact_phone;

  if (merchantPhone) {
    const outboundQueue = new Queue("outbound-messages", {
      connection: { ...redis.options, maxRetriesPerRequest: null }
    });
    await outboundQueue.add("send-whatsapp", {
      merchantId,
      customerId: merchantPhone,
      text: `🌟 *Milestone Alert*\n\n${customerName} just completed their ${orderCount}${ordinalSuffix(orderCount)} order with you (Total spent: ₦${ltv.toLocaleString()}). Thought you'd want to know!`
    });
    logger.log(`[LoyaltyMilestone] Merchant notified for customer ${customerId}`);
  }
}

function ordinalSuffix(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}
