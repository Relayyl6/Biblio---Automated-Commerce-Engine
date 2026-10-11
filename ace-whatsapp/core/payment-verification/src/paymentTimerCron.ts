import { logger } from "@ace/shared/logger.js";
import { sql, redis, jsonb } from "@ace/shared/clients";
import { transition } from "../../state-machine/src/orderStateMachine";
import { sendCustomerMessage } from "../../comms-router/src/outbound";
import type { OrderState } from "@ace/shared/types";

// Runs every 5 minutes to check for expired AWAITING_PAYMENT orders
export function startPaymentTimerCron() {
  setInterval(checkExpiredPayments, 5 * 60 * 1000);
  logger.log("[payment-timer] Cron started. Checking every 5m for unpaid orders.");
}

async function checkExpiredPayments() {
  // Find orders that have been awaiting_payment for > 15 minutes
  // and we haven't already reminded them (we'll track reminders via a Redis flag)
  const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();

  try {
    const rows = await sql<{
      id: string;
      merchant_id: string;
      customer_id: string;
      state: OrderState;
      phone_number_id: string;
    }[]>`
      select o.id, o.merchant_id, o.customer_id, o.state, m.phone_number_id
      from orders o
      join merchants m on m.id = o.merchant_id
      where o.state->>'status' = 'awaiting_payment'
      and o.updated_at < ${fifteenMinsAgo}
    `;

    for (const order of rows) {
      const lockKey = `lock:payment_timer:${order.id}`;
      const lock = await redis.set(lockKey, "1", "EX", 30, "NX");
      if (!lock) continue;

      try {
        const reminderKey = `order_reminded:${order.id}`;
        const alreadyReminded = await redis.get(reminderKey);

        if (!alreadyReminded) {
          // Send reminder
          await sendCustomerMessage({
            toPhone: order.customer_id,
            text: "Hello! We noticed your payment for the order hasn't been completed yet. Please send the transfer so we can fulfill your order! 🙏"
          }, order.phone_number_id, order.merchant_id);
          
          await redis.set(reminderKey, "1", "EX", 60 * 60 * 24);
          logger.log(`[payment-timer] Sent payment reminder for order ${order.id}`);
        } else {
          // If already reminded and still unpaid, maybe cancel order?
          // Let's implement an auto-cancel if it's > 60 mins old.
          const sixtyMinsAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
          const isOlderThan60 = new Date((order as any).updated_at || 0) < new Date(Date.now() - 60 * 60 * 1000);
          
          if (isOlderThan60) {
            // Cancel order
            const newState = transition(order.state, { type: "PAYMENT_TIMEOUT" });
            await sql`update orders set state = ${jsonb(newState)}, updated_at = now() where id = ${order.id}`;
            await sendCustomerMessage({
              toPhone: order.customer_id,
              text: "Your order has been cancelled because the payment window expired. Please message us again to create a new order."
            }, order.phone_number_id, order.merchant_id);
            logger.log(`[payment-timer] Auto-cancelled order ${order.id} due to payment timeout`);
          }
        }
      } finally {
        await redis.del(lockKey);
      }
    }
  } catch (err) {
    logger.error("[payment-timer] Error running payment cron:", err);
  }
}

