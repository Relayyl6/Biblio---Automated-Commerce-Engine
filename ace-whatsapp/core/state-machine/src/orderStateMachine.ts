// core/state-machine/src/orderStateMachine.ts
//
// The deterministic control plane. The AI proposes; THIS approves or rejects.
// `transition` is a pure reducer: (state, event) → new state, or it throws a
// TransitionError for any illegal pairing. There is no I/O here — the caller
// loads the current state, calls transition, and persists the result.
//
// tools.ts is the consumer: it calls transition with QUOTE_CREATED (on
// close_deal) and PAYMENT_LINK_ISSUED (on issue_payment_link), and catches
// TransitionError. Event names/fields here match shared/src/types.ts.
//
// This is also the spec for the eventual Rust port: each `case` below maps to a
// Rust `match` arm. `assertNever` gives compile-time proof every state is
// handled.

import type {
  OrderState,
  OrderEvent,
  OrderStatus,
  OrderEventType,
} from "@ace/shared/types";

export class TransitionError extends Error {
  constructor(
    public readonly fromStatus: OrderStatus,
    public readonly eventType: OrderEventType,
    detail?: string,
  ) {
    super(
      `Illegal transition: cannot apply '${eventType}' to order in '${fromStatus}'` +
        (detail ? ` — ${detail}` : ""),
    );
    this.name = "TransitionError";
  }
}

export function transition(state: OrderState, event: OrderEvent): OrderState {
  switch (state.status) {
    case "no_order":
      // The only way to leave no_order is to create a quote → draft.
      if (event.type === "QUOTE_CREATED") {
        return {
          status: "draft",
          orderId: event.orderId,
          items: event.items,
          quotedTotal: event.total,
        };
      }
      throw new TransitionError(state.status, event.type);

    case "draft":
      if (event.type === "QUOTE_CREATED") {
        // Re-quoting (price changed / items changed) stays in draft.
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
      throw new TransitionError(state.status, event.type);

    case "awaiting_payment":
      if (event.type === "PAYMENT_CONFIRMED") {
        // Amount-match guard: never advance on an underpayment.
        if (event.amount < state.total) {
          throw new TransitionError(
            state.status,
            event.type,
            `paid ₦${event.amount} < order total ₦${state.total}`,
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
      if (event.type === "ORDER_CANCELLED") {
        return { status: "cancelled", orderId: state.orderId, reason: event.reason };
      }
      throw new TransitionError(state.status, event.type);

    case "payment_verified":
      if (event.type === "RIDER_ASSIGNED") {
        return {
          status: "out_for_delivery",
          orderId: state.orderId,
          items: state.items,
          riderTrackingUrl: event.trackingUrl,
        };
      }
      if (event.type === "ORDER_CANCELLED") {
        // Allowed pre-dispatch; downstream handles refund of the held escrow.
        return { status: "cancelled", orderId: state.orderId, reason: event.reason };
      }
      throw new TransitionError(state.status, event.type);

    case "out_for_delivery":
      if (event.type === "DELIVERY_CONFIRMED") {
        return {
          status: "delivered",
          orderId: state.orderId,
        };
      }
      if (event.type === "ORDER_CANCELLED") {
        return { status: "cancelled", orderId: state.orderId, reason: event.reason };
      }
      throw new TransitionError(state.status, event.type);

    case "delivered":
      // Terminal. (DISPUTED is a documented Phase-2 addition.)
      throw new TransitionError(state.status, event.type);

    case "cancelled":
      // Terminal.
      throw new TransitionError(state.status, event.type);

    default:
      return assertNever(state);
  }
}

export function assertNever(x: never): never {
  throw new Error(`Unreachable: unhandled variant ${JSON.stringify(x)}`);
}
