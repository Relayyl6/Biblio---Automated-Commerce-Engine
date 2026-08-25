import { redis } from "./shared/src/clients.js";
import { logger } from "./shared/src/logger.js";

async function main() {
  logger.info("[Test] Simulating PAYMENT_CONFIRMED event...");
  
  // Publish an event that the orchestrator will catch
  await redis.publish("events:payment_confirmed", JSON.stringify({
    merchantId: "test-merchant-123",
    customerId: "test-customer-456",
    orderId: "ord-test-789",
    timestamp: Date.now()
  }));

  logger.info("[Test] Simulating inventory_deducted event...");
  await redis.publish("events:inventory_deducted", JSON.stringify({
    merchantId: "test-merchant-123",
    sku: "TEST-SKU-001"
  }));

  setTimeout(() => process.exit(0), 1000);
}

main();
