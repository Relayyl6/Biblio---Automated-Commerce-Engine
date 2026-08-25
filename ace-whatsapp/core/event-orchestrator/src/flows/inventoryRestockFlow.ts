import { logger } from "@ace/shared/logger.js";
import { redis, sql } from "@ace/shared/clients.js";
import { Worker } from "bullmq";

export async function setupInventoryRestockFlow() {
  const sub = redis.duplicate();
  await sub.subscribe("events:inventory_deducted");

  sub.on("message", async (channel, message) => {
    if (channel === "events:inventory_deducted") {
      try {
        const payload = JSON.parse(message);
        await handleInventoryCheck(payload.merchantId, payload.sku);
      } catch (err) {
        logger.error("[InventoryRestockFlow] Error processing event:", err);
      }
    }
  });

  logger.log("[InventoryRestockFlow] Listening for inventory_deducted events...");
}

async function handleInventoryCheck(merchantId: string, sku: string) {
  const rows = await sql<any[]>`SELECT stock FROM inventory WHERE merchant_id = ${merchantId} AND sku = ${sku}`;
  if (rows.length === 0) return;

  const stock = rows[0].stock;
  const restockThreshold = 5;

  if (stock <= restockThreshold) {
    logger.log(`[InventoryRestockFlow] SKU ${sku} is low (${stock} remaining). Alerting merchant.`);
    
    const merchantRows = await sql<{contact_phone: string}[]>`SELECT contact_phone FROM merchants WHERE id = ${merchantId} LIMIT 1`;
    const merchantPhone = merchantRows[0]?.contact_phone;

    if (merchantPhone) {
      const { Queue } = await import("bullmq");
      const outboundQueue = new Queue("outbound-messages", {
        connection: { ...redis.options, maxRetriesPerRequest: null }
      });
      
      const alertText = `⚠️ *Low Stock Alert*\n\nSKU: ${sku} is down to ${stock} units.\nWould you like me to draft an email to your supplier to reorder?`;

      await outboundQueue.add("send-whatsapp", {
        merchantId,
        customerId: merchantPhone,
        text: alertText
      });
    }
  }
}
