// core/state-machine/src/orderStateMachine.ts
//
// THE CORE IDEA: `transition` is a pure function. Given the current state
// and a proposed event, it returns either the new state or a
// TransitionError. It does NOT touch the database, NOT call WhatsApp,
// NOT call an LLM. That's deliberate — it's the one piece of this whole
// system you can unit-test with zero mocks, and the one piece where bugs
// are catastrophic (an illegal transition = money or inventory moving
// incorrectly).
//
// The ai-negotiator's job is to look at a ConversationTurn and PROPOSE an
// OrderEvent. This file's job is to be the skeptical gatekeeper that says
// "no, you can't mark payment confirmed from `draft` state — there's no
// virtual account to have been paid into."
//
// Why a switch-based reducer instead of a library like XState?
// XState is excellent and I'd reach for it once you have states with
// timers, parallel regions, or nested sub-machines (e.g. "awaiting_payment"
// containing its own "reminder sent / not sent" sub-state). For an order
// lifecycle that's fundamentally linear with one branch (cancellation), a
// hand-written switch is more transparent, has zero extra dependencies,
// and — critically for THIS file — gives you compiler-enforced
// exhaustiveness via the `assertNever` trick below. Revisit XState when
// `awaiting_payment` grows a reminder sub-state machine of its own.

import type { OrderState, OrderEvent } from "@ace/shared/types";

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
        "paid orders move to out_for_delivery via RIDER_ASSIGNED only",
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
      // Terminal states. Any event here is a no-op from the state
      // machine's perspective — but the CALLER (ai-negotiator) should
      // treat this as a signal that it's reasoning about stale state,
      // likely because two webhook deliveries raced. Surfacing it as an
      // error (rather than silently swallowing) makes that race visible
      // in your logs instead of hiding it.
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
import { redis, sql } from "@ace/shared/clients.js";

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
    await sql`
      UPDATE orders 
      SET state = ${sql.json(result as any)}, updated_at = NOW() 
      WHERE id = ${orderId}
    `;

    // Emit event
    if (event.type === "PAYMENT_CONFIRMED") {
      await redis.publish("events:payment_confirmed", JSON.stringify({
        merchantId, customerId, orderId, timestamp: Date.now()
      }));
    } else if (event.type as string === "ORDER_COMPLETED") {
      await redis.publish("events:order_completed", JSON.stringify({
        merchantId, customerId, orderId, timestamp: Date.now()
      }));
    } else if (event.type as string === "MARK_SHIPPED") {
       // Just as an example, this might trigger inventory deductions 
       // but typically those are explicit tool actions. 
    }
  }
  
  return result;
}
