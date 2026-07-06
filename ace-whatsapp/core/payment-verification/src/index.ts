// core/payment-verification/src/index.ts
//
// The bank/PSP front door. It does for payments what ingestion-service does for
// WhatsApp: verify the signature, ack fast, dedupe, then drive exactly one
// deterministic state transition. The merchant never opens their bank app.
//
// Flow for a credit webhook:
//   1. Verify HMAC over the raw bytes        (forged "paid" events are the threat)
//   2. Ack 200 immediately                   (providers retry on slow/non-2xx)
//   3. Normalize the provider payload        (paymentService — provider quirks isolated)
//   4. Idempotency dedupe on providerRef     (Redis SETNX; DB unique is the backstop)
//   5. Match the virtual account → order     (the awaiting_payment order)
//   6. Lock the order, apply PAYMENT_CONFIRMED through the state machine
//      → amount-match guard lives in orderStateMachine.transition, not here
//   7. Persist new state + write the ledger row + notify the customer
//
// Underpayment, an unmatched account, or a duplicate are all handled without
// throwing into the provider's HTTP path — they're recorded and surfaced.

import Fastify from "fastify";
import rawBody from "fastify-raw-body";
import { sql, redis, jsonb } from "@ace/shared/clients";
import type { OrderState } from "@ace/shared/types";
import { transition, TransitionError } from "../../state-machine/src/orderStateMachine";
import { sendCustomerMessage } from "../../comms-router/src/outbound";
import {
  verifyWebhookSignature,
  normalizePaymentEvent,
  classifyAmount,
  type NormalizedPayment,
} from "./paymentService";

const app = Fastify({ logger: true });

// Raw bytes needed for HMAC verification — a re-serialized body would not match
// what the provider signed. Opt-in per route via `config: { rawBody: true }`.
await app.register(rawBody, { global: false, runFirst: true });

const WEBHOOK_SECRET = process.env.PAYMENT_WEBHOOK_SECRET ?? "";
const LOCK_TTL_SECONDS = 30;

// ─── Webhook ────────────────────────────────────────────────────────────────────

app.post(
  "/payment/webhook",
  { config: { rawBody: true } },
  async (req, reply) => {
    const signature = (req.headers["x-ace-signature"] ??
      req.headers["x-paystack-signature"] ??
      req.headers["verif-hash"]) as string | undefined;

    if (!verifyWebhookSignature(req.rawBody as Buffer, signature, WEBHOOK_SECRET)) {
      return reply.code(401).send();
    }

    const body = JSON.parse((req.rawBody as Buffer).toString("utf-8"));
    const payment = normalizePaymentEvent(body);

    // Ack immediately — everything below is async-safe and idempotent.
    reply.code(200).send();

    if (!payment) {
      app.log.info("payment webhook ignored (not an actionable credit event)");
      return;
    }

    try {
      await handlePayment(payment);
    } catch (err) {
      // Never let a processing error escape into a retry storm — it's already
      // acked. Log loudly; the ledger/escalation is the durable record.
      app.log.error({ err, providerRef: payment.providerRef }, "payment handling failed");
    }
  },
);

// ─── Core handler ────────────────────────────────────────────────────────────────

async function handlePayment(payment: NormalizedPayment): Promise<void> {
  // Fast idempotency gate — webhooks get redelivered. The DB unique constraint
  // on transactions.provider_ref is the durable backstop.
  const dedupeKey = `idempotency:payment:${payment.providerRef}`;
  const isNew = await redis.set(dedupeKey, "1", "EX", 60 * 60 * 24, "NX");
  if (!isNew) {
    app.log.info({ providerRef: payment.providerRef }, "duplicate payment, skipping");
    return;
  }

  const order = await findOrderByVirtualAccount(payment.virtualAccount);

  if (!order) {
    // Money arrived for a VAN we can't match to an open order. Record it so it's
    // never silently lost, and flag it for manual reconciliation.
    app.log.warn({ payment }, "unmatched payment — no awaiting_payment order for VAN");
    await recordUnmatchedTransaction(payment);
    return;
  }

  // Serialize concurrent deliveries for the same order (two webhooks, a retry
  // racing the original). Whoever loses the lock simply returns — the winner's
  // transition is authoritative and the dedupe key already guards repeats.
  const lockKey = `lock:payment:${order.orderId}`;
  const lock = await redis.set(lockKey, "1", "EX", LOCK_TTL_SECONDS, "NX");
  if (!lock) {
    app.log.info({ orderId: order.orderId }, "payment lock contention — skipping");
    return;
  }

  try {
    let newState: OrderState;
    try {
      // The amount-match guard lives in the state machine: it throws if
      // paidAmount < total. We let it — that's the single source of truth.
      newState = transition(order.state, {
        type: "PAYMENT_CONFIRMED",
        amount: payment.amountNgn,
        paidAt: Date.now(),
      });
    } catch (err) {
      if (err instanceof TransitionError) {
        await handleUnderpayment(order, payment);
        return;
      }
      throw err;
    }

    // Persist the verified state, write the ledger row, and clear the payment
    // countdown timer — all in one transaction so the order and ledger agree.
    await sql.begin(async (tx) => {
      await tx`
        update orders set state = ${jsonb(newState)}, updated_at = now()
        where id = ${order.orderId}
      `;
      await tx`
        insert into transactions
          (order_id, merchant_id, customer_id, amount, virtual_account, provider_ref, status)
        values (
          ${order.orderId}, ${order.merchantId}, ${order.customerId},
          ${payment.amountNgn}, ${payment.virtualAccount}, ${payment.providerRef},
          ${classifyAmount(payment.amountNgn, order.total) === "overpaid" ? "overpaid" : "confirmed"}
        )
        on conflict (provider_ref) do nothing
      `;
    });
    await redis.del(`order:${order.orderId}:timer`);

    await sendCustomerMessage(
      {
        toPhone: order.customerId,
        text:
          `✅ Payment of ₦${payment.amountNgn.toLocaleString()} confirmed — thank you! ` +
          `Your order is now being prepared. We'll let you know the moment it's on the way. 🎉`,
      },
      order.phoneNumberId,
    );

    app.log.info({ orderId: order.orderId, amount: payment.amountNgn }, "payment verified");

    // PHASE 2: publish `payments.verified` to Kafka here. Logistics-coordination
    // consumes it to auto-book a rider (order → out_for_delivery), and the escrow
    // engine opens the 24h hold. For now the order rests at payment_verified.
  } finally {
    await redis.del(lockKey);
  }
}

// ─── Underpayment & unmatched ────────────────────────────────────────────────────

async function handleUnderpayment(order: MatchedOrder, payment: NormalizedPayment): Promise<void> {
  const balance = order.total - payment.amountNgn;
  await sql`
    insert into transactions
      (order_id, merchant_id, customer_id, amount, virtual_account, provider_ref, status)
    values (
      ${order.orderId}, ${order.merchantId}, ${order.customerId},
      ${payment.amountNgn}, ${payment.virtualAccount}, ${payment.providerRef}, 'underpaid'
    )
    on conflict (provider_ref) do nothing
  `;
  // Order stays in awaiting_payment — the customer still owes the balance.
  await sendCustomerMessage(
    {
      toPhone: order.customerId,
      text:
        `I've received ₦${payment.amountNgn.toLocaleString()}, but the order total is ` +
        `₦${order.total.toLocaleString()}. Please send the balance of ` +
        `₦${balance.toLocaleString()} to the same account to complete your order. 🙏`,
    },
    order.phoneNumberId,
  );
  app.log.warn({ orderId: order.orderId, balance }, "underpayment recorded");
}

async function recordUnmatchedTransaction(payment: NormalizedPayment): Promise<void> {
  // No order_id and no merchant context — record what we can for manual recon.
  // order_id is nullable; merchant_id is NOT NULL, so unmatched funds can't be
  // attributed to a merchant automatically. We log + escalate instead of forcing
  // a fake merchant_id. (Phase 2: a VAN→merchant registry resolves this.)
  app.log.error(
    { providerRef: payment.providerRef, virtualAccount: payment.virtualAccount, amount: payment.amountNgn },
    "UNMATCHED PAYMENT — manual reconciliation required",
  );
}

// ─── Order lookup ────────────────────────────────────────────────────────────────

interface MatchedOrder {
  orderId: string;
  merchantId: string;
  customerId: string;
  phoneNumberId: string;
  total: number;
  state: OrderState;
}

async function findOrderByVirtualAccount(van: string): Promise<MatchedOrder | null> {
  const rows = await sql<
    {
      id: string;
      merchant_id: string;
      customer_id: string;
      phone_number_id: string;
      state: OrderState;
    }[]
  >`
    select o.id, o.merchant_id, o.customer_id, m.phone_number_id, o.state
    from orders o
    join merchants m on m.id = o.merchant_id
    where o.state->>'virtualAccountNumber' = ${van}
      and o.state->>'status' = 'awaiting_payment'
    limit 1
  `;
  const row = rows[0];
  if (!row) return null;

  // Only awaiting_payment carries `total` + the VAN; narrow for the type.
  const state = row.state;
  if (state.status !== "awaiting_payment") return null;

  return {
    orderId: row.id,
    merchantId: row.merchant_id,
    customerId: row.customer_id,
    phoneNumberId: row.phone_number_id,
    total: state.total,
    state,
  };
}

// ─── Boot ────────────────────────────────────────────────────────────────────────

const port = Number(process.env.PAYMENT_PORT ?? 3002);
app.listen({ port, host: "0.0.0.0" }).then(() => {
  app.log.info(`payment-verification listening on :${port}`);
});
