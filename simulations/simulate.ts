import { logger } from "@ace/shared/logger.js";
import { sql, redis } from "@ace/shared/clients";
import crypto from "crypto";

const PAYSTACK_SECRET = "sk_test_acaf03dc33b2231b025ab3fb4c37ae204c0bad33";
const PAYMENT_URL = "http://127.0.0.1:3002/payment/webhook";

async function main() {
  logger.log("=== SIMULATING END-TO-END NO-FALLBACK PAYMENT & LOGISTICS ===");

  const customerId = "2348000000000";


  const orderState = {
    status: "awaiting_payment",
    orderId: crypto.randomUUID(),
    items: [{ name: "Test Product", quantity: 1, unitPrice: 10000 }],
    total: 10500,
    virtualAccountNumber: `999${Math.floor(Math.random() * 1000000)}`,
    expiresAt: Date.now() + 3000000
  };

  logger.log("1. Setting up mock merchant and awaiting_payment order...");
  const phone = `111${Math.floor(Math.random() * 1000000)}`;
  const merchantRows = await sql`
    insert into merchants (name, phone_number_id, paystack_recipient_code, contact_phone)
    values ('Test Vendor', ${phone}, 'RCP_test_12345', '2348000000000')
    returning id
  `;
  const merchantId = merchantRows[0].id;
  await redis.set(`conv:${merchantId}:${customerId}:window`, Date.now() + 86400000);

  await sql`
    insert into orders (id, merchant_id, customer_id, state)
    values (${orderState.orderId}, ${merchantId}, ${customerId}, ${sql.json(orderState)})
  `;
  
  logger.log("\n2. Simulating customer paying via Paystack (sending webhook)...");
  const payload = {
    event: "charge.success",
    data: {
      reference: `TEST_REF_${Date.now()}`,
      amount: orderState.total * 100, // kobo
      authorization: { receiver_bank_account_number: orderState.virtualAccountNumber }
    }
  };
  const bodyBuffer = Buffer.from(JSON.stringify(payload));
  const signature = crypto.createHmac("sha256", PAYSTACK_SECRET).update(bodyBuffer).digest("hex");

  await fetch(PAYMENT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-paystack-signature": signature },
    body: bodyBuffer
  });
  logger.log("-> Payment webhook sent! Waiting for logistics-coordination to pick it up...");
  
  await new Promise(r => setTimeout(r, 35000));
  
  const finalRows = await sql`select state from orders where id = ${orderState.orderId}`;
  logger.log("-> Final Order State from Database:", finalRows[0].state.status, (finalRows[0].state as any).riderTrackingUrl);

  if ((finalRows[0].state as any).riderTrackingUrl === "MANUAL_DISPATCH") {
    logger.log("🎉 SUCCESS! No-fallback logic correctly pushed the order to MANUAL_DISPATCH state!");
  } else {
    throw new Error("Failed: Order was not correctly handled by the error fallback.");
  }
  
  await sql`delete from transactions where order_id = ${orderState.orderId}`;
  await sql`delete from orders where id = ${orderState.orderId}`;
  await sql`delete from merchants where id = ${merchantId}`;
  logger.log("\n=== SIMULATION SUCCESSFUL ===");
  process.exit(0);
}

main().catch(err => { logger.error(err); process.exit(1); });
