// core/payment-verification/src/paymentService.ts
//
// The pure core of payment verification — the TypeScript stand-in for the Rust
// PaymentService in the README. Same discipline as pricingService.ts:
//
//   1. EVERY function here is PURE — no async, no DB, no Redis, no network.
//      The webhook handler (index.ts) does all the I/O and calls these.
//
//   2. SIGNATURE VERIFICATION IS CONSTANT-TIME. A naive `===` on the HMAC leaks
//      timing information an attacker can use to forge "payment confirmed"
//      events. crypto.timingSafeEqual closes that.
//
//   3. NORMALIZATION ISOLATES PROVIDER QUIRKS. Banks/PSPs each have their own
//      webhook shape (Paystack, Flutterwave, Mono, Providus via partner
//      FinTechs). This module flattens them into ONE NormalizedPayment so the
//      handler — and the state machine behind it — never sees a provider quirk.
//
// When this becomes the Rust service, each function maps to a Rust fn and the
// HTTP contract is: POST /payment/webhook → 200 ack; internally → PaymentVerified.

import crypto from "node:crypto";

// ─── Normalized payment event ──────────────────────────────────────────────────

/** A provider-agnostic credit event. Amount is always in whole NGN (not kobo). */
export interface NormalizedPayment {
  /** Unique provider reference — the idempotency key. Webhooks get redelivered. */
  providerRef: string;
  /** The virtual account number the funds were credited into. Matches an order. */
  virtualAccount: string;
  /** Amount paid, in NGN. */
  amountNgn: number;
}

// ─── Signature verification ─────────────────────────────────────────────────────

/**
 * Verify an HMAC-SHA256 signature over the raw request bytes. Tolerates a
 * leading "sha256=" prefix (GitHub/Meta style) and bare hex (Paystack style).
 *
 * IMPORTANT: pass the RAW body bytes, not a re-serialized JSON object — the
 * provider signed the exact bytes on the wire; re-stringifying changes them.
 */
export function verifyWebhookSignature(
  rawBody: Buffer,
  signatureHeader: string | undefined,
  secret: string,
): boolean {
  if (!signatureHeader || !secret) return false;

  const provided = signatureHeader.startsWith("sha256=")
    ? signatureHeader.slice("sha256=".length)
    : signatureHeader;

  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");

  // timingSafeEqual throws on unequal-length buffers, so length-check first.
  const a = Buffer.from(expected);
  const b = Buffer.from(provided);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

// ─── Provider payload normalization ─────────────────────────────────────────────

/**
 * Flatten a provider webhook body into a NormalizedPayment, or null if the body
 * isn't a credit event we can act on.
 *
 * Two shapes are understood out of the box:
 *
 *   (a) ACE canonical (what your bank-partner adapter should emit):
 *       { "reference": "...", "virtual_account": "90123...", "amount": 28500 }
 *       (amount in NGN; or "amount_kobo" for kobo)
 *
 *   (b) Paystack-style charge.success (concrete example — BIBLO lists Paystack):
 *       { "event": "charge.success",
 *         "data": { "reference": "...", "amount": 2850000,   // KOBO
 *                   "authorization": { "receiver_bank_account_number": "9012..." } } }
 *
 * Extend this function (not the handler) when you wire a new provider.
 */
export function normalizePaymentEvent(body: unknown): NormalizedPayment | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, any>;

  // (b) Paystack-style envelope: unwrap `data` and treat amount as kobo.
  if (typeof b.event === "string" && b.data && typeof b.data === "object") {
    if (b.event !== "charge.success") return null; // ignore refunds/transfers/etc. here
    const d = b.data as Record<string, any>;
    const ref = str(d.reference ?? d.id);
    const van = str(
      d.authorization?.receiver_bank_account_number ??
        d.virtual_account ??
        d.metadata?.virtual_account,
    );
    const amountNgn = koboToNgn(d.amount);
    if (!ref || !van || amountNgn === null) return null;
    return { providerRef: ref, virtualAccount: van, amountNgn };
  }

  // (a) ACE canonical.
  const ref = str(b.reference ?? b.ref ?? b.provider_ref);
  const van = str(b.virtual_account ?? b.virtualAccount ?? b.account_number);
  const amountNgn =
    b.amount_kobo !== undefined ? koboToNgn(b.amount_kobo) : toNumber(b.amount);
  if (!ref || !van || amountNgn === null) return null;
  return { providerRef: ref, virtualAccount: van, amountNgn };
}

// ─── Amount classification ──────────────────────────────────────────────────────

export type AmountMatch = "exact" | "overpaid" | "underpaid";

/**
 * Compare paid vs. owed. The order state machine already rejects underpayment on
 * PAYMENT_CONFIRMED; this classifier lets the handler choose the right customer
 * message (confirm vs. "please send the balance") and ledger status without
 * re-deriving the comparison.
 */
export function classifyAmount(paidNgn: number, owedNgn: number): AmountMatch {
  if (paidNgn < owedNgn) return "underpaid";
  if (paidNgn > owedNgn) return "overpaid";
  return "exact";
}

// ─── small helpers ──────────────────────────────────────────────────────────────

function str(v: unknown): string | null {
  if (typeof v === "string" && v.trim().length > 0) return v.trim();
  if (typeof v === "number") return String(v);
  return null;
}

function toNumber(v: unknown): number | null {
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? n : null;
}

function koboToNgn(v: unknown): number | null {
  const n = toNumber(v);
  return n === null ? null : n / 100;
}
