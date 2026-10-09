import { logger } from "@ace/shared/logger.js";
import { redis, sql } from "@ace/shared/clients.js";
import { Worker, Queue } from "bullmq";

export async function handleReviewRequest(appointmentId: string, merchantId: string, customerId: string) {
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
