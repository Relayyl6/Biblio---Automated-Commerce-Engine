// core/payment-verification/src/index.ts
//
// The bank/PSP front door. It does for payments what ingestion-service does for
// WhatsApp: verify the signature, ack fast, dedupe, then drive exactly one
// deterministic state transition. The merchant never opens their bank app.
//
// Flow for a credit webhook:
//   1. Verify HMAC / secret hash over raw bytes (prevents forged "paid" events)
//   2. Replay attack & duplicate prevention (Redis nonce + DB provider_ref constraint)
//   3. Ack 200 immediately (prevents retry storms)
//   4. Normalize provider payload (Paystack, Flutterwave, Monnify, OPay, Bank Transfers)
//   5. Match virtual account -> open awaiting_payment order
//   6. Lock order, apply PAYMENT_CONFIRMED via state machine
//   7. Persist verified state, create micro-escrow hold, notify customer, emit stream event

import Fastify from "fastify";
import rawBody from "fastify-raw-body";
import crypto from "node:crypto";
import { sql, redis, jsonb } from "@ace/shared/clients";
import { dataIntelligence } from "@ace/shared/data-intelligence/engine";
import { interactionFeedback } from "@ace/shared/feedback/interactionFeedback";
import type { OrderState } from "@ace/shared/types";

import { transition, TransitionError } from "../../state-machine/src/orderStateMachine";
import { sendCustomerMessage } from "../../comms-router/src/outbound";
import {
  verifyWebhookSignature,
  normalizePaymentEvent,
  classifyAmount,
  type NormalizedPayment,
} from "./paymentService";
import {
  createEscrowHold,
  releaseEscrow,
  raiseDispute,
  resolveDispute,
  refundEscrow,
} from "./escrowService";

export const app = Fastify({ logger: true });

await app.register(rawBody, { global: false, runFirst: true });

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY || process.env.PAYMENT_WEBHOOK_SECRET || "";
const FLUTTERWAVE_SECRET = process.env.FLUTTERWAVE_SECRET_HASH || process.env.PAYMENT_WEBHOOK_SECRET || "";
const MONNIFY_SECRET = process.env.MONNIFY_SECRET_KEY || process.env.PAYMENT_WEBHOOK_SECRET || "";
const OPAY_SECRET = process.env.OPAY_SECRET_KEY || process.env.PAYMENT_WEBHOOK_SECRET || "";
const CANONICAL_SECRET = process.env.PAYMENT_WEBHOOK_SECRET || "";
const LOGISTICS_SECRET = process.env.LOGISTICS_WEBHOOK_SECRET || process.env.PAYMENT_WEBHOOK_SECRET || "";

const LOCK_TTL_SECONDS = 30;

// ─── Health ───────────────────────────────────────────────────────────────────
app.get("/health", async () => ({ ok: true, service: "payment-verification" }));

// ─── Webhook ────────────────────────────────────────────────────────────────────

app.post(
  "/payment/webhook",
  { config: { rawBody: true } },
  async (req, reply) => {
    let signature = req.headers["x-ace-signature"] as string | undefined;
    let secret = CANONICAL_SECRET;
    let providerHint = "canonical";

    if (req.headers["x-paystack-signature"]) {
      signature = req.headers["x-paystack-signature"] as string;
      secret = PAYSTACK_SECRET;
      providerHint = "paystack";
    } else if (req.headers["verif-hash"]) {
      signature = req.headers["verif-hash"] as string;
      secret = FLUTTERWAVE_SECRET;
      providerHint = "flutterwave";
    } else if (req.headers["monnify-signature"]) {
      signature = req.headers["monnify-signature"] as string;
      secret = MONNIFY_SECRET;
      providerHint = "monnify";
    } else if (req.headers["x-opay-signature"]) {
      signature = req.headers["x-opay-signature"] as string;
      secret = OPAY_SECRET;
      providerHint = "opay";
    }

    const rawBuffer = req.rawBody as Buffer;
    if (!rawBuffer || !Buffer.isBuffer(rawBuffer)) {
      return reply.code(400).send({ error: "Missing raw request body" });
    }

    if (!verifyWebhookSignature(rawBuffer, signature, secret, providerHint)) {
      app.log.warn({ providerHint, signature: signature ? "provided" : "missing" }, "Webhook signature verification failed");
      return reply.code(401).send({ error: "Invalid webhook signature" });
    }

    // ── Replay Attack Prevention ──
    // 1. Exact raw payload hash dedupe gate (prevents rapid-fire identical payload replay storms)
    const payloadHash = crypto.createHash("sha256").update(rawBuffer).digest("hex");
    const payloadHashKey = `webhook:payment:payload_hash:${payloadHash}`;
    const isNewPayload = await redis.set(payloadHashKey, "1", "EX", 86400, "NX");
    if (!isNewPayload) {
      app.log.info({ payloadHash }, "Duplicate payment webhook payload hash detected in Redis cache — ignoring replay");
      return reply.code(200).send({ ok: true, duplicate: true });
    }

    let body: unknown;
    try {
      body = JSON.parse(rawBuffer.toString("utf-8"));
    } catch {
      app.log.warn("Invalid JSON in webhook payload");
      return reply.code(400).send({ error: "Invalid JSON payload" });
    }

    const payment = normalizePaymentEvent(body);

    if (!payment) {
      app.log.info("payment webhook ignored (not an actionable credit event or currency mismatch/zero amount)");
      return reply.code(200).send({ ok: true, ignored: true });
    }

    // 2. Provider reference cache dedupe gate (prevents duplicate processing of same ref)
    const replayKey = `webhook:payment:dedupe:${payment.providerRef}`;
    const isNew = await redis.set(replayKey, "1", "EX", 86400, "NX");
    if (!isNew) {
      app.log.info({ providerRef: payment.providerRef }, "Duplicate payment webhook detected in Redis cache — ignoring replay");
      return reply.code(200).send({ ok: true, duplicate: true });
    }

    // 3. Check durable DB transactions table — if reference already processed, do NOT reprocess or flag as unmatched
    const existingTx = await sql<{ id: string }[]>`
      SELECT id FROM transactions WHERE provider_ref = ${payment.providerRef} LIMIT 1
    `;
    if (existingTx.length > 0) {
      app.log.info({ providerRef: payment.providerRef }, "Duplicate payment webhook detected in DB — ignoring replay");
      return reply.code(200).send({ ok: true, duplicate: true });
    }

    // Ack 200 immediately to provider
    reply.code(200).send({ ok: true });

    try {
      await handlePayment(payment);
    } catch (err) {
      app.log.error({ err, providerRef: payment.providerRef }, "payment handling failed");
    }
  },
);

// ─── Core handler ────────────────────────────────────────────────────────────────

async function handlePayment(payment: NormalizedPayment): Promise<void> {
  const order = await findOrderByVirtualAccount(payment.virtualAccount);

  if (!order) {
    app.log.warn({ payment }, "unmatched payment — no awaiting_payment order for VAN");
    await recordUnmatchedTransaction(payment);
    return;
  }

  const lockKey = `lock:payment:${order.orderId}`;
  let lock: string | null = null;
  // Retry acquiring lock with brief backoff so transient cron/concurrency doesn't drop payment
  for (let attempt = 0; attempt < 5; attempt++) {
    lock = await redis.set(lockKey, "1", "EX", LOCK_TTL_SECONDS, "NX");
    if (lock) break;
    await new Promise((r) => setTimeout(r, 200));
  }

  if (!lock) {
    app.log.error({ orderId: order.orderId }, "Payment lock acquisition failed after retries — deferring to manual reconciliation");
    await recordUnmatchedTransaction(payment);
    return;
  }

  try {
    // Re-verify current order state under lock to prevent race condition with payment timer expiration
    const currentOrderRows = await sql<{
      id: string;
      merchant_id: string;
      customer_id: string;
      phone_number_id: string;
      state: OrderState;
    }[]>`
      SELECT o.id, o.merchant_id, o.customer_id, m.phone_number_id, o.state
      FROM orders o
      JOIN merchants m ON m.id = o.merchant_id
      WHERE o.id = ${order.orderId}
      LIMIT 1
    `;
    const currentOrder = currentOrderRows[0];
    if (!currentOrder) {
      await recordUnmatchedTransaction(payment);
      return;
    }

    // If order was cancelled right before or during lock acquisition
    if (currentOrder.state.status !== "awaiting_payment") {
      app.log.warn({ orderId: order.orderId, currentStatus: currentOrder.state.status }, "Order no longer awaiting_payment — recording transaction for review");
      await sql`
        insert into transactions
          (order_id, merchant_id, customer_id, amount, virtual_account, provider_ref, status)
        values (
          ${currentOrder.id}, ${currentOrder.merchant_id}, ${currentOrder.customer_id},
          ${payment.amountNgn}, ${payment.virtualAccount}, ${payment.providerRef}, 'expired_paid'
        )
        on conflict (provider_ref) do nothing
      `;
      // Create escrow hold so money is protected
      await createEscrowHold(currentOrder.id, currentOrder.merchant_id, currentOrder.customer_id, payment.amountNgn);
      return;
    }

    let newState: OrderState;
    try {
      newState = transition(currentOrder.state, {
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

    let updatedRows: { id: string }[] = [];
    await sql.begin(async (tx) => {
      updatedRows = await tx<{ id: string }[]>`
        update orders set state = ${jsonb(newState)}, updated_at = now()
        where id = ${order.orderId}
          and (state->>'status' != 'payment_verified' and state->>'status' != 'paid')
        returning id
      `;
      if (updatedRows.length === 0) return;

      const txRows = await tx<{ id: string }[]>`
        insert into transactions
          (order_id, merchant_id, customer_id, amount, virtual_account, provider_ref, status)
        values (
          ${order.orderId}, ${order.merchantId}, ${order.customerId},
          ${payment.amountNgn}, ${payment.virtualAccount}, ${payment.providerRef},
          ${classifyAmount(payment.amountNgn, order.total) === "overpaid" ? "overpaid" : "confirmed"}
        )
        on conflict (provider_ref) do nothing
        returning id
      `;

      // Dynamic Fee Padding & Escrow Hold Calculation
      const mFeeRows = await tx<{ platform_fee_percent: number; fee_padding_model: string }[]>`
        SELECT platform_fee_percent, fee_padding_model FROM merchants WHERE id = ${order.merchantId} LIMIT 1
      `;
      const feeModel = mFeeRows[0]?.fee_padding_model || "customer_padded";
      const biblioFeeRate = Number(mFeeRows[0]?.platform_fee_percent ?? 3.0) / 100.0;
      const vanFeeRate = 0.02; // Providus / Paystack VAN service fee

      let dealPrice = payment.amountNgn;
      if (feeModel === "customer_padded") {
        dealPrice = Math.round(payment.amountNgn / (1 + vanFeeRate + biblioFeeRate));
      } else {
        dealPrice = Math.round(payment.amountNgn * (1 - vanFeeRate - biblioFeeRate));
      }
      dealPrice = Math.max(1, dealPrice);

      // Create escrow hold with correct schema (order_id, merchant_id, customer_id, amount, status)
      if (txRows.length > 0) {
        await tx`
          insert into escrow_accounts (
            order_id, merchant_id, customer_id, amount, status, held_at, auto_release_at, created_at, updated_at
          )
          values (
            ${order.orderId}, ${order.merchantId}, ${order.customerId},
            ${dealPrice}, 'held', now(), now() + interval '24 hours', now(), now()
          )
          on conflict do nothing
        `;
      }
    });

    if (updatedRows.length === 0) {
      app.log.warn({ orderId: order.orderId }, "Duplicate payment webhook — order already marked paid, skipping");
      return;
    }

    await redis.del(`order:${order.orderId}:timer`);

    await sendCustomerMessage(
      {
        toPhone: order.customerId,
        text:
          `✅ Payment of ₦${payment.amountNgn.toLocaleString()} confirmed — thank you! ` +
          `Your order is now being prepared. We'll let you know the moment it's on the way. 🎉`,
      },
      order.phoneNumberId,
      order.merchantId
    );

    app.log.info({ orderId: order.orderId, amount: payment.amountNgn }, "payment verified");

    // Telemetry
    dataIntelligence.captureOrderStateChange({
      merchantId: order.merchantId,
      customerId: order.customerId,
      orderId: order.orderId,
      fromState: "awaiting_payment",
      toState: "payment_verified",
      timestamp: Date.now(),
    }).catch(err => app.log.error({ err, merchantId: order.merchantId, orderId: order.orderId }, "Telemetry captureOrderStateChange failed"));

    // Close RL Bandit & RAG Learning Feedback Loop
    interactionFeedback.recordOrderOutcome({
      merchantId: order.merchantId,
      customerId: order.customerId,
      outcome: 'completed_discount',
      marginRealized: payment.amountNgn,
      finalPrice: payment.amountNgn,
    }).catch(err => app.log.error({ err, orderId: order.orderId }, "interactionFeedback.recordOrderOutcome failed"));

    // Publish to Redis Stream so logistics-coordination can auto-book a rider
    await redis.xadd("stream:payments.verified", "*",
      "orderId", order.orderId,
      "merchantId", order.merchantId,
      "customerId", order.customerId,
      "phoneNumberId", order.phoneNumberId,
      "amountNgn", String(payment.amountNgn),
      "itemsJson", JSON.stringify((newState as any).items ?? []),
    );
  } finally {
    await redis.del(lockKey);
  }
}

// ─── Underpayment & unmatched ────────────────────────────────────────────────────

async function handleUnderpayment(order: MatchedOrder, payment: NormalizedPayment): Promise<void> {
  await sql`
    insert into transactions
      (order_id, merchant_id, customer_id, amount, virtual_account, provider_ref, status)
    values (
      ${order.orderId}, ${order.merchantId}, ${order.customerId},
      ${payment.amountNgn}, ${payment.virtualAccount}, ${payment.providerRef}, 'underpaid'
    )
    on conflict (provider_ref) do nothing
  `;

  const rows = await sql`
    SELECT SUM(amount) as sum FROM transactions WHERE order_id = ${order.orderId} AND status != 'failed'
  `;
  const totalPaid = parseInt(rows[0]?.sum ?? "0", 10);
  const balance = order.total - totalPaid;

  dataIntelligence.auditLog({
    service: "payment-verification",
    merchantId: order.merchantId,
    action: "underpayment_detected",
    metadata: {
      orderId: order.orderId,
      customerId: order.customerId,
      expected: order.total,
      received: payment.amountNgn,
      balance,
    },
  }).catch(err => app.log.error({ err, orderId: order.orderId, merchantId: order.merchantId }, "Telemetry auditLog for underpayment failed"));

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
  app.log.error(
    { providerRef: payment.providerRef, virtualAccount: payment.virtualAccount, amount: payment.amountNgn },
    "UNMATCHED PAYMENT — manual reconciliation required",
  );

  dataIntelligence.auditLog({
    service: "payment-verification",
    merchantId: "unmatched",
    action: "unmatched_van_payment",
    metadata: {
      providerRef: payment.providerRef,
      virtualAccount: payment.virtualAccount,
      amount: payment.amountNgn,
    },
  }).catch(err => app.log.error({ err, providerRef: payment.providerRef }, "Telemetry auditLog for unmatched payment failed"));
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

// ─── Logistics Webhook (Escrow Payout) ───────────────────────────────────────

app.post("/logistics/webhook", { config: { rawBody: true } }, async (req, reply) => {
  const signature = (req.headers["x-signature"] ??
    req.headers["x-webhook-signature"] ??
    req.headers["x-ace-signature"]) as string | undefined;

  if (LOGISTICS_SECRET && signature) {
    const raw = req.rawBody as Buffer || Buffer.from(JSON.stringify(req.body));
    if (!verifyWebhookSignature(raw, signature, LOGISTICS_SECRET)) {
      return reply.code(401).send({ error: "Invalid logistics webhook signature" });
    }
  }

  const b = req.body as Record<string, any>;
  const orderId = b.orderId;
  const status = b.status; // e.g. "delivered"
  
  if (status !== "delivered" || !orderId) {
    return reply.send({ ok: true, ignored: true });
  }

  // Idempotency: prevent duplicate webhook handling
  const dedupeKey = `webhook:logistics:delivered:${orderId}`;
  const isNew = await redis.set(dedupeKey, "1", "EX", 86400, "NX");
  if (!isNew) {
    return reply.send({ ok: true, duplicate: true });
  }

  // 1. Advance state to DELIVERY_CONFIRMED
  const lockKey = `lock:delivery:${orderId}`;
  const lock = await redis.set(lockKey, "1", "EX", 30, "NX");
  if (!lock) return reply.send({ ok: true, status: "locked" });

  try {
    const rows = await sql<{ id: string; merchant_id: string; customer_id: string; state: OrderState }[]>`
      select id, merchant_id, customer_id, state from orders where id = ${orderId} limit 1
    `;
    const order = rows[0];
    if (!order || order.state.status !== "out_for_delivery") {
      return reply.send({ ok: true, ignored: true });
    }

    const newState = transition(order.state, { type: "DELIVERY_CONFIRMED" });

    // 2. Release Escrow via EscrowService (Atomic lock, NUBAN transfer, double-release protection)
    const escrowResult = await releaseEscrow(orderId, { triggeredBy: "logistics_webhook" });
    if (!escrowResult.success) {
      app.log.warn({ orderId, error: escrowResult.error }, "Escrow release warning on logistics delivery webhook");
    }

    // 3. Save final state
    await sql`
      update orders set state = ${jsonb(newState)}, updated_at = now()
      where id = ${orderId}
    `;

    return reply.send({ ok: true, escrowReleased: escrowResult.success });
  } finally {
    await redis.del(lockKey);
  }
});

// ─── Escrow Management Endpoints ─────────────────────────────────────────────

app.post("/escrow/release", async (req, reply) => {
  const { orderId } = req.body as { orderId: string };
  if (!orderId) return reply.code(400).send({ error: "Missing orderId" });
  const result = await releaseEscrow(orderId, { triggeredBy: "merchant_api" });
  return reply.code(result.success ? 200 : 400).send(result);
});

app.post("/escrow/dispute", async (req, reply) => {
  const { orderId, reason, raisedBy } = req.body as { orderId: string; reason: string; raisedBy: string };
  if (!orderId || !reason) return reply.code(400).send({ error: "Missing orderId or reason" });
  const result = await raiseDispute(orderId, reason, raisedBy || "customer");
  return reply.code(result.success ? 200 : 400).send(result);
});

app.post("/escrow/resolve-dispute", async (req, reply) => {
  const { orderId, resolution, splitOptions } = req.body as {
    orderId: string;
    resolution: "release_to_merchant" | "refund_to_customer" | "split";
    splitOptions?: { merchantAmountNgn: number; customerAmountNgn: number };
  };
  if (!orderId || !resolution) return reply.code(400).send({ error: "Missing orderId or resolution" });
  const result = await resolveDispute(orderId, resolution, splitOptions);
  return reply.code(result.success ? 200 : 400).send(result);
});

app.post("/escrow/refund", async (req, reply) => {
  const { orderId, amount, reason } = req.body as { orderId: string; amount?: number; reason?: string };
  if (!orderId) return reply.code(400).send({ error: "Missing orderId" });
  const result = await refundEscrow(orderId, amount, reason);
  return reply.code(result.success ? 200 : 400).send(result);
});

app.get("/escrow/:orderId", async (req, reply) => {
  const { orderId } = req.params as { orderId: string };
  const rows = await sql`SELECT * FROM escrow_accounts WHERE order_id = ${orderId} LIMIT 1`;
  if (rows.length === 0) return reply.code(404).send({ error: "Escrow not found" });
  return reply.send({ ok: true, escrow: rows[0] });
});

// ─── Boot ────────────────────────────────────────────────────────────────────────

import { startPaymentTimerCron } from "./paymentTimerCron";

const port = Number(process.env.PAYMENT_PORT ?? 3002);

const isMain = Boolean(
  process.argv[1] &&
  (import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/")) ||
   process.argv[1].replace(/\\/g, "/").includes("payment-verification/src/index"))
);

if (isMain || process.env.AUTO_START_PAYMENT) {
  app.listen({ port, host: "0.0.0.0" }).then(() => {
    app.log.info(`payment-verification listening on :${port}`);
    startPaymentTimerCron();
  });
}
