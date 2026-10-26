import { logger } from "@ace/shared/logger.js";
import { redis, sql } from "@ace/shared/clients.js";
import { Queue } from "bullmq";

export async function handleReviewRequest(appointmentId: string, merchantId: string, customerId: string) {
  const merchantRows = await sql`SELECT name, social_links, website_url FROM merchants WHERE id = ${merchantId}::uuid LIMIT 1`.catch(() => []);
  const merchant = merchantRows[0];
  const merchantName = merchant?.name || 'our shop';
  const reviewLink = merchant?.social_links?.google_review || merchant?.website_url || 'https://biblio.africa';

  const text = `Hi! We hope you loved your session with ${merchantName}.\n\nCould you leave us a quick review? ${reviewLink}\n\nThank you for supporting us!`;

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
