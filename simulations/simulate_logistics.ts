import { logger } from "@ace/shared/logger.js";
import { sql, redis } from "@ace/shared/clients";
import { startLogisticsStreamConsumer } from "../ace-whatsapp/core/logistics/src/streamConsumer";
import { bookRider } from "../ace-whatsapp/core/logistics/src/dispatchService";

// Local simulation script

async function simulateLogistics() {
  const merchantId = "11111111-1111-1111-1111-111111111111"; // Use a mock UUID
  const customerId = "2348000000005";
  const orderId = "22222222-2222-2222-2222-222222222222";
  const phoneNumberId = "123456789";

  logger.log("🚀 Starting Logistics Stream Simulation...");

  // 1. Seed merchant
  await sql`
    INSERT INTO merchants (id, name, contact_phone, phone_number_id, tone_guide)
    VALUES (${merchantId}, 'Test Merchant', '2348000000000', ${phoneNumberId}, 'Friendly')
    ON CONFLICT (id) DO NOTHING
  `;

  // 2. Clear old test orders
  await sql`DELETE FROM orders WHERE id = ${orderId}`;

  // 3. Inject order
  const orderState = {
    status: "payment_verified",
    orderId: orderId,
    items: [{ sku: "TEST-SKU", name: "Test Product", quantity: 1, unitPrice: 5000 }],
    total: 5000,
    paidAt: Date.now()
  };

  await sql`
    INSERT INTO orders (id, merchant_id, customer_id, state)
    VALUES (${orderId}, ${merchantId}, ${customerId}, ${sql.json(orderState)})
  `;
  
  // Clear any potential locks
  await redis.del(`lock:logistics_dispatch:${orderId}`);

  // Start the consumer in the background
  startLogisticsStreamConsumer().catch(logger.error);

  logger.log("Injecting a 'payments.verified' event into the Redis Stream...");

  // 4. Emit stream event (exactly as payment-verification does)
  await redis.xadd("stream:payments.verified", "*",
    "orderId", orderId,
    "merchantId", merchantId,
    "customerId", customerId,
    "phoneNumberId", phoneNumberId,
    "amountNgn", "5000",
    "itemsJson", JSON.stringify(orderState.items),
  );

  // Wait for consumer to process
  logger.log("Waiting 3 seconds for consumer to process...");
  await new Promise(r => setTimeout(r, 3000));

  // 5. Verify new state
  const updated = await sql`SELECT state FROM orders WHERE id = ${orderId}`;
  
  logger.log("\n🔍 Verification Result:");
  logger.log(JSON.stringify(updated[0]?.state, null, 2));

  if (updated[0]?.state.status === "out_for_delivery" && updated[0]?.state.riderTrackingUrl) {
    logger.log("✅ Simulation Complete: Order successfully transitioned to out_for_delivery via stream!");
    process.exit(0);
  } else {
    logger.error("❌ Simulation Failed: Order state did not update correctly.");
    process.exit(1);
  }
}

simulateLogistics().catch(err => {
  logger.error("Simulation failed:", err);
  process.exit(1);
});
