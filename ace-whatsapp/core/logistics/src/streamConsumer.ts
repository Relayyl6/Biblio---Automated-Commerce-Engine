import { redis, sql, jsonb } from "@ace/shared/clients";
import { transition } from "../../state-machine/src/orderStateMachine";
import { sendCustomerMessage } from "../../comms-router/src/outbound";
import type { OrderState } from "@ace/shared/types";
import { bookRider } from "./dispatchService";
import pino from "pino";

const logger = pino({ level: process.env.LOG_LEVEL || "info", name: "logistics-stream" });

const STREAM_NAME = "stream:payments.verified";
const CONSUMER_GROUP = "logistics_dispatch_group";
const CONSUMER_NAME = `logistics_consumer_${Math.random().toString(36).substr(2, 5)}`;

export async function startLogisticsStreamConsumer() {
  try {
    // Create the consumer group if it doesn't exist. 
    // Start reading from '$' (new messages only) or '0' (from beginning).
    // MKSTREAM automatically creates the stream if it doesn't exist.
    await redis.xgroup("CREATE", STREAM_NAME, CONSUMER_GROUP, "$", "MKSTREAM");
    logger.info({ group: CONSUMER_GROUP }, "Consumer group created.");
  } catch (err: any) {
    if (!err.message.includes("BUSYGROUP")) {
      logger.error({ err }, "Error creating group");
      throw err;
    }
  }

  logger.info({ consumer: CONSUMER_NAME, stream: STREAM_NAME }, "Starting to read from stream...");
  
  // Continuous reading loop
  while (true) {
    try {
      // Block for up to 5 seconds to get a message
      const results = await redis.xreadgroup(
        "GROUP", CONSUMER_GROUP, CONSUMER_NAME,
        "BLOCK", 5000,
        "STREAMS", STREAM_NAME, ">" // '>' means "messages never delivered to other consumers in this group"
      );

      if (results && results.length > 0) {
        const [, messages] = results[0] as any[];
        
        for (const message of messages) {
          const [messageId, fields] = message;
          const payload = parseRedisFields(fields);
          
          await handlePaymentVerifiedEvent(payload);

          // Acknowledge the message so it's removed from pending
          await redis.xack(STREAM_NAME, CONSUMER_GROUP, messageId);
        }
      }
    } catch (err) {
      logger.error({ err }, "Error reading from stream");
      await new Promise(resolve => setTimeout(resolve, 3000)); // Sleep before retry
    }
  }
}

function parseRedisFields(fields: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (let i = 0; i < fields.length; i += 2) {
    result[fields[i]] = fields[i + 1];
  }
  return result;
}

async function handlePaymentVerifiedEvent(payload: Record<string, string>) {
  const { orderId, merchantId, customerId, phoneNumberId } = payload;
  
  if (!orderId || !merchantId || !customerId) {
    logger.error({ payload }, "Invalid payload missing required fields");
    return;
  }

  logger.info({ orderId }, "Received verified payment, processing dispatch");

  const lockKey = `lock:logistics_dispatch:${orderId}`;
  const lock = await redis.set(lockKey, "1", "EX", 30, "NX");
  if (!lock) return;

  try {
    // 1. Check order state
    const rows = await sql<{ state: OrderState }[]>`
      SELECT state FROM orders WHERE id = ${orderId}
    `;

    if (rows.length === 0) {
      logger.error({ orderId }, "Order not found in DB");
      return;
    }

    const orderState = rows[0].state;
    if (orderState.status !== "payment_verified") {
      logger.info({ orderId, status: orderState.status }, "Order not in payment_verified state, ignoring dispatch");
      return;
    }

    // 2. Book Rider via real API
    const providerRes = await bookRider(orderId, merchantId, customerId);

    // 3. Transition state
    const newState = transition(orderState, { 
      type: "RIDER_ASSIGNED", 
      trackingUrl: providerRes.trackingUrl 
    });

    // 4. Persist
    await sql`
      UPDATE orders 
      SET state = ${jsonb(newState)}, updated_at = now() 
      WHERE id = ${orderId}
    `;

    // 5. Notify Customer & Vendor appropriately
    if (providerRes.trackingUrl === "MANUAL_DISPATCH") {
      await sendCustomerMessage({
        toPhone: customerId,
        text: `📦 Good news! Your payment is confirmed. The store is packaging your order and arranging direct delivery. You will receive dispatch updates shortly! 🎉`
      }, phoneNumberId, merchantId);

      // Alert vendor of manual dispatch requirement
      try {
        const vendor = await sql<{ contact_phone: string }[]>`
          SELECT contact_phone FROM merchants WHERE id = ${merchantId} LIMIT 1
        `;
        if (vendor.length && vendor[0].contact_phone) {
          await sendCustomerMessage({
            toPhone: vendor[0].contact_phone,
            text: `⚠️ *Biblio Logistics Alert:* Automated courier dispatch was unavailable for Order #${orderId.slice(0, 8)} (Customer: ${customerId}). Please arrange direct courier dispatch for this package.`
          }, phoneNumberId, merchantId);
        }
      } catch (alertErr) {
        logger.error({ alertErr, orderId }, "Failed to alert vendor of manual dispatch");
      }
    } else {
      await sendCustomerMessage({
        toPhone: customerId,
        text: `🏍️ Good news! Your order has been dispatched.\n\nRider: ${providerRes.riderName}\nTracking Link: ${providerRes.trackingUrl}\n\nThank you for shopping with us! 🎉`
      }, phoneNumberId, merchantId);
    }

    logger.info({ orderId, trackingUrl: providerRes.trackingUrl }, "Order dispatch state transition completed");
  } catch (err) {
    logger.error({ err, orderId }, "Failed to dispatch order");
  } finally {
    await redis.del(lockKey);
  }
}
