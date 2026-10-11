import { Worker } from "bullmq";
import { redis, sql } from "@ace/shared/clients.js";
import { DispatchRouter } from "./router.js";
import { logger } from "@ace/shared/logger.js";
import type { OrderPayload } from "./types.js";

export async function setupLogisticsWorker() {
  const router = new DispatchRouter();

  const worker = new Worker("domain-events", async (job) => {
    if (job.name === "dispatch_order") {
      logger.log(`[LogisticsWorker] Received dispatch request for Order ${job.data.orderId}`);
      
      const payload = job.data as OrderPayload;
      const result = await router.autoDispatch(payload);

      if (result.success && result.trackingNumber) {
        // Update database state
        await sql`
          UPDATE orders 
          SET state = jsonb_set(state, '{trackingNumber}', ${JSON.stringify(result.trackingNumber)}::jsonb),
              status = 'dispatched'
          WHERE id = ${payload.orderId}
        `;
        logger.log(`[LogisticsWorker] Order ${payload.orderId} dispatched via ${result.provider} (Tracking: ${result.trackingNumber})`);
        
        // Push notification outbox event for customer tracking
        const trackingMsg = `?? Great news! Your order has been dispatched via ${result.provider.toUpperCase()}.\nTrack your rider here: ${result.trackingUrl || result.trackingNumber}`;
        await sql`
          INSERT INTO outbox_events (event_type, payload) 
          VALUES ('whatsapp_outbound', ${JSON.stringify({ 
            merchantId: payload.merchantId, 
            customerId: payload.customerPhone || "unknown", 
            text: trackingMsg 
          })}::jsonb)
        `;
      } else {
        logger.error(`[LogisticsWorker] Auto-dispatch failed for ${payload.orderId}: ${result.error}`);
        // Phase 3: Push a manual dispatch exception draft to the Inbox!
      }
    }
  }, { connection: { ...redis.options, maxRetriesPerRequest: null } });

  worker.on("failed", (job, err) => logger.error(`[LogisticsWorker] Job ${job?.id} failed:`, err));
  worker.on("error", (err) => logger.error(`[LogisticsWorker] Redis error:`, err));

  logger.log("[LogisticsWorker] Listening for dispatch_order events...");
  return worker;
}

