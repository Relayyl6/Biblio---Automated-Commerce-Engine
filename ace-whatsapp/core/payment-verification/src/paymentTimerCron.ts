// core/payment-verification/src/paymentTimerCron.ts
//
// Background payment timer and reservation manager:
//   1. Sends payment reminders for orders awaiting payment > 15m
//   2. Auto-cancels orders when payment window expires (> 60m or explicit expiresAt)
//   3. Restores inventory stock for uncancelled reservations
//   4. Resolves payment vs. cancellation race conditions at the boundary using unified locking
//   5. Triggers auto-release of mature 24hr escrow holds

import { logger } from "@ace/shared/logger.js";
import { sql, redis, jsonb } from "@ace/shared/clients";
import { transition } from "../../state-machine/src/orderStateMachine";
import { sendCustomerMessage } from "../../comms-router/src/outbound";
import type { OrderState } from "@ace/shared/types";
import { checkAutoReleaseEscrows } from "./escrowService";

let timerInterval: NodeJS.Timeout | null = null;

// Runs every 5 minutes to check for expired AWAITING_PAYMENT orders and mature escrows
export function startPaymentTimerCron() {
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(checkExpiredPayments, 5 * 60 * 1000);
  logger.log("[payment-timer] Cron started. Checking every 5m for unpaid orders and escrow auto-releases.");
}

export function stopPaymentTimerCron() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
    logger.log("[payment-timer] Cron stopped.");
  }
}

export async function checkExpiredPayments() {
  const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const nowMs = Date.now();

  try {
    // 1. Sweep mature micro-escrows (24h post-delivery auto-release)
    await checkAutoReleaseEscrows().catch(err =>
      logger.error("[payment-timer] checkAutoReleaseEscrows failed:", err)
    );

    // 2. Query open awaiting_payment orders
    const rows = await sql<{
      id: string;
      merchant_id: string;
      customer_id: string;
      state: OrderState;
      phone_number_id: string;
      updated_at: string;
      created_at: string;
    }[]>`
      select o.id, o.merchant_id, o.customer_id, o.state, o.updated_at, o.created_at, m.phone_number_id
      from orders o
      join merchants m on m.id = o.merchant_id
      where o.state->>'status' = 'awaiting_payment'
      and (
        o.updated_at < ${fifteenMinsAgo}
        or (
          o.state ? 'expiresAt'
          and (o.state->>'expiresAt') ~ '^[0-9]+$'
          and (o.state->>'expiresAt')::bigint <= ${nowMs}
        )
      )
    `;

    for (const order of rows) {
      // UNIFIED LOCK: Matches lock:payment:${orderId} in handlePayment to prevent race conditions
      // where customer pays at the exact moment the timer expires.
      const lockKey = `lock:payment:${order.id}`;
      const lock = await redis.set(lockKey, "1", "EX", 30, "NX");
      if (!lock) continue;

      try {
        // Re-verify current state under the lock to prevent acting on stale data
        const currentOrderRows = await sql<{ state: OrderState }[]>`
          select state from orders where id = ${order.id} limit 1
        `;
        const currentState = currentOrderRows[0]?.state;
        if (!currentState || currentState.status !== "awaiting_payment") {
          continue; // Order already transitioned (e.g. payment confirmed)
        }

        const reminderKey = `order_reminded:${order.id}`;
        const alreadyReminded = await redis.get(reminderKey);

        const explicitExpiresAt = (currentState as any).expiresAt;
        const isExpiredByTimestamp = explicitExpiresAt && nowMs > explicitExpiresAt;
        const isOlderThan60 = new Date(order.updated_at || order.created_at || 0).getTime() < (nowMs - 60 * 60 * 1000);

        if (!alreadyReminded && !isExpiredByTimestamp) {
          // Send reminder
          await sendCustomerMessage({
            toPhone: order.customer_id,
            text: "Hello! We noticed your payment for the order hasn't been completed yet. Please send the transfer so we can fulfill your order! 🙏"
          }, order.phone_number_id, order.merchant_id);
          
          await redis.set(reminderKey, "1", "EX", 60 * 60 * 24);
          logger.log(`[payment-timer] Sent payment reminder for order ${order.id}`);
        } else if (alreadyReminded || isExpiredByTimestamp) {
          if (isOlderThan60 || isExpiredByTimestamp) {
            // Transition state via state machine
            const newState = transition(currentState, { type: "PAYMENT_TIMEOUT" });

            // ATOMIC CONDITIONAL UPDATE: Only update if still awaiting_payment
            const cancelRows = await sql<{ id: string }[]>`
              update orders
              set state = ${jsonb(newState)}, updated_at = now()
              where id = ${order.id}
                and state->>'status' = 'awaiting_payment'
              returning id
            `;

            if (cancelRows.length === 0) {
              logger.log(`[payment-timer] Order ${order.id} was paid right at expiration boundary — cancel aborted`);
              continue;
            }

            // Restore reserved inventory stock
            const items = (currentState as any).items ?? [];
            for (const item of items) {
              if (item.sku && item.quantity > 0) {
                await sql`
                  UPDATE products
                  SET stock = stock + ${item.quantity}
                  WHERE sku = ${item.sku} AND merchant_id = ${order.merchant_id}
                `.catch(restockErr =>
                  logger.warn(`[payment-timer] Failed to restock SKU ${item.sku}:`, restockErr)
                );
              }
            }

            await sendCustomerMessage({
              toPhone: order.customer_id,
              text: "Your order has been cancelled because the payment window expired. Please message us again to create a new order."
            }, order.phone_number_id, order.merchant_id);

            logger.log(`[payment-timer] Auto-cancelled order ${order.id} due to payment timeout (Inventory restored)`);
          }
        }
      } catch (orderErr) {
        logger.error(`[payment-timer] Error processing order ${order.id}:`, orderErr);
      } finally {
        await redis.del(lockKey);
      }
    }
  } catch (err) {
    logger.error("[payment-timer] Error running payment cron:", err);
  }
}
