// core/payment-verification/src/escrowService.ts
//
// Escrow Settlement Engine for Biblio / ACE.
// Manages micro-escrow lifecycle for verified customer payments:
//   - 'held': funds secured in virtual account on order payment confirmation
//   - 'releasing': atomic lock during payout transfer initiation
//   - 'released': settlement swept to merchant's bank account (NUBAN) post-delivery
//   - 'disputed': dispute opened by customer/merchant within the 24hr inspection window
//   - 'refunding': atomic lock during customer refund processing
//   - 'refunded': funds returned to customer (dispute upheld or order cancelled)
//   - 'partially_released': split resolution between merchant and customer
//
// Prevents:
//   - Double-release attacks (concurrent delivery webhooks)
//   - Double-refund bugs
//   - Escrow release on failed transfers
//   - Missing columns / schema mismatches (order_id, merchant_id, customer_id)

import { sql, redis, jsonb } from "@ace/shared/clients";
import { logger } from "@ace/shared/logger.js";
import { dataIntelligence } from "@ace/shared/data-intelligence/engine";
import { ngnToKobo } from "./paymentService";

export type EscrowStatus =
  | "held"
  | "releasing"
  | "released"
  | "disputed"
  | "refunding"
  | "refunded"
  | "partially_released";

export interface EscrowRecord {
  id: string;
  order_id: string;
  merchant_id: string;
  customer_id: string;
  amount: number;
  status: EscrowStatus;
  held_at: string;
  auto_release_at: string | null;
  released_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface EscrowResult {
  success: boolean;
  status?: EscrowStatus;
  escrowId?: string;
  amount?: number;
  error?: string;
}

/**
 * Creates an escrow hold record for a verified order payment.
 * Holds funds for 24 hours post-delivery or configured hold window.
 */
export async function createEscrowHold(
  orderId: string,
  merchantId: string,
  customerId: string,
  amountNgn: number,
  holdHours: number = 24
): Promise<EscrowResult> {
  const cleanAmount = Math.round(amountNgn * 100) / 100;
  if (cleanAmount <= 0) {
    return { success: false, error: "Invalid escrow amount" };
  }

  try {
    // Check if escrow already exists for this order (idempotency)
    const existing = await sql<EscrowRecord[]>`
      SELECT * FROM escrow_accounts WHERE order_id = ${orderId} LIMIT 1
    `;
    if (existing.length > 0) {
      logger.log(`[Escrow] Hold already exists for order ${orderId} (Status: ${existing[0].status})`);
      return {
        success: true,
        status: existing[0].status,
        escrowId: existing[0].id,
        amount: Number(existing[0].amount),
      };
    }

    const autoReleaseAt = new Date(Date.now() + holdHours * 3600 * 1000).toISOString();

    const rows = await sql<EscrowRecord[]>`
      INSERT INTO escrow_accounts (
        order_id, merchant_id, customer_id, amount, status, held_at, auto_release_at, created_at, updated_at
      )
      VALUES (
        ${orderId}, ${merchantId}, ${customerId}, ${cleanAmount}, 'held', NOW(), ${autoReleaseAt}, NOW(), NOW()
      )
      RETURNING *
    `;

    logger.log(`[Escrow] Created hold of ₦${cleanAmount} for order ${orderId} (Escrow ID: ${rows[0].id})`);
    return {
      success: true,
      status: "held",
      escrowId: rows[0].id,
      amount: cleanAmount,
    };
  } catch (err: any) {
    logger.error(`[Escrow] Error creating escrow hold for order ${orderId}:`, err);
    return { success: false, error: err.message };
  }
}

/**
 * Releases escrow funds to the merchant post-delivery.
 * Atomically transitions status to 'releasing' to prevent double-release bugs.
 * Reverts to 'held' if the provider transfer fails.
 */
export async function releaseEscrow(
  orderId: string,
  options?: { triggeredBy?: string; amount?: number }
): Promise<EscrowResult> {
  const lockKey = `lock:escrow_release:${orderId}`;
  const lock = await redis.set(lockKey, "1", "EX", 30, "NX");
  if (!lock) {
    return { success: false, error: "Concurrent escrow release in progress" };
  }

  try {
    // 1. Fetch the held escrow record
    const rows = await sql<EscrowRecord[]>`
      SELECT * FROM escrow_accounts
      WHERE order_id = ${orderId} AND status IN ('held', 'disputed')
      LIMIT 1
    `;
    const escrow = rows[0];
    if (!escrow) {
      const anyEscrow = await sql<EscrowRecord[]>`
        SELECT * FROM escrow_accounts WHERE order_id = ${orderId} LIMIT 1
      `;
      if (anyEscrow.length > 0) {
        return {
          success: false,
          error: `Escrow cannot be released from current status: ${anyEscrow[0].status}`,
          status: anyEscrow[0].status,
        };
      }
      return { success: false, error: "No escrow account found for order" };
    }

    // 2. Atomic state transition: held -> releasing (Double-release protection)
    const transitionRows = await sql<EscrowRecord[]>`
      UPDATE escrow_accounts
      SET status = 'releasing', updated_at = NOW()
      WHERE id = ${escrow.id} AND status IN ('held', 'disputed')
      RETURNING id, amount, merchant_id
    `;
    if (transitionRows.length === 0) {
      return { success: false, error: "Escrow was released or modified concurrently" };
    }

    const payoutAmount = options?.amount ?? Number(escrow.amount);
    const merchantId = escrow.merchant_id;
    const priorStatus = escrow.status;

    // 3. Fetch merchant recipient code for Paystack sweep
    const merchantRows = await sql<{ paystack_recipient_code: string }[]>`
      SELECT paystack_recipient_code FROM merchants WHERE id = ${merchantId} LIMIT 1
    `;
    const recipientCode = merchantRows[0]?.paystack_recipient_code;

    const paystackSecretKey = process.env.PAYSTACK_SECRET_KEY;
    if (paystackSecretKey && recipientCode && !recipientCode.includes("your_")) {
      const koboAmount = ngnToKobo(payoutAmount);
      try {
        const transferRes = await fetch("https://api.paystack.co/transfer", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${paystackSecretKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            source: "balance",
            amount: koboAmount,
            recipient: recipientCode,
            reason: `Biblio Payout for Order ${orderId}`,
          }),
          signal: AbortSignal.timeout(8000),
        });

        if (!transferRes.ok) {
          const errText = await transferRes.text();
          logger.error(`[Escrow] Paystack transfer rejected (${transferRes.status}): ${errText}`);
          // Revert back to prior status so it is not permanently lost or falsely marked released
          await sql`
            UPDATE escrow_accounts
            SET status = ${priorStatus}, updated_at = NOW()
            WHERE id = ${escrow.id}
          `;
          return { success: false, error: `Transfer API failed: ${errText}` };
        }

        logger.log(`[Escrow] Paystack transfer initiated successfully for order ${orderId} (₦${payoutAmount})`);
      } catch (err: any) {
        logger.error(`[Escrow] Paystack transfer network error for order ${orderId}:`, err);
        // Revert to prior status
        await sql`
          UPDATE escrow_accounts
          SET status = ${priorStatus}, updated_at = NOW()
          WHERE id = ${escrow.id}
        `;
        return { success: false, error: `Transfer network error: ${err.message}` };
      }
    } else {
      logger.log(`[Escrow] Sandbox or missing recipient code for merchant ${merchantId}; skipping live NUBAN transfer`);
    }

    // 4. Mark released in database
    await sql`
      UPDATE escrow_accounts
      SET status = 'released', released_at = NOW(), updated_at = NOW()
      WHERE id = ${escrow.id}
    `;

    logger.log(`[Escrow] Escrow released successfully for order ${orderId} (Amount: ₦${payoutAmount})`);

    // Audit telemetry
    dataIntelligence.auditLog({
      service: "payment-verification",
      merchantId: escrow.merchant_id,
      action: "escrow_released",
      metadata: { orderId, escrowId: escrow.id, amount: payoutAmount, triggeredBy: options?.triggeredBy || "system" },
    }).catch(() => {});

    return { success: true, status: "released", escrowId: escrow.id, amount: payoutAmount };
  } finally {
    await redis.del(lockKey);
  }
}

/**
 * Customer or merchant raises a dispute on an order.
 * Transitions escrow status from 'held' to 'disputed'.
 * Prevents automated release while in dispute.
 */
export async function raiseDispute(
  orderId: string,
  reason: string,
  raisedBy: string
): Promise<EscrowResult> {
  const lockKey = `lock:escrow_dispute:${orderId}`;
  const lock = await redis.set(lockKey, "1", "EX", 30, "NX");
  if (!lock) return { success: false, error: "Dispute operation in progress" };

  try {
    const rows = await sql<EscrowRecord[]>`
      SELECT * FROM escrow_accounts WHERE order_id = ${orderId} LIMIT 1
    `;
    const escrow = rows[0];
    if (!escrow) return { success: false, error: "No escrow record found for order" };

    if (escrow.status === "released") {
      return { success: false, error: "Cannot dispute an escrow that has already been released to vendor" };
    }
    if (escrow.status === "refunded") {
      return { success: false, error: "Cannot dispute an escrow that has already been refunded" };
    }
    if (escrow.status === "disputed") {
      return { success: true, status: "disputed", escrowId: escrow.id, error: "Dispute is already open" };
    }

    const updated = await sql<EscrowRecord[]>`
      UPDATE escrow_accounts
      SET status = 'disputed', updated_at = NOW()
      WHERE id = ${escrow.id} AND status = 'held'
      RETURNING *
    `;

    if (updated.length === 0) {
      return { success: false, error: "Failed to open dispute — escrow status changed" };
    }

    logger.warn(`[Escrow] Dispute opened for order ${orderId} by ${raisedBy}: "${reason}"`);

    dataIntelligence.auditLog({
      service: "payment-verification",
      merchantId: escrow.merchant_id,
      action: "escrow_dispute_opened",
      metadata: { orderId, escrowId: escrow.id, reason, raisedBy },
    }).catch(() => {});

    return { success: true, status: "disputed", escrowId: escrow.id, amount: Number(escrow.amount) };
  } finally {
    await redis.del(lockKey);
  }
}

/**
 * Resolves an open dispute:
 *   - 'release_to_merchant': merchant fulfilled order, escrow sweeps to merchant
 *   - 'refund_to_customer': buyer complaint upheld, full refund to customer
 *   - 'split': partial release to vendor and partial refund to customer
 */
export async function resolveDispute(
  orderId: string,
  resolution: "release_to_merchant" | "refund_to_customer" | "split",
  splitOptions?: { merchantAmountNgn: number; customerAmountNgn: number }
): Promise<EscrowResult> {
  const lockKey = `lock:escrow_dispute_resolution:${orderId}`;
  const lock = await redis.set(lockKey, "1", "EX", 30, "NX");
  if (!lock) return { success: false, error: "Dispute resolution already in progress" };

  try {
    const rows = await sql<EscrowRecord[]>`
      SELECT * FROM escrow_accounts WHERE order_id = ${orderId} LIMIT 1
    `;
    const escrow = rows[0];
    if (!escrow) return { success: false, error: "No escrow found for order" };
    if (escrow.status !== "disputed") {
      return { success: false, error: `Escrow is not in disputed state (Current: ${escrow.status})` };
    }

    if (resolution === "release_to_merchant") {
      return await releaseEscrow(orderId, { triggeredBy: "dispute_resolution_merchant" });
    }

    if (resolution === "refund_to_customer") {
      return await refundEscrow(orderId, Number(escrow.amount), "dispute_resolved_customer");
    }

    if (resolution === "split") {
      if (!splitOptions) return { success: false, error: "Missing split amounts" };
      const { merchantAmountNgn, customerAmountNgn } = splitOptions;
      if (typeof merchantAmountNgn !== "number" || typeof customerAmountNgn !== "number") {
        return { success: false, error: "Invalid split amounts: numbers required" };
      }
      if (merchantAmountNgn < 0 || customerAmountNgn < 0) {
        return { success: false, error: "Split amounts cannot be negative" };
      }
      if (merchantAmountNgn === 0 && customerAmountNgn === 0) {
        return { success: false, error: "Total split amount must be greater than zero" };
      }

      const totalAmount = Number(escrow.amount);
      if (merchantAmountNgn + customerAmountNgn > totalAmount + 0.01) {
        return { success: false, error: "Split amounts exceed total escrow held balance" };
      }

      const paystackSecretKey = process.env.PAYSTACK_SECRET_KEY;

      // 1. Partial payout to merchant
      if (merchantAmountNgn > 0 && paystackSecretKey) {
        const merchantRows = await sql<{ paystack_recipient_code: string }[]>`
          SELECT paystack_recipient_code FROM merchants WHERE id = ${escrow.merchant_id} LIMIT 1
        `;
        const recipientCode = merchantRows[0]?.paystack_recipient_code;
        if (recipientCode && !recipientCode.includes("your_")) {
          try {
            const transferRes = await fetch("https://api.paystack.co/transfer", {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${paystackSecretKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                source: "balance",
                amount: ngnToKobo(merchantAmountNgn),
                recipient: recipientCode,
                reason: `Biblio Dispute Partial Settlement #${orderId}`,
              }),
              signal: AbortSignal.timeout(8000),
            });
            if (!transferRes.ok) {
              const errText = await transferRes.text();
              logger.error(`[Escrow] Partial split transfer to merchant rejected (${transferRes.status}): ${errText}`);
              return { success: false, error: `Merchant split payout failed: ${errText}` };
            }
          } catch (err: any) {
            logger.error(`[Escrow] Network error in merchant split payout:`, err);
            return { success: false, error: `Merchant split payout network error: ${err.message}` };
          }
        }
      }

      // 2. Partial refund to customer
      if (customerAmountNgn > 0 && paystackSecretKey) {
        const txRows = await sql<{ provider_ref: string }[]>`
          SELECT provider_ref FROM transactions WHERE order_id = ${orderId} LIMIT 1
        `;
        const providerRef = txRows[0]?.provider_ref;
        if (providerRef) {
          try {
            const refRes = await fetch("https://api.paystack.co/refund", {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${paystackSecretKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                transaction: providerRef,
                amount: ngnToKobo(customerAmountNgn),
                merchant_note: `Dispute Split Partial Refund for Order #${orderId}`,
              }),
              signal: AbortSignal.timeout(8000),
            });
            if (!refRes.ok) {
              const errText = await refRes.text();
              logger.error(`[Escrow] Customer split refund rejected (${refRes.status}): ${errText}`);
              return { success: false, error: `Customer split refund failed: ${errText}` };
            }
          } catch (err: any) {
            logger.error(`[Escrow] Customer split refund network error:`, err);
            return { success: false, error: `Customer split refund network error: ${err.message}` };
          }
        }
      }

      // Atomic update to partially_released
      await sql`
        UPDATE escrow_accounts
        SET status = 'partially_released', updated_at = NOW()
        WHERE id = ${escrow.id} AND status = 'disputed'
      `;

      logger.log(`[Escrow] Dispute resolved with split for order ${orderId}: Merchant: ₦${merchantAmountNgn}, Customer: ₦${customerAmountNgn}`);

      dataIntelligence.auditLog({
        service: "payment-verification",
        merchantId: escrow.merchant_id,
        action: "escrow_dispute_split_resolved",
        metadata: { orderId, escrowId: escrow.id, merchantAmountNgn, customerAmountNgn, totalAmount },
      }).catch(() => {});

      return { success: true, status: "partially_released", escrowId: escrow.id, amount: totalAmount };
    }

    return { success: false, error: "Unknown dispute resolution" };
  } finally {
    await redis.del(lockKey);
  }
}

/**
 * Refunds escrow funds back to customer (e.g. order cancelled or dispute upheld).
 * Protected against double-refund bugs.
 */
export async function refundEscrow(
  orderId: string,
  amountNgn?: number,
  reason: string = "order_cancelled"
): Promise<EscrowResult> {
  const lockKey = `lock:escrow_refund:${orderId}`;
  const lock = await redis.set(lockKey, "1", "EX", 30, "NX");
  if (!lock) return { success: false, error: "Concurrent refund in progress" };

  try {
    const rows = await sql<EscrowRecord[]>`
      SELECT * FROM escrow_accounts
      WHERE order_id = ${orderId} AND status IN ('held', 'disputed')
      LIMIT 1
    `;
    const escrow = rows[0];
    if (!escrow) {
      const any = await sql<EscrowRecord[]>`SELECT status FROM escrow_accounts WHERE order_id = ${orderId} LIMIT 1`;
      return { success: false, error: `Cannot refund escrow: current status is ${any[0]?.status || 'unknown'}` };
    }

    const priorStatus = escrow.status;

    // Double-refund guard: atomic transition to refunding
    const updated = await sql<EscrowRecord[]>`
      UPDATE escrow_accounts
      SET status = 'refunding', updated_at = NOW()
      WHERE id = ${escrow.id} AND status IN ('held', 'disputed')
      RETURNING *
    `;
    if (updated.length === 0) {
      return { success: false, error: "Escrow already modified or refunded" };
    }

    const refundAmount = amountNgn ?? Number(escrow.amount);

    // Call provider refund API if configured
    const paystackSecretKey = process.env.PAYSTACK_SECRET_KEY;
    if (paystackSecretKey) {
      try {
        const txRows = await sql<{ provider_ref: string }[]>`
          SELECT provider_ref FROM transactions WHERE order_id = ${orderId} LIMIT 1
        `;
        const providerRef = txRows[0]?.provider_ref;
        if (providerRef) {
          const refRes = await fetch("https://api.paystack.co/refund", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${paystackSecretKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              transaction: providerRef,
              amount: ngnToKobo(refundAmount),
              merchant_note: `Refund for Order #${orderId}: ${reason}`,
            }),
            signal: AbortSignal.timeout(8000),
          });
          if (!refRes.ok) {
            const errText = await refRes.text();
            logger.warn(`[Escrow] Paystack refund call returned status ${refRes.status}: ${errText}`);
            // Revert status to priorStatus
            await sql`
              UPDATE escrow_accounts
              SET status = ${priorStatus}, updated_at = NOW()
              WHERE id = ${escrow.id}
            `;
            return { success: false, error: `Refund API rejected: ${errText}` };
          }
        }
      } catch (err: any) {
        logger.error(`[Escrow] Paystack refund API error for order ${orderId}:`, err);
        // Revert status to priorStatus
        await sql`
          UPDATE escrow_accounts
          SET status = ${priorStatus}, updated_at = NOW()
          WHERE id = ${escrow.id}
        `;
        return { success: false, error: `Refund network error: ${err.message}` };
      }
    }

    // Finalize refund in DB
    await sql`
      UPDATE escrow_accounts
      SET status = 'refunded', updated_at = NOW()
      WHERE id = ${escrow.id}
    `;

    logger.log(`[Escrow] Escrow refunded for order ${orderId} (₦${refundAmount})`);

    // Synchronize order state to cancelled if not already cancelled
    try {
      const orderRows = await sql<{ id: string; state: any }[]>`
        SELECT id, state FROM orders WHERE id = ${orderId} LIMIT 1
      `;
      if (orderRows.length && orderRows[0].state?.status !== "cancelled") {
        await sql`
          UPDATE orders
          SET state = jsonb_set(COALESCE(state, '{}'::jsonb), '{status}', '"cancelled"'), updated_at = NOW()
          WHERE id = ${orderId}
        `;
      }
    } catch (orderUpdateErr) {
      logger.warn(`[Escrow] Could not update order state to cancelled for order ${orderId}:`, orderUpdateErr);
    }

    dataIntelligence.auditLog({
      service: "payment-verification",
      merchantId: escrow.merchant_id,
      action: "escrow_refunded",
      metadata: { orderId, escrowId: escrow.id, amount: refundAmount, reason },
    }).catch(() => {});

    return { success: true, status: "refunded", escrowId: escrow.id, amount: refundAmount };
  } finally {
    await redis.del(lockKey);
  }
}

/**
 * Auto-release cron worker: sweeps all 'held' escrows where auto_release_at <= NOW().
 * Runs periodically to release funds for completed orders with no disputes.
 */
export async function checkAutoReleaseEscrows(): Promise<number> {
  try {
    const expiredHolds = await sql<EscrowRecord[]>`
      SELECT * FROM escrow_accounts
      WHERE status = 'held' AND auto_release_at IS NOT NULL AND auto_release_at <= NOW()
      LIMIT 20
    `;

    let releasedCount = 0;
    for (const hold of expiredHolds) {
      const res = await releaseEscrow(hold.order_id, { triggeredBy: "auto_release_cron" });
      if (res.success) releasedCount++;
    }

    if (releasedCount > 0) {
      logger.log(`[EscrowCron] Auto-released ${releasedCount} eligible escrow accounts`);
    }
    return releasedCount;
  } catch (err) {
    logger.error("[EscrowCron] Error checking auto-release escrows:", err);
    return 0;
  }
}
