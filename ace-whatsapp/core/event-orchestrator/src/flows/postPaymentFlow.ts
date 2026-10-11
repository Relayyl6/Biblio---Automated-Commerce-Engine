import { logger } from "@ace/shared/logger.js";
import { redis, sql } from "@ace/shared/clients.js";
import { Queue } from "bullmq";

export async function handlePaymentConfirmed(orderId: string, merchantId: string, customerId: string) {
  logger.log(`[PostPaymentFlow] Processing payment for order ${orderId}`);
  
  // 1. Validate order and check for Auto-Dispatch
  const orderRows = await sql<any[]>`SELECT * FROM orders WHERE id = ${orderId}`;
  const order = orderRows[0];
  if (!order) return;

  const total = order.state.total ?? 0;
  
  // 2. Queue WhatsApp Receipt
  const receiptText = `? *Payment Received!*\n\nThank you for your payment of ?${total.toLocaleString()}.\nYour order (${orderId.split('-')[0]}) is now confirmed and is being processed.\n\nWe will notify you once it ships!`;
  const outboundQueue = new Queue("outbound-messages", {
    connection: { ...redis.options, maxRetriesPerRequest: null }
  });

  await outboundQueue.add("send-whatsapp", {
    merchantId,
    customerId,
    text: receiptText
  });
  logger.log(`[PostPaymentFlow] Receipt queued for customer ${customerId}`);

  // 3. Phase 2: Logistics Auto-Dispatch
  // Check if merchant config allows autonomous dispatch
  const settingsRow = await sql`SELECT settings FROM merchants WHERE id = ${merchantId} LIMIT 1`;
  const autoDispatch = settingsRow[0]?.settings?.auto_dispatch === true;

  if (autoDispatch) {
    logger.log(`[PostPaymentFlow] Auto-dispatch enabled. Triggering logistics for ${orderId}`);
    
    // We get customer phone for notifications
    const customerRows = await sql`SELECT phone FROM customers WHERE id = ${customerId} OR phone = ${customerId} LIMIT 1`;
    const customerPhone = customerRows[0]?.phone || customerId;
    
    const domainQueue = new Queue("domain-events", {
      connection: { ...redis.options, maxRetriesPerRequest: null }
    });

    await domainQueue.add("dispatch_order", {
      orderId,
      merchantId,
      customerPhone,
      pickupAddress: order.state.shipping?.origin || { state: 'Lagos', lga: 'Ikeja', address: 'Merchant Shop' },
      dropoffAddress: order.state.shipping?.destination,
      items: order.state.items
    });
  } else {
    logger.log(`[PostPaymentFlow] Auto-dispatch disabled. Generating dispatch draft for Inbox...`);
    
    // Create manual dispatch draft in Inbox
    await sql`
      INSERT INTO dispatch_drafts (merchant_id, order_id, status)
      VALUES (${merchantId}, ${orderId}, 'pending')
    `;
  }
}
