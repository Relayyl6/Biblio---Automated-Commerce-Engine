import { logger } from "@ace/shared/logger.js";
import { redis, sql } from "@ace/shared/clients.js";
import { Queue } from "bullmq";
import { interactionFeedback } from "@ace/shared/feedback/interactionFeedback.js";

export async function handlePaymentConfirmed(orderId: string, merchantId: string, customerId: string) {
  logger.log(`[PostPaymentFlow] Processing payment for order ${orderId}`);
  
  // 1. Validate order and calculate total
  const orderRows = await sql<any[]>`SELECT * FROM orders WHERE id = ${orderId}::uuid`.catch(() => []);
  const order = orderRows[0];
  if (!order) {
    logger.warn(`[PostPaymentFlow] Order ${orderId} not found`);
    return;
  }

  const items = Array.isArray(order.items) ? order.items : (Array.isArray(order.state?.items) ? order.state.items : []);
  const calculatedTotal = items.reduce((sum: number, it: any) => sum + (Number(it.price || 0) * Number(it.quantity || 1)), 0);
  const total = Number(order.state?.total || calculatedTotal || 0);
  
  // 2. Queue WhatsApp Receipt via outbound queue
  const receiptText = `🎉 *Payment Received!*\n\nThank you for your payment of ₦${total.toLocaleString()}.\nYour order (${orderId.split('-')[0]}) is now confirmed and is being processed.\n\nWe will notify you once it ships!`;
  const outboundQueue = new Queue("outbound_messages", {
    connection: { ...redis.options, maxRetriesPerRequest: null }
  });

  await outboundQueue.add("send_whatsapp_receipt", {
    merchantId,
    customerId,
    text: receiptText
  });
  logger.log(`[PostPaymentFlow] Receipt queued for customer ${customerId}`);

  // 3. Close the RL feedback loop by backdating order outcome onto conversation_outcomes
  try {
    const margin = Math.round(total * 0.30); // Realized margin estimate
    await interactionFeedback.recordOrderOutcome({
      customerId,
      merchantId,
      outcome: 'completed_full_margin',
      marginRealized: margin,
      finalPrice: total
    });
  } catch (fbErr) {
    logger.warn(`[PostPaymentFlow] Feedback record failed:`, fbErr);
  }

  // 4. Logistics Dispatch Draft for Inbox or Auto-Dispatch
  const merchantRows = await sql`SELECT api_keys, delivery_info, physical_address FROM merchants WHERE id = ${merchantId}::uuid LIMIT 1`.catch(() => []);
  const merchant = merchantRows[0];
  const autoDispatch = merchant?.api_keys?.auto_dispatch === true;

  if (autoDispatch) {
    logger.log(`[PostPaymentFlow] Auto-dispatch enabled. Triggering logistics for ${orderId}`);
    
    const domainQueue = new Queue("domain-events", {
      connection: { ...redis.options, maxRetriesPerRequest: null }
    });

    const pickupAddress = order.pickup_address || merchant?.physical_address?.address || 'Merchant Location';
    const dropoffAddress = order.state?.shipping?.destination || order.pickup_address || 'Customer Delivery Address';

    await domainQueue.add("dispatch_order", {
      orderId,
      merchantId,
      customerPhone: customerId,
      pickupAddress,
      dropoffAddress,
      items
    });
  } else {
    logger.log(`[PostPaymentFlow] Auto-dispatch disabled or manual. Generating dispatch draft for Inbox...`);
    
    // Create manual dispatch draft in Inbox for vendor one-tap approval
    await sql`
      INSERT INTO dispatch_drafts (merchant_id, order_id, status)
      VALUES (${merchantId}::uuid, ${orderId}::uuid, 'pending')
    `.catch(err => {
      logger.warn({ err, orderId }, 'Failed to insert dispatch draft');
    });
  }
}
