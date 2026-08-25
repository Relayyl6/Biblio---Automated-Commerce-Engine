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
  const orderRows = await sql<any[]>`SELECT state FROM orders WHERE id = ${orderId}`;
  const order = orderRows[0];
  if (!order) return;

  const status = order.state.status;
  if (status === "awaiting_payment" || status === "negotiating") {
    const text = `Hi! You left some items in your cart.\n\nComplete your purchase in the next hour and get an extra 5% off! Reply to this message to continue.`;

    const outboundQueue = new Queue("outbound-messages", {
      connection: { ...redis.options, maxRetriesPerRequest: null }
    });

    await outboundQueue.add("send-whatsapp", {
      merchantId,
      customerId,
      text
    });
    
    logger.log(`[AbandonedCartFlow] Recovery message sent for order ${orderId}`);
  } else {
    logger.log(`[AbandonedCartFlow] Order ${orderId} is ${status}, ignoring recovery.`);
  }
}
