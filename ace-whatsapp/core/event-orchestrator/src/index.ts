import { logger } from "@ace/shared/logger.js";
import { setupPostPaymentFlow } from "./flows/postPaymentFlow.js";
import { setupAbandonedCartFlow } from "./flows/abandonedCartFlow.js";
import { setupInventoryRestockFlow } from "./flows/inventoryRestockFlow.js";
import { setupPostServiceReviewFlow } from "./flows/postServiceReviewFlow.js";
import { setupLoyaltyMilestoneFlow } from "./flows/loyaltyMilestoneFlow.js";

async function main() {
  logger.log("[EventOrchestrator] Starting event orchestrator...");

  // Initialize all flows — each returns its BullMQ Worker for graceful shutdown
  const paymentWorker    = await setupPostPaymentFlow();
  const cartWorker       = await setupAbandonedCartFlow();
  const restockWorker    = await setupInventoryRestockFlow();
  const reviewWorker     = await setupPostServiceReviewFlow();
  const loyaltyWorker    = await setupLoyaltyMilestoneFlow();

  const allWorkers = [paymentWorker, cartWorker, restockWorker, reviewWorker, loyaltyWorker];

  logger.log("[EventOrchestrator] All flows initialized and listening.");

  const gracefulShutdown = async (signal: string) => {
    logger.log(`[EventOrchestrator] Received ${signal}. Shutting down gracefully...`);
    // Close all workers concurrently — stops accepting new jobs and waits for active ones
    await Promise.allSettled(allWorkers.map(w => w?.close()));
    process.exit(0);
  };

  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.on("SIGINT",  () => gracefulShutdown("SIGINT"));

  // Catch any unhandled promise rejections at the process level
  process.on("unhandledRejection", (reason) => {
    logger.error("[EventOrchestrator] Unhandled rejection:", reason);
  });
}

main().catch(err => {
  logger.error("[EventOrchestrator] Fatal error during startup:", err);
  process.exit(1);
});
