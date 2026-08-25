import { logger } from "@ace/shared/logger.js";
import { sql, jsonb } from "@ace/shared/clients";
import crypto from "crypto";

const WEBHOOK_SECRET = process.env.PAYMENT_WEBHOOK_SECRET || "test-secret";

async function run() {
  logger.log("=== STARTING ESCROW SIMULATION ===");

  // 1. Setup mock merchant and order
  const merchantId = "11111111-1111-1111-1111-111111111111";
  const customerId = "2349000000000";
  const virtualAccount = "9876543210";
  const orderId = crypto.randomUUID();

  logger.log("\n[1] Seeding mock merchant and order in AWAITING_PAYMENT state...");
  await sql`
    INSERT INTO merchants (id, name, phone_number_id, paystack_recipient_code)
    VALUES (${merchantId}, 'Escrow Test Merchant', 'phone123', 'RCP_test123')
    ON CONFLICT (id) DO NOTHING;
  `;
  
  await sql`
    INSERT INTO orders (id, merchant_id, customer_id, state)
    VALUES (
      ${orderId}, ${merchantId}, ${customerId},
      ${jsonb({
        status: "awaiting_payment",
        total: 10500,
        virtualAccountNumber: virtualAccount
      })}
    );
  `;

  // 2. Simulate Payment Webhook (Paystack format)
  logger.log("\n[2] Firing Payment Webhook (funds received)...");
  
  const payload = JSON.stringify({
    event: "charge.success",
    data: {
      reference: `ref_${Date.now()}`,
      amount: 1050000, // in kobo
      authorization: {
        receiver_bank_account_number: virtualAccount
      }
    }
  });

  const hash = crypto.createHmac("sha256", WEBHOOK_SECRET).update(payload).digest("hex");

  const payRes = await fetch("http://127.0.0.1:3002/payment/webhook", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-paystack-signature": hash
    },
    body: payload
  });

  if (!payRes.ok) throw new Error(`Payment webhook failed: ${payRes.status}`);

  // 3. Verify Escrow Hold (with retries for async processing)
  let escrowHold;
  for (let i = 0; i < 5; i++) {
    const res = await sql`SELECT * FROM escrow_accounts WHERE order_id = ${orderId}`;
    if (res.length > 0) {
      escrowHold = res[0];
      break;
    }
    await new Promise(r => setTimeout(r, 1000));
  }
  
  if (!escrowHold) {
    throw new Error("No escrow account row found after retries!");
  }
  
  logger.log(`[3] ✅ Escrow row created! Status: '${escrowHold.status}', Amount Held: ₦${escrowHold.amount}`);
  if (escrowHold.status !== 'held') throw new Error("Status should be held");
  
  // 4. Update order to OUT_FOR_DELIVERY manually (simulate logistics coordination)
  logger.log("\n[4] Simulating logistics dispatch (moving order to out_for_delivery)...");
  await sql`
    UPDATE orders SET state = ${jsonb({
      status: "out_for_delivery",
      trackingUrl: "http://track.me"
    })} WHERE id = ${orderId};
  `;

  // 5. Simulate Logistics Webhook (Delivered)
  logger.log("\n[5] Firing Logistics Webhook (delivery confirmed)...");
  const logRes = await fetch("http://127.0.0.1:3002/logistics/webhook", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      orderId: orderId,
      status: "delivered"
    })
  });

  if (!logRes.ok) throw new Error(`Logistics webhook failed: ${logRes.status}`);

  // 6. Verify Escrow Release (with retries)
  let escrowRelease;
  for (let i = 0; i < 5; i++) {
    const res = await sql`SELECT * FROM escrow_accounts WHERE order_id = ${orderId}`;
    if (res.length > 0 && res[0].status === 'released') {
      escrowRelease = res[0];
      break;
    }
    await new Promise(r => setTimeout(r, 1000));
  }
  
  if (!escrowRelease || escrowRelease.status !== 'released') {
    throw new Error("Escrow was not released after retries!");
  }
  
  logger.log(`[6] ✅ Escrow row updated! Status: '${escrowRelease.status}', Released At: ${escrowRelease.released_at}`);

  logger.log("\n=== ESCROW SIMULATION SUCCESSFUL ===");
  process.exit(0);
}

run().catch(err => {
  logger.error("Simulation failed:", err);
  process.exit(1);
});
