import { logger } from "@ace/shared/logger.js";
import { redis, sql } from "@ace/shared/clients.js";
import { Queue } from "bullmq";

export async function handleLoyaltyCheck(merchantId: string, customerId: string) {
  // #5 Idempotency: only fire once per customer per milestone tier per day
  const dedupe = `idempotency:loyalty:${merchantId}:${customerId}:${new Date().toISOString().slice(0, 10)}`;
  const isNew = await redis.set(dedupe, "1", "EX", 86400, "NX");
  if (!isNew) return;

  const rows = await sql`
    SELECT COALESCE(SUM(amount), 0) as ltv, COUNT(id) as order_count 
    FROM transactions 
    WHERE merchant_id = ${merchantId}::uuid AND customer_id = ${customerId} AND status = 'confirmed'
  `.catch(() => []);

  if (!rows || rows.length === 0) return;
  const ltv = Number(rows[0].ltv || 0);
  const orderCount = Number(rows[0].order_count || 0);

  // Milestone thresholds
  const hitMilestone = orderCount === 5 || orderCount === 10 || orderCount === 20 || ltv > 100000;
  if (!hitMilestone) return;

  logger.log(`[LoyaltyMilestone] Customer ${customerId} hit milestone! LTV: ₦${ltv.toLocaleString()}, Orders: ${orderCount}`);

  const linkRows = await sql`
    SELECT verified_profile FROM customers c 
    JOIN customer_merchant_links l ON l.customer_id = ${customerId} 
    WHERE c.global_buyer_id = l.merchant_id OR c.phone_hash IS NOT NULL 
    LIMIT 1
  `.catch(() => []);
  const customerName = linkRows[0]?.verified_profile?.name?.split(" ")[0] || "A loyal customer";

  // Inform the merchant
  const merchantRows = await sql`SELECT contact_phone FROM merchants WHERE id = ${merchantId}::uuid LIMIT 1`.catch(() => []);
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
