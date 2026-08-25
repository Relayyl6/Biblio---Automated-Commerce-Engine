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
  const rows = await sql<{ltv: number, order_count: number}[]>`
    SELECT SUM(total) as ltv, COUNT(id) as order_count 
    FROM orders 
    WHERE merchant_id = ${merchantId} AND customer_id = ${customerId} AND state->>'status' = 'completed'
  `;

  if (rows.length === 0) return;
  const ltv = rows[0].ltv;
  const orderCount = rows[0].order_count;

  if (orderCount === 5 || ltv > 100000) {
    logger.log(`[LoyaltyMilestone] Customer ${customerId} hit milestone! LTV: ${ltv}, Orders: ${orderCount}`);
    
    const outboundQueue = new Queue("outbound-messages", {
      connection: { ...redis.options, maxRetriesPerRequest: null }
    });

    const text = `🎉 Congratulations! You've unlocked our Loyalty Tier!\n\nUse code LOYAL15 for 15% off your next purchase. Thanks for being an amazing customer!`;

    await outboundQueue.add("send-whatsapp", {
      merchantId,
      customerId,
      text
    });
  }
}
