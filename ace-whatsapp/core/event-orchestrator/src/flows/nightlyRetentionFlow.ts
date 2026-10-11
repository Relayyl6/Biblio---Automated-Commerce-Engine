import { logger } from "@ace/shared/logger.js";
import { redis } from "@ace/shared/clients.js";
import { Queue } from "bullmq";
import { ChurnAnalyzer, DiscountGenerator } from "../../../retention-engine/src/index.js";

export async function setupNightlyRetentionFlow() {
  const { Worker, Queue } = await import("bullmq");

  const retentionQueue = new Queue("cron-jobs", {
    connection: { ...redis.options, maxRetriesPerRequest: null }
  });

  await retentionQueue.add("nightly_retention", {}, {
    repeat: { pattern: "0 0 * * *" }
  });

  const analyzer = new ChurnAnalyzer();
  const generator = new DiscountGenerator();

  const worker = new Worker("cron-jobs", async (job: any) => {
    if (job.name === "nightly_retention") {
      logger.log("Running nightly retention analyzer...");
      
      const atRiskCustomers = await analyzer.getAtRiskCustomers(undefined, 30);
      logger.log("Found at-risk customers across platform", { count: atRiskCustomers.length });

      for (const customer of atRiskCustomers) {
        const draft = await generator.draftWinback(customer);
        if (draft) {
          logger.log("Queued winback discount for approval", { draftId: draft.id, customerId: customer.customerId });
        }
      }
    }
  }, { connection: { ...redis.options, maxRetriesPerRequest: null } });

  worker.on("failed", (job: any, err: any) => logger.error("[NightlyRetentionFlow] Job failed", { jobId: job?.id, err }));
  worker.on("error", (err: any) => logger.error("[NightlyRetentionFlow] Redis error", { err }));

  logger.log("[NightlyRetentionFlow] Listening for cron-jobs (nightly_retention)...");
  return worker;
}
