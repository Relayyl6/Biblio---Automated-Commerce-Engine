// core/state-machine/src/orderStateMachine.ts
//
// THE CORE IDEA: `transition` is a pure function. Given the current state
// and a proposed event, it returns either the new state or a
// TransitionError. It does NOT touch the database, NOT call WhatsApp,
// NOT call an LLM. That's deliberate — it's the one piece of this whole
// system you can unit-test with zero mocks, and the one piece where bugs
// are catastrophic (an illegal transition = money or inventory moving
// incorrectly).

import type { OrderState, OrderEvent } from "@ace/shared/types";
import { redis, sql } from "@ace/shared/clients.js";
import { Queue } from "bullmq";

export class TransitionError extends Error {
  constructor(
    public readonly fromStatus: OrderState["status"],
    public readonly eventType: OrderEvent["type"],
    reason: string,
  ) {
    super(
      `Illegal transition: ${eventType} from state ${fromStatus} — ${reason}`,
    );
    this.name = "TransitionError";
  }
}

/** Exhaustiveness helper: if a switch is missing a case, this line fails
 *  to compile because `x` can't be `never`. Delete a case above and you'll
 *  get a compile error pointing exactly here — that's the safety net. */
function assertNever(x: never): never {
  throw new Error(`Unhandled case: ${JSON.stringify(x)}`);
}

export function transition(
  state: OrderState,
  event: OrderEvent,
): OrderState {
  switch (state.status) {
    case "no_order": {
      if (event.type === "QUOTE_CREATED") {
        return {
          status: "draft",
          orderId: event.orderId,
          items: event.items,
          quotedTotal: event.total,
          fulfillmentType: event.fulfillmentType || "delivery",
          deliveryAddress: event.deliveryAddress,
          pickupAddress: event.pickupAddress,
        };
      }
      throw new TransitionError(
        state.status,
        event.type,
        "no order exists yet — only QUOTE_CREATED is valid here",
      );
    }

    case "draft": {
      if (event.type === "QUOTE_CREATED") {
        return {
          status: "draft",
          orderId: event.orderId,
          items: event.items,
          quotedTotal: event.total,
          fulfillmentType: event.fulfillmentType || state.fulfillmentType || "delivery",
          deliveryAddress: event.deliveryAddress || state.deliveryAddress,
          pickupAddress: event.pickupAddress || state.pickupAddress,
        };
      }
      if (event.type === "PAYMENT_LINK_ISSUED") {
        return {
          status: "awaiting_payment",
          orderId: state.orderId,
          items: state.items,
          total: state.quotedTotal,
          virtualAccountNumber: event.virtualAccountNumber,
          expiresAt: event.expiresAt,
          fulfillmentType: state.fulfillmentType || "delivery",
          deliveryAddress: state.deliveryAddress,
          pickupAddress: state.pickupAddress,
        };
      }
      if (event.type === "ORDER_CANCELLED") {
        return { status: "cancelled", orderId: state.orderId, reason: event.reason };
      }
      throw new TransitionError(
        state.status,
        event.type,
        "draft orders can only get a payment link or be cancelled",
      );
    }

    case "awaiting_payment": {
      if (event.type === "PAYMENT_CONFIRMED") {
        if (event.amount < state.total) {
          throw new TransitionError(
            state.status,
            event.type,
            `amount mismatch: expected ${state.total}, got ${event.amount}`,
          );
        }
        return {
          status: "payment_verified",
          orderId: state.orderId,
          items: state.items,
          total: state.total,
          paidAt: event.paidAt,
          fulfillmentType: state.fulfillmentType || "delivery",
          deliveryAddress: state.deliveryAddress,
          pickupAddress: state.pickupAddress,
        };
      }
      if (event.type === "PAYMENT_TIMEOUT") {
        return {
          status: "cancelled",
          orderId: state.orderId,
          reason: "payment window expired",
        };
      }
      if (event.type === "ORDER_CANCELLED") {
        return { status: "cancelled", orderId: state.orderId, reason: event.reason };
      }
      throw new TransitionError(
        state.status,
        event.type,
        "awaiting_payment can only resolve to payment_verified, timeout, or cancellation",
      );
    }

    case "payment_verified": {
      if (event.type === "ORDER_READY_FOR_PICKUP") {
        return {
          status: "ready_for_pickup",
          orderId: state.orderId,
          items: state.items,
          total: state.total,
          paidAt: state.paidAt,
          pickupCode: event.pickupCode,
          pickupAddress: event.pickupAddress || state.pickupAddress || "Merchant Store Location",
        };
      }
      if (event.type === "PICKUP_CONFIRMED") {
        return { status: "delivered", orderId: state.orderId };
      }
      if (event.type === "RIDER_ASSIGNED") {
        return {
          status: "out_for_delivery",
          orderId: state.orderId,
          items: state.items,
          riderTrackingUrl: event.trackingUrl,
        };
      }
      if (event.type === "ORDER_CANCELLED") {
        return { status: "cancelled", orderId: state.orderId, reason: event.reason };
      }
      throw new TransitionError(
        state.status,
        event.type,
        "paid orders move to out_for_delivery via RIDER_ASSIGNED, or to ready_for_pickup/delivered for store pickup",
      );
    }

    case "ready_for_pickup": {
      if (event.type === "PICKUP_CONFIRMED") {
        return { status: "delivered", orderId: state.orderId };
      }
      if (event.type === "ORDER_CANCELLED") {
        return { status: "cancelled", orderId: state.orderId, reason: event.reason };
      }
      throw new TransitionError(
        state.status,
        event.type,
        "ready_for_pickup orders can only transition to delivered via PICKUP_CONFIRMED or cancelled",
      );
    }

    case "out_for_delivery": {
      if (event.type === "DELIVERY_CONFIRMED") {
        return { status: "delivered", orderId: state.orderId };
      }
      if (event.type === "ORDER_CANCELLED") {
        return { status: "cancelled", orderId: state.orderId, reason: event.reason };
      }
      throw new TransitionError(
        state.status,
        event.type,
        "out_for_delivery can only resolve to delivered",
      );
    }

    case "delivered":
    case "cancelled": {
      throw new TransitionError(
        state.status,
        event.type,
        "order is in a terminal state — no further transitions allowed",
      );
    }

    default:
      return assertNever(state);
  }
}

const domainEventsQueue = new Queue("domain-events", {
  connection: { ...redis.options, maxRetriesPerRequest: null }
});

/**
 * Wraps the pure transition function to automatically save to DB and emit to Redis Pub/Sub.
 */
export async function transitionAndEmit(
  merchantId: string, 
  customerId: string, 
  orderId: string,
  currentState: OrderState, 
  event: OrderEvent
): Promise<OrderState | TransitionError> {
  const result = transition(currentState, event);
  
  if (!("code" in result)) {
    // It's a successful transition
    try {
      await sql`UPDATE orders SET state = ${sql.json(result as any)}, updated_at = NOW() WHERE id = ${orderId}`;
    } catch (err) {
      throw new Error(`Failed to update order state in DB: ${err}`);
    }

    // Emit event
    try {
      if (event.type === "PAYMENT_CONFIRMED") {
        await domainEventsQueue.add("payment_confirmed", { merchantId, customerId, orderId, timestamp: Date.now() }, { attempts: 5, backoff: { type: "exponential", delay: 2000 } });
      } else if ((event.type as string) === "ORDER_COMPLETED" || event.type === "PICKUP_CONFIRMED" || event.type === "DELIVERY_CONFIRMED") {
        await domainEventsQueue.add("order_completed", { merchantId, customerId, orderId, timestamp: Date.now() }, { attempts: 5, backoff: { type: "exponential", delay: 2000 } });
      }
    } catch (err) {
      console.error(`[orderStateMachine] Redis publish failed for event ${event.type}:`, err);
    }
  }
  
  return result;
}
