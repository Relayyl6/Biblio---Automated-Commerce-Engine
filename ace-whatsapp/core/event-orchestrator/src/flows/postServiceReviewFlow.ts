import { logger } from "@ace/shared/logger.js";
import { redis, sql } from "@ace/shared/clients.js";
import { Worker, Queue } from "bullmq";

export async function setupPostServiceReviewFlow() {
  const worker = new Worker("post_service_review", async job => {
    const { appointmentId, merchantId, customerId } = job.data;
    await handleReviewRequest(appointmentId, merchantId, customerId);
  }, {
    connection: { ...redis.options, maxRetriesPerRequest: null }
  });

  worker.on("error", (err) => logger.error(`[PostServiceReview] Redis error:`, err));
  worker.on("completed", job => logger.log(`[PostServiceReview] Processed job ${job.id}`));
  worker.on("failed", (job, err) => logger.error(`[PostServiceReview] Job ${job?.id} failed:`, err));

  logger.log("[PostServiceReview] Listening for post_service_review jobs...");
  return worker;
}

async function handleReviewRequest(appointmentId: string, merchantId: string, customerId: string) {
  const text = `Hi! We hope you loved your session with us.\n\nCould you leave us a quick review on our Google Business page? [Link]`;

  const outboundQueue = new Queue("outbound-messages", {
    connection: { ...redis.options, maxRetriesPerRequest: null }
  });

  await outboundQueue.add("send-whatsapp", {
    merchantId,
    customerId,
    text
  });
  
  logger.log(`[PostServiceReview] Review request sent to ${customerId}`);
}
