import { logger } from "@ace/shared/logger.js";
import { setupPostPaymentFlow } from "./flows/postPaymentFlow.js";
import { setupAbandonedCartFlow } from "./flows/abandonedCartFlow.js";
import { setupInventoryRestockFlow } from "./flows/inventoryRestockFlow.js";
import { setupPostServiceReviewFlow } from "./flows/postServiceReviewFlow.js";
import { setupLoyaltyMilestoneFlow } from "./flows/loyaltyMilestoneFlow.js";

async function main() {
  logger.log("[EventOrchestrator] Starting event orchestrator...");

  // Initialize all flows
  await setupPostPaymentFlow();
  await setupAbandonedCartFlow();
  await setupInventoryRestockFlow();
  await setupPostServiceReviewFlow();
  await setupLoyaltyMilestoneFlow();

  logger.log("[EventOrchestrator] All flows initialized and listening.");
}

main().catch(err => {
  logger.error("[EventOrchestrator] Fatal error during startup:", err);
  process.exit(1);
});
