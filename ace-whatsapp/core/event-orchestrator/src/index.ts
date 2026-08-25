import { logger } from "@ace/shared/logger.js";
import { setupPostPaymentFlow } from "./flows/postPaymentFlow.js";
import { setupAbandonedCartFlow } from "./flows/abandonedCartFlow.js";
import { setupInventoryRestockFlow } from "./flows/inventoryRestockFlow.js";
import { setupPostServiceReviewFlow } from "./flows/postServiceReviewFlow.js";
import { setupLoyaltyMilestoneFlow } from "./flows/loyaltyMilestoneFlow.js";

async function main() {
  logger.log("[EventOrchestrator] Starting event orchestrator...");

  // Initialize all flows (which now return BullMQ Workers)
  const paymentWorker = await setupPostPaymentFlow();
  const cartWorker = await setupAbandonedCartFlow();
  const restockWorker = await setupInventoryRestockFlow();
  const reviewWorker = await setupPostServiceReviewFlow();
  const loyaltyWorker = await setupLoyaltyMilestoneFlow();

  logger.log("[EventOrchestrator] All flows initialized and listening.");

  const gracefulShutdown = async (signal: string) => {
    logger.log(`[EventOrchestrator] Received ${signal}. Shutting down gracefully...`);
    
    // Close workers to stop accepting new jobs and finish active ones safely
    if (cartWorker) await cartWorker.close();
    if (reviewWorker) await reviewWorker.close();
    process.exit(0);
  };

  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.on("SIGINT", () => gracefulShutdown("SIGINT"));
}

main().catch(err => {
  logger.error("[EventOrchestrator] Fatal error during startup:", err);
  process.exit(1);
});
