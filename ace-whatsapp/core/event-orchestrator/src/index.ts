import { logger } from "@ace/shared/logger.js";
import { redis } from "@ace/shared/clients.js";
import { Worker } from "bullmq";

import { handlePaymentConfirmed } from "./flows/postPaymentFlow.js";
import { handleCartRecovery } from "./flows/abandonedCartFlow.js";
import { handleOrderPaidForRestock } from "./flows/inventoryRestockFlow.js";
import { handleReviewRequest } from "./flows/postServiceReviewFlow.js";
import { handleLoyaltyCheck } from "./flows/loyaltyMilestoneFlow.js";
import { setupNightlyRetentionFlow } from "./flows/nightlyRetentionFlow.js";
import { handleWebhookFanning } from "./flows/webhookDispatcher.js";
import { setupLogisticsWorker } from "../../logistics-coordination/src/index.js";
import { sendEscalationSms } from "../../comms-router/src/index.js";
import { setupOutboxRelay } from "./workers/outboxRelay.js";

async function main() {
  logger.log("[EventOrchestrator] Starting event orchestrator...");

  // Set up Domain Events Router
  const domainWorker = new Worker("domain-events", async (job) => {
    try {
        // 1. Fan out to external webhooks FIRST
        await handleWebhookFanning(job.name, job.data);

        // 2. Process internal business logic
        switch (job.name) {
          case "payment_confirmed":
            await handlePaymentConfirmed(job.data.orderId, job.data.merchantId, job.data.customerId);
            break;
          case "order_paid":
            await handleOrderPaidForRestock(job.data);
            break;
          case "cart_abandoned":
            await handleCartRecovery(job.data.orderId, job.data.merchantId, job.data.customerId);
            break;
          case "service_completed":
            await handleReviewRequest(job.data.appointmentId, job.data.merchantId, job.data.customerId);
            break;
          case "order_completed":
            await handleLoyaltyCheck(job.data.merchantId, job.data.customerId);
            break;
          case "escalation_sms":
            await sendEscalationSms(job.data.toPhone, job.data.message);
            break;
          default:
            logger.warn(`[EventOrchestrator] Unhandled domain event: ${job.name}`);
        }
      } catch (err) {
        logger.error(`[EventOrchestrator] Error processing job ${job.name}:`, err);
        throw err;
      }
  }, {
    connection: { ...redis.options, maxRetriesPerRequest: null }
  });

  domainWorker.on("failed", (job, err) => logger.error(`[EventOrchestrator] Job ${job?.id} failed:`, err));
  domainWorker.on("error", (err) => logger.error(`[EventOrchestrator] Redis error:`, err));

  // Initialize other background flows that are purely cron-based
  const retentionWorker = await setupNightlyRetentionFlow();

  const logisticsWorker = await setupLogisticsWorker();
  const allWorkers = [domainWorker, retentionWorker, logisticsWorker];
  await setupOutboxRelay();

  logger.log("[EventOrchestrator] All flows initialized and listening.");

  const gracefulShutdown = async (signal: string) => {
    logger.log(`[EventOrchestrator] Received ${signal}. Shutting down gracefully...`);
    await Promise.allSettled(allWorkers.map(w => w?.close()));
    process.exit(0);
  };

  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.on("SIGINT",  () => gracefulShutdown("SIGINT"));

  process.on("unhandledRejection", (reason) => {
    logger.error("[EventOrchestrator] Unhandled rejection:", reason);
  });
}

main().catch(err => {
  logger.error("[EventOrchestrator] Fatal error during startup:", err);
  process.exit(1);
});





