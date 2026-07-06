// Tests for the deterministic order state machine — the control plane that
// approves/rejects every order transition. These cover the legal happy path,
// the amount-match guard (the financial safety rule), and that every illegal
// (state, event) pairing throws TransitionError.

import { describe, it, expect } from "vitest";
import { transition, TransitionError } from "./orderStateMachine";
import type { OrderState, OrderEvent } from "@ace/shared/types";

const items = [{ sku: "BLK-001", name: "Black Gown", quantity: 2, unitPrice: 15000 }];

const noOrder: OrderState = { status: "no_order" };
const draft: OrderState = { status: "draft", orderId: "o1", items, quotedTotal: 28500 };
const awaiting: OrderState = {
  status: "awaiting_payment",
  orderId: "o1",
  items,
  total: 28500,
  virtualAccountNumber: "9876543210",
  expiresAt: 9_999_999_999_999,
};
const verified: OrderState = {
  status: "payment_verified",
  orderId: "o1",
  items,
  total: 28500,
  paidAt: 123456789,
};
const outForDelivery: OrderState = {
  status: "out_for_delivery",
  orderId: "o1",
  items,
  riderTrackingUrl: "track.me/r1",
};
const delivered: OrderState = {
  status: "delivered",
  orderId: "o1",
};
const cancelled: OrderState = { status: "cancelled", orderId: "o1", reason: "customer request" };

const quoteCreated: OrderEvent = { type: "QUOTE_CREATED", orderId: "o1", items, total: 28500 };

describe("transition — happy path (the full order lifecycle)", () => {
  it("no_order + QUOTE_CREATED → draft", () => {
    const next = transition(noOrder, quoteCreated);
    expect(next.status).toBe("draft");
    if (next.status === "draft") {
      expect(next.orderId).toBe("o1");
      expect(next.quotedTotal).toBe(28500);
    }
  });

  it("draft + PAYMENT_LINK_ISSUED → awaiting_payment (carries items/total forward)", () => {
    const next = transition(draft, {
      type: "PAYMENT_LINK_ISSUED",
      virtualAccountNumber: "9876543210",
      expiresAt: 123,
    });
    expect(next.status).toBe("awaiting_payment");
    if (next.status === "awaiting_payment") {
      expect(next.virtualAccountNumber).toBe("9876543210");
      expect(next.total).toBe(28500);
      expect(next.items).toEqual(items);
    }
  });

  it("awaiting_payment + PAYMENT_CONFIRMED (exact) → payment_verified", () => {
    const next = transition(awaiting, { type: "PAYMENT_CONFIRMED", amount: 28500, paidAt: 123456789 });
    expect(next.status).toBe("payment_verified");
    if (next.status === "payment_verified") expect(next.paidAt).toBe(123456789);
  });

  it("payment_verified + RIDER_ASSIGNED → out_for_delivery", () => {
    const next = transition(verified, { type: "RIDER_ASSIGNED", trackingUrl: "track.me/r1" });
    expect(next.status).toBe("out_for_delivery");
    if (next.status === "out_for_delivery") expect(next.riderTrackingUrl).toBe("track.me/r1");
  });

  it("out_for_delivery + DELIVERY_CONFIRMED → delivered", () => {
    const next = transition(outForDelivery, { type: "DELIVERY_CONFIRMED" });
    expect(next.status).toBe("delivered");
  });
});

describe("transition — re-quoting", () => {
  it("draft + QUOTE_CREATED stays draft with new figures", () => {
    const reItems = [{ sku: "BLK-001", name: "Black Gown", quantity: 3, unitPrice: 15000 }];
    const next = transition(draft, { type: "QUOTE_CREATED", orderId: "o1", items: reItems, total: 42000 });
    expect(next.status).toBe("draft");
    if (next.status === "draft") expect(next.quotedTotal).toBe(42000);
  });
});

describe("transition — the amount-match guard (financial safety)", () => {
  it("rejects underpayment: paid < total throws TransitionError", () => {
    expect(() => transition(awaiting, { type: "PAYMENT_CONFIRMED", amount: 20000, paidAt: 123 })).toThrow(
      TransitionError,
    );
  });

  it("accepts overpayment: paid > total advances (handler classifies the excess)", () => {
    const next = transition(awaiting, { type: "PAYMENT_CONFIRMED", amount: 30000, paidAt: 123 });
    expect(next.status).toBe("payment_verified");
    if (next.status === "payment_verified") expect(next.paidAt).toBe(123);
  });

  it("underpayment error carries fromStatus + eventType for debugging", () => {
    try {
      transition(awaiting, { type: "PAYMENT_CONFIRMED", amount: 1, paidAt: 123 });
      expect.unreachable("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(TransitionError);
      const te = e as TransitionError;
      expect(te.fromStatus).toBe("awaiting_payment");
      expect(te.eventType).toBe("PAYMENT_CONFIRMED");
    }
  });
});

describe("transition — cancellation is allowed pre-terminal", () => {
  it.each([
    ["draft", draft],
    ["awaiting_payment", awaiting],
    ["payment_verified", verified],
    ["out_for_delivery", outForDelivery],
  ] as const)("%s + ORDER_CANCELLED → cancelled", (_label, state) => {
    const next = transition(state, { type: "ORDER_CANCELLED", reason: "customer changed mind" });
    expect(next.status).toBe("cancelled");
    if (next.status === "cancelled") expect(next.reason).toBe("customer changed mind");
  });

  it("no_order + ORDER_CANCELLED is illegal (nothing to cancel)", () => {
    expect(() => transition(noOrder, { type: "ORDER_CANCELLED", reason: "no" })).toThrow(TransitionError);
  });
});

describe("transition — terminal states reject everything", () => {
  const everyEvent: OrderEvent[] = [
    quoteCreated,
    { type: "PAYMENT_LINK_ISSUED", virtualAccountNumber: "1", expiresAt: 1 },
    { type: "PAYMENT_CONFIRMED", amount: 1, paidAt: 123 },
    { type: "RIDER_ASSIGNED", trackingUrl: "1" },
    { type: "DELIVERY_CONFIRMED" },
    { type: "ORDER_CANCELLED", reason: "no" },
  ];

  it.each(everyEvent.map((e) => [e.type, e] as const))(
    "delivered rejects %s",
    (_t, event) => {
      expect(() => transition(delivered, event)).toThrow(TransitionError);
    },
  );

  it.each(everyEvent.map((e) => [e.type, e] as const))(
    "cancelled rejects %s",
    (_t, event) => {
      expect(() => transition(cancelled, event)).toThrow(TransitionError);
    },
  );
});

describe("transition — representative illegal pairings", () => {
  it("no_order cannot receive a payment", () => {
    expect(() => transition(noOrder, { type: "PAYMENT_CONFIRMED", amount: 1, paidAt: 1 })).toThrow(
      TransitionError,
    );
  });
  it("draft cannot be RIDER_ASSIGNED (must be paid first)", () => {
    expect(() => transition(draft, { type: "RIDER_ASSIGNED", trackingUrl: "track.me" })).toThrow(TransitionError);
  });
  it("awaiting_payment cannot be DELIVERED", () => {
    expect(() => transition(awaiting, { type: "DELIVERY_CONFIRMED" })).toThrow(
      TransitionError,
    );
  });
  it("payment_verified cannot re-confirm payment", () => {
    expect(() => transition(verified, { type: "PAYMENT_CONFIRMED", amount: 28500, paidAt: 123 })).toThrow(
      TransitionError,
    );
  });
});