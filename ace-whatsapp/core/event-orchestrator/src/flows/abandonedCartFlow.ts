import { logger } from "@ace/shared/logger.js";
import { redis, sql } from "@ace/shared/clients.js";
import { Worker, Queue } from "bullmq";

export async function setupAbandonedCartFlow() {
  const worker = new Worker("delayed_cart_recovery", async job => {
    const { orderId, merchantId, customerId } = job.data;
    await handleCartRecovery(orderId, merchantId, customerId);
  }, {
    connection: { ...redis.options, maxRetriesPerRequest: null }
  });

  worker.on("completed", job => logger.log(`[AbandonedCartFlow] Processed job ${job.id}`));
  worker.on("failed", (job, err) => logger.error(`[AbandonedCartFlow] Job ${job?.id} failed:`, err));

  logger.log("[AbandonedCartFlow] Listening for delayed_cart_recovery jobs...");
}

async function handleCartRecovery(orderId: string, merchantId: string, customerId: string) {
  // #5 Idempotency: never fire twice for the same order
  const dedupe = `idempotency:cart:${orderId}`;
  const isNew = await redis.set(dedupe, "1", "EX", 86400, "NX");
  if (!isNew) return;

  const orderRows = await sql`SELECT state FROM orders WHERE id = ${orderId}`;
  const order = orderRows[0];
  if (!order) return;

  const status = order.state.status;
  if (status !== "awaiting_payment" && status !== "negotiating") {
    logger.log(`[AbandonedCartFlow] Order ${orderId} is ${status}, ignoring recovery.`);
    return;
  }

  // 1. Fetch the customer's first name so the message feels personal
  const customerRows = await sql`SELECT name FROM customers WHERE id = ${customerId} OR phone = ${customerId} LIMIT 1`;
  const customerName = customerRows[0]?.name?.split(" ")[0] || "there";

  // 2. Fetch the item names in the abandoned cart
  const itemRows = await sql`
    SELECT p.name FROM order_items oi
    JOIN products p ON p.id = oi.product_id
    WHERE oi.order_id = ${orderId}
    LIMIT 3
  `;
  const itemNames = itemRows.map((r: any) => r.name);
  const itemList = itemNames.length > 1
    ? `${itemNames.slice(0, -1).join(", ")} and ${itemNames.slice(-1)}`
    : itemNames[0] || "your selected items";

  // 3. Notify the merchant (informational only — no discount, no action required)
  const merchantRows = await sql`SELECT contact_phone FROM merchants WHERE id = ${merchantId} LIMIT 1`;
  const merchantPhone = merchantRows[0]?.contact_phone;
  if (merchantPhone) {
    const outboundQueue = new Queue("outbound-messages", {
      connection: { ...redis.options, maxRetriesPerRequest: null }
    });
    await outboundQueue.add("send-whatsapp", {
      merchantId,
      customerId: merchantPhone,
      text: `🛒 *Abandoned Cart*\n\n${customerName} left ${itemList} in their cart (Order: ${orderId}). Sending them a gentle follow-up now.`
    });
  }

  // 4. Message the customer directly — warm, personal, zero pressure
  const outboundQueue = new Queue("outbound-messages", {
    connection: { ...redis.options, maxRetriesPerRequest: null }
  });
  const customerText = `Hey ${customerName}! 👋 Are you still interested in the ${itemList}? Your cart is still saved — just reply here and I'll pick up right where you left off.`;

  await outboundQueue.add("send-whatsapp", {
    merchantId,
    customerId,
    text: customerText
  });

  logger.log(`[AbandonedCartFlow] Follow-up sent to customer ${customerId} for order ${orderId}`);
}
