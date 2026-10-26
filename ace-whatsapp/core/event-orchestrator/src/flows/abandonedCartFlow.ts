import { logger } from "@ace/shared/logger.js";
import { redis, sql } from "@ace/shared/clients.js";
import { Queue } from "bullmq";

export async function handleCartRecovery(orderId: string, merchantId: string, customerId: string) {
  const outboundQueue = new Queue("outbound-messages", {
    connection: { ...redis.options, maxRetriesPerRequest: null }
  });

  // #5 Idempotency: never fire twice for the same order
  const dedupe = `idempotency:cart:${orderId}`;
  const isNew = await redis.set(dedupe, "1", "EX", 86400, "NX");
  if (!isNew) return;

  const orderRows = await sql<any[]>`SELECT * FROM orders WHERE id = ${orderId}::uuid`.catch(() => []);
  const order = orderRows[0];
  if (!order) { logger.warn(`Order ${orderId} not found`); return; }

  const status = order.status || order.state?.status;
  if (status !== "pending" && status !== "awaiting_payment" && status !== "draft") {
    logger.log(`[AbandonedCartFlow] Order ${orderId} is ${status}, ignoring recovery.`);
    return;
  }

  // 1. Resolve customer name and phone
  const linkRows = await sql`
    SELECT verified_profile FROM customers c 
    JOIN customer_merchant_links l ON l.customer_id = ${customerId} 
    WHERE c.global_buyer_id = l.merchant_id OR c.phone_hash IS NOT NULL 
    LIMIT 1
  `.catch(() => []);
  const customerName = linkRows[0]?.verified_profile?.name?.split(" ")[0] || "there";
  const customerPhone = customerId;

  // 2. Fetch the items from order
  const items = Array.isArray(order.items) ? order.items : (Array.isArray(order.state?.items) ? order.state.items : []);
  const itemNames = items.map((r: any) => r.name || r.sku || "Selected Item");
  const itemList = itemNames.length > 1
    ? itemNames.slice(0, -1).join(", ") + " and " + itemNames.slice(-1)
    : itemNames[0] || "your selected items";

  const calculatedTotal = items.reduce((sum: number, it: any) => sum + (Number(it.price || 0) * Number(it.quantity || 1)), 0);
  const totalAmount = Number(order.state?.total || calculatedTotal || 0);

  // Phase 2: OFFLINE SMS ESCALATION
  // If the cart value is high (> N25,000), we escalate via Out-Of-Band SMS
  if (totalAmount > 25000) {
    logger.log(`[AbandonedCartFlow] High-Value Cart (N${totalAmount}) abandoned. Escalating to SMS for ${customerPhone}`);
    const smsMessage = `Hi ${customerName}! It's Biblio. Your cart for ₦${totalAmount.toLocaleString()} containing ${itemNames[0] || 'items'} is still reserved. Reply YES here via SMS to confirm or ask questions.`;
    
    await sql`
      INSERT INTO outbox_events (event_type, payload) 
      VALUES ('escalation_sms', ${JSON.stringify({ toPhone: customerPhone, message: smsMessage })}::jsonb)
    `;
    return;
  }

  // 3. Notify the merchant
  const merchantRows = await sql`SELECT contact_phone, name FROM merchants WHERE id = ${merchantId}::uuid LIMIT 1`.catch(() => []);
  const merchantPhone = merchantRows[0]?.contact_phone;
  if (merchantPhone) {
    await outboundQueue.add("send-whatsapp", {
      merchantId,
      customerId: merchantPhone,
      text: `🛒 *Abandoned Cart*\n\n${customerName} left ${itemList} in their cart (Order: ${orderId.split('-')[0]}). Sending them a gentle follow-up now.`
    });
  }

  // 4. Message the customer directly - warm, personal, zero pressure
  const customerText = `Hey ${customerName}! 👋 Are you still interested in the ${itemList}? Your cart is still saved - just reply here and I'll pick up right where you left off.`;

  await outboundQueue.add("send-whatsapp", {
    merchantId,
    customerId,
    text: customerText
  });

  logger.log(`[AbandonedCartFlow] Follow-up sent to customer ${customerId} for order ${orderId}`);
}
