// core/logistics-coordination/src/index.ts
//
// Reads from the Redis Stream "stream:payments.verified" and automatically
// books a rider for every confirmed order.
//
// Flow:
//   1. payment-verification publishes to stream:payments.verified
//   2. This service reads the stream (blocking XREAD, consumer-group style)
//   3. Calls providerApi.bookPickup() to get a tracking number
//   4. Advances the order state to out_for_delivery in the DB
//   5. Sends the customer a WhatsApp message with the tracking link
//   6. Notifies the merchant

import { sql, redis, jsonb } from "@ace/shared/clients";
import { transition } from "../../state-machine/src/orderStateMachine";
import { sendCustomerMessage } from "../../comms-router/src/outbound";
import { bookPickup } from "./providerApi";
import type { OrderState } from "@ace/shared/types";
import P from "pino";

const logger = P({ level: "info" });

const STREAM_KEY = "stream:payments.verified";
const GROUP_NAME = "logistics-coordination";
const CONSUMER_NAME = `logistics-worker-${process.pid}`;

// ─── Bootstrap consumer group ─────────────────────────────────────────────────

async function ensureConsumerGroup() {
  try {
    await redis.xgroup("CREATE", STREAM_KEY, GROUP_NAME, "0", "MKSTREAM");
    logger.info({ stream: STREAM_KEY, group: GROUP_NAME }, "Consumer group created");
  } catch (err: any) {
    if (err?.message?.includes("BUSYGROUP")) {
      logger.info({ group: GROUP_NAME }, "Consumer group already exists");
    } else {
      throw err;
    }
  }
}

// ─── Main event loop ──────────────────────────────────────────────────────────

async function processLoop() {
  await ensureConsumerGroup();
  logger.info({ consumer: CONSUMER_NAME }, "Logistics coordination service started, listening for payments...");

  while (true) {
    try {
      // Blocking read — waits up to 5 seconds for a new message
      const results = await (redis as any).xreadgroup(
        "GROUP", GROUP_NAME, CONSUMER_NAME,
        "COUNT", "10",
        "BLOCK", "5000",
        "STREAMS", STREAM_KEY, ">",
      ) as [string, [string, string[]][]][] | null;

      if (!results) continue;

      for (const [, messages] of results) {
        for (const [msgId, fields] of messages) {
          try {
            await handlePaymentEvent(fields);
            await redis.xack(STREAM_KEY, GROUP_NAME, msgId);
          } catch (err) {
            logger.error({ err, msgId }, "Failed to process payment event — will retry");
            // Don't ack — Redis will redeliver after visibility timeout
          }
        }
      }
    } catch (err: any) {
      if (err?.code === "CONNECTION_CLOSED" || err?.message?.includes("ECONNRESET")) {
        logger.warn("Redis connection lost, retrying in 3s...");
        await new Promise((r) => setTimeout(r, 3000));
      } else {
        logger.error({ err }, "Unexpected loop error");
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
  }
}

// ─── Event handler ────────────────────────────────────────────────────────────

async function handlePaymentEvent(fields: string[]) {
  // Redis stream fields are flat key-value pairs: [key, val, key, val, ...]
  const data: Record<string, string> = {};
  for (let i = 0; i < fields.length; i += 2) {
    data[fields[i]] = fields[i + 1];
  }

  const { orderId, merchantId, customerId, phoneNumberId, amountNgn, itemsJson } = data;
  logger.info({ orderId, customerId }, "Processing verified payment for logistics dispatch");

  // Load the order from DB to get current state
  const rows = await sql<{ id: string; state: OrderState }[]>`
    select id, state from orders where id = ${orderId} limit 1
  `;
  const order = rows[0];
  if (!order) {
    logger.warn({ orderId }, "Order not found in DB — skipping logistics");
    return;
  }
  if (order.state.status !== "payment_verified") {
    logger.warn({ orderId, status: order.state.status }, "Order not in payment_verified state — skipping");
    return;
  }

  const items = JSON.parse(itemsJson ?? "[]");

  // ── Book a rider ───────────────────────────────────────────────────────────
  // TODO: fetch customer address from conversation context or ask the AI.
  // For now we use a placeholder; in Phase 2 the negotiator will call
  // collect_delivery_address before issue_payment_link.
  const customerAddress = await fetchCustomerAddress(customerId, merchantId) ?? "Customer will confirm address";

  let pickup;
  try {
    pickup = await bookPickup({
      orderId,
      merchantId,
      customerName: customerId,  // Will be replaced with real name once identity-resolution is live
      customerPhone: customerId,
      customerAddress,
      items,
      totalValueNgn: Number(amountNgn),
    });
    logger.info({ orderId, trackingNumber: pickup.trackingNumber, carrier: pickup.carrier }, "Rider booked");
  } catch (err) {
    logger.error({ orderId, err }, "Logistics API failed. Alerting merchant to manually dispatch.");
    
    // Alert the merchant via Vendor Communique (SMS/WhatsApp)
    const merchantRows = await sql<{contact_phone: string}[]>`select contact_phone from merchants where id = ${merchantId} limit 1`;
    const merchantPhone = merchantRows[0]?.contact_phone;
    if (merchantPhone) {
      const { vendorCommunique } = await import("../../comms-router/src/vendorCommunique.js");
      await vendorCommunique.dispatchEscalation(
        merchantId, 
        merchantPhone,
        customerId,
        "Logistics Booking Failed",
        { turn: null as any, arc: { sessionId: "LOGISTICS_FAIL", stage: "logistics" } as any } // Mock arc
      ).catch(() => {});
    }

    // Alert the customer
    await sendCustomerMessage({
      toPhone: customerId,
      text: `Your payment was verified, but our automated rider booking is currently experiencing issues. The vendor has been alerted and will manually dispatch your order shortly.`
    }, phoneNumberId, merchantId);

    // Advance order to a manual dispatch state
    const manualState = transition(order.state, { type: "RIDER_ASSIGNED", trackingUrl: "MANUAL_DISPATCH" });
    await sql`update orders set state = ${jsonb(manualState)}, updated_at = now() where id = ${orderId}`;
    return; // Stop processing, we handled the error
  }

  // ── Advance order state to out_for_delivery ────────────────────────────────
  const newState = transition(order.state, {
    type: "RIDER_ASSIGNED",
    trackingUrl: pickup.trackingUrl,
  });

  await sql`
    update orders
    set state = ${jsonb(newState)}, updated_at = now()
    where id = ${orderId}
  `;

  // ── Notify customer ────────────────────────────────────────────────────────
  await sendCustomerMessage(
    {
      toPhone: customerId,
      text:
        `🚚 Your order is packed and on the way!\n\n` +
        `Carrier: ${pickup.carrier}\n` +
        `Tracking: ${pickup.trackingUrl}\n` +
        `Estimated pickup: ~${pickup.estimatedPickupMinutes ?? 45} minutes\n\n` +
        `We'll send you a message when it's delivered. Thank you! 🎉`,
    },
    phoneNumberId,
    merchantId,
  );

  logger.info({ orderId }, "Logistics dispatch complete — customer notified");
}

// ─── Customer address helper ───────────────────────────────────────────────────
// Checks Redis for a cached delivery address the AI collected during conversation.

async function fetchCustomerAddress(customerId: string, merchantId: string): Promise<string | null> {
  const key = `delivery_address:${merchantId}:${customerId}`;
  return redis.get(key);
}

// ─── Boot ──────────────────────────────────────────────────────────────────────

processLoop().catch((err) => {
  logger.error({ err }, "Fatal logistics coordination error");
  process.exit(1);
});
