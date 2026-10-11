import { logger } from "@ace/shared/logger.js";
import { redis } from "@ace/shared/clients.js";
import { handleWebhookFanning } from "../flows/webhookDispatcher.js";

export async function setupDomainEventsWorker() {
  const { Worker } = await import("bullmq");

  const worker = new Worker("domain-events", async (job: any) => {
    const eventName = job.name;
    const payload = job.data;
    
    logger.log(`[DomainEventsWorker] Received event: ${eventName}`);
    
    // Pass every domain event to webhook dispatcher
    await handleWebhookFanning(eventName, payload);
    
  }, { connection: { ...redis.options, maxRetriesPerRequest: null } });

  worker.on("failed", (job: any, err: any) => logger.error(`[DomainEventsWorker] Job ${job?.id} failed:`, err));
  worker.on("error", (err: any) => logger.error(`[DomainEventsWorker] Redis error:`, err));

  logger.log("[DomainEventsWorker] Listening for all domain-events...");
  return worker;
}
