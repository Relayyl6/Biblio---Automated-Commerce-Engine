import { logger } from "@ace/shared/logger.js";
import { redis, sql } from "@ace/shared/clients.js";

// Uses Redis Pub/Sub to listen for PAYMENT_CONFIRMED events
export async function setupPostPaymentFlow() {
  const { Worker, Queue } = require("bullmq");

  const worker = new Worker("domain-events", async (job: any) => {
    if (job.name === "payment_confirmed") {
      const payload = job.data;
      await handlePaymentConfirmed(payload.orderId, payload.merchantId, payload.customerId);
    }
  }, { connection: { ...redis.options, maxRetriesPerRequest: null } });

  worker.on("failed", (job: any, err: any) => logger.error(`[PostPaymentFlow] Job ${job?.id} failed:`, err));
  worker.on("error", (err: any) => logger.error(`[PostPaymentFlow] Redis error:`, err));

  logger.log("[PostPaymentFlow] Listening for domain-events (payment_confirmed)...");
  return worker;
}

async function handlePaymentConfirmed(orderId: string, merchantId: string, customerId: string) {
  logger.log(`[PostPaymentFlow] Processing payment for order ${orderId}`);
  
  // 1. Generate text-based WhatsApp receipt
  const orderRows = await sql<any[]>`SELECT * FROM orders WHERE id = ${orderId}`;
  const order = orderRows[0];
  if (!order) return;

  const total = order.state.total ?? 0;
  
  const receiptText = `✅ *Payment Received!*\n\nThank you for your payment of ₦${total.toLocaleString()}.\nYour order (${orderId.split('-')[0]}) is now confirmed and is being processed.\n\nWe will notify you once it ships!`;

  // 2. Queue outbound message to Comms Router
  const { Queue } = await import("bullmq");
  const outboundQueue = new Queue("outbound-messages", {
    connection: { ...redis.options, maxRetriesPerRequest: null }
  });

  await outboundQueue.add("send-whatsapp", {
    merchantId,
    customerId,
    text: receiptText
  });
  
  logger.log(`[PostPaymentFlow] Receipt queued for customer ${customerId}`);
}
