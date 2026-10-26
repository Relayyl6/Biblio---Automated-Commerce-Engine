import { Worker } from "bullmq";
import { redis, sql } from "@ace/shared/clients.js";
import { DispatchRouter } from "./router.js";
import { logger } from "@ace/shared/logger.js";
import type { OrderPayload } from "./types.js";

export async function handleDispatchOrderJob(payload: any) {
  const router = new DispatchRouter();
  logger.log(`[LogisticsWorker] Received dispatch request for Order ${payload.orderId}`);
  
  // Hydrate order details if missing
  let fullPayload: OrderPayload = payload;
  if (!payload.pickupAddress || !payload.dropoffAddress) {
    const orderRows = await sql`SELECT * FROM orders WHERE id = ${payload.orderId}::uuid`.catch(() => []);
    const o = orderRows[0];
    const merchantRows = await sql`SELECT contact_phone, physical_address FROM merchants WHERE id = ${payload.merchantId}::uuid LIMIT 1`.catch(() => []);
    const m = merchantRows[0];
    fullPayload = {
      orderId: payload.orderId,
      merchantId: payload.merchantId,
      customerPhone: payload.customerPhone || o?.state?.customerPhone || m?.contact_phone || 'Customer',
      pickupAddress: payload.pickupAddress || {
        street: m?.physical_address?.street || m?.physical_address?.address || '12 Broad Street',
        city: m?.physical_address?.city || 'Ikeja',
        state: m?.physical_address?.state || 'Lagos',
        country: 'Nigeria'
      },
      dropoffAddress: payload.dropoffAddress || {
        street: o?.state?.shipping?.destination?.street || o?.pickup_address || 'Lagos Island',
        city: 'Lagos',
        state: 'Lagos',
        country: 'Nigeria'
      },
      items: payload.items || o?.items || [{ name: 'Order Package', quantity: 1, weightKg: 1 }]
    };
  }

  const result = await router.autoDispatch(fullPayload);

  if (result.success && result.trackingNumber) {
    // Update database state with valid enum value 'shipped'
    await sql`
      UPDATE orders 
      SET state = jsonb_set(COALESCE(state, '{}'::jsonb), '{trackingNumber}', ${JSON.stringify(result.trackingNumber)}::jsonb),
          status = 'shipped'::order_status,
          updated_at = NOW()
      WHERE id = ${payload.orderId}::uuid
    `.catch(err => {
      logger.error({ err, orderId: payload.orderId }, 'Failed to update order status');
    });
    logger.log(`[LogisticsWorker] Order ${payload.orderId} dispatched via ${result.provider} (Tracking: ${result.trackingNumber})`);
    
    // Push notification outbox event for customer tracking
    const trackingMsg = `🏍️ Great news! Your order has been dispatched via ${result.provider.toUpperCase()}.\nTrack your rider here: ${result.trackingUrl || result.trackingNumber}`;
    await sql`
      INSERT INTO outbox_events (event_type, payload) 
      VALUES ('whatsapp_outbound', ${JSON.stringify({ 
        merchantId: payload.merchantId, 
        customerId: fullPayload.customerPhone || "unknown", 
        text: trackingMsg 
      })}::jsonb)
    `.catch(err => {
      logger.error({ err, orderId: payload.orderId }, 'Failed to insert outbound tracking event');
    });
  } else {
    logger.error(`[LogisticsWorker] Auto-dispatch failed for ${payload.orderId}: ${result.error}`);
  }
  return result;
}

export async function setupLogisticsWorker() {
  const worker = new Worker("logistics-dispatch", async (job) => {
    if (job.name === "dispatch_order" || job.name === "dispatch_rider_requested") {
      await handleDispatchOrderJob(job.data);
    }
  }, { connection: { ...redis.options, maxRetriesPerRequest: null } });

  worker.on("failed", (job, err) => logger.error(`[LogisticsWorker] Job ${job?.id} failed:`, err));
  worker.on("error", (err) => logger.error(`[LogisticsWorker] Redis error:`, err));

  logger.log("[LogisticsWorker] Listening for logistics-dispatch events...");
  return worker;
}
