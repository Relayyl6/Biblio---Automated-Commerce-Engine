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
//      webhook shape (Paystack, Flutterwave, Monnify, OPay, Bank Transfers via
//      Providus/Wema). This module flattens them into ONE NormalizedPayment so the
//      handler — and the state machine behind it — never sees a provider quirk.
//
//   4. INTEGER KOBO & FLOAT PRECISION SAFETY. Amounts are processed in whole
//      kobo internally to eliminate JavaScript floating point drift
//      (e.g. 2850.10 * 100 !== 285010 without Math.round).

import crypto from "node:crypto";

// ─── Normalized payment event ──────────────────────────────────────────────────

export type PaymentProvider =
  | "paystack"
  | "flutterwave"
  | "monnify"
  | "opay"
  | "bank_transfer"
  | "canonical";

/** A provider-agnostic credit event. Amount is always in whole NGN (not kobo). */
export interface NormalizedPayment {
  /** Unique provider reference — the idempotency key. Webhooks get redelivered. */
  providerRef: string;
  /** The virtual account number the funds were credited into. Matches an order. */
  virtualAccount: string;
  /** Amount paid, in NGN. */
  amountNgn: number;
  /** Detected or declared provider source. */
  provider?: PaymentProvider;
  /** Timestamp of the transaction in ms, if provided by provider. */
  timestamp?: number;
}

// ─── Signature verification ─────────────────────────────────────────────────────

/**
 * Verify a webhook signature over the raw request bytes across all supported providers.
 * Supports:
 *   - Paystack: HMAC-SHA512 (official) and HMAC-SHA256 (testing/legacy)
 *   - Flutterwave: direct secret hash match (verif-hash) in constant time
 *   - Monnify: HMAC-SHA512
 *   - OPay: HMAC-SHA512 and HMAC-SHA256
 *   - Bank Transfer / ACE Canonical: HMAC-SHA256
 *
 * IMPORTANT: pass the RAW body bytes, not a re-serialized JSON object — the
 * provider signed the exact bytes on the wire; re-stringifying changes them.
 */
export function verifyWebhookSignature(
  rawBody: Buffer,
  signatureHeader: string | undefined,
  secret: string,
  provider?: PaymentProvider | string,
): boolean {
  if (!rawBody || !Buffer.isBuffer(rawBody) || !signatureHeader || !secret) return false;

  const trimmedHeader = signatureHeader.trim();
  const trimmedSecret = secret.trim();
  if (trimmedHeader.length === 0 || trimmedSecret.length === 0) return false;

  // 1. Direct Secret Hash Match (Flutterwave `verif-hash` model)
  // Constant-time comparison between provided secret hash and configured secret
  if (provider === "flutterwave") {
    const a = Buffer.from(trimmedHeader, "utf-8");
    const b = Buffer.from(trimmedSecret, "utf-8");
    if (a.length === b.length && crypto.timingSafeEqual(a, b)) {
      return true;
    }
    return false;
  }

  // Clean common prefixes
  const providedSig = trimmedHeader
    .replace(/^sha256=/i, "")
    .replace(/^sha512=/i, "")
    .toLowerCase();

  // 2. HMAC-SHA512 check (Paystack official, Monnify, OPay)
  try {
    const expected512 = crypto
      .createHmac("sha512", trimmedSecret)
      .update(rawBody)
      .digest("hex")
      .toLowerCase();

    const a512 = Buffer.from(expected512, "utf-8");
    const b512 = Buffer.from(providedSig, "utf-8");
    if (a512.length === b512.length && crypto.timingSafeEqual(a512, b512)) {
      return true;
    }
  } catch {
    // Continue to SHA256 check
  }

  // 3. HMAC-SHA256 check (ACE canonical, Paystack test/fallback, OPay)
  try {
    const expected256 = crypto
      .createHmac("sha256", trimmedSecret)
      .update(rawBody)
      .digest("hex")
      .toLowerCase();

    const a256 = Buffer.from(expected256, "utf-8");
    const b256 = Buffer.from(providedSig, "utf-8");
    if (a256.length === b256.length && crypto.timingSafeEqual(a256, b256)) {
      return true;
    }
  } catch {
    // Signature check failed
  }

  return false;
}

// ─── Provider payload normalization ─────────────────────────────────────────────

/** Validates that currency is NGN / 566 or default Nigerian Naira. Rejects foreign currencies. */
export function isNgnCurrency(curr: unknown): boolean {
  if (curr === undefined || curr === null || curr === "") return true;
  const s = String(curr).trim().toUpperCase();
  return s === "NGN" || s === "566";
}

/**
 * Flatten a provider webhook body into a NormalizedPayment, or null if the body
 * isn't an actionable credit event.
 *
 * Supported provider formats:
 *   (1) Paystack: `charge.success` (amount in KOBO)
 *   (2) Flutterwave: `charge.completed` / successful status (amount in NAIRA)
 *   (3) Monnify: `SUCCESSFUL_TRANSACTION` (amount in NAIRA)
 *   (4) OPay: `SUCCESSFUL` / `SUCCESS` (normalized from kobo or naira)
 *   (5) Bank Transfer notification (Providus, Wema, Sterling direct credit)
 *   (6) ACE Canonical
 */
export function normalizePaymentEvent(body: unknown): NormalizedPayment | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, any>;

  // (1) Flutterwave: `charge.completed` or successful payment payload
  if (
    b.event === "charge.completed" ||
    b["event.type"] === "CARD_TRANSACTION" ||
    (b.data && (b.data.status === "successful" || b.status === "success") && (b.data.tx_ref || b.data.flw_ref))
  ) {
    const d = (b.data && typeof b.data === "object" ? b.data : b) as Record<string, any>;
    if (d.status && d.status !== "successful" && d.status !== "success") return null;
    if (!isNgnCurrency(d.currency)) return null;

    const ref = str(d.tx_ref ?? d.flw_ref ?? d.id);
    const van = str(
      d.account_number ??
        d.meta?.virtual_account ??
        d.customer?.phone_number ??
        d.destination_account ??
        d.payment_type_details?.account_number,
    );
    // Flutterwave amounts are in whole or decimal NAIRA (NOT kobo)
    const amountNgn = roundToTwoDecimals(d.amount);
    if (!ref || !van || amountNgn === null || amountNgn <= 0) return null;

    const res: NormalizedPayment = { providerRef: ref, virtualAccount: van, amountNgn };
    if (d.created_at) {
      const ts = new Date(d.created_at).getTime();
      if (!Number.isNaN(ts)) res.timestamp = ts;
    }
    return res;
  }

  // (2) Paystack: envelope `data` with amount in kobo
  if (typeof b.event === "string" && b.data && typeof b.data === "object") {
    if (b.event !== "charge.success") return null;
    const d = b.data as Record<string, any>;
    if (!isNgnCurrency(d.currency)) return null;

    const ref = str(d.reference ?? d.id);
    const van = str(
      d.authorization?.receiver_bank_account_number ??
        d.virtual_account ??
        d.metadata?.virtual_account ??
        d.customer?.virtual_account,
    );
    // Paystack amounts are strictly in KOBO
    const amountNgn = koboToNgn(d.amount);
    if (!ref || !van || amountNgn === null || amountNgn <= 0) return null;

    const res: NormalizedPayment = { providerRef: ref, virtualAccount: van, amountNgn };
    if (d.paid_at) {
      const ts = new Date(d.paid_at).getTime();
      if (!Number.isNaN(ts)) res.timestamp = ts;
    }
    return res;
  }

  // (3) Monnify: `SUCCESSFUL_TRANSACTION`
  if (b.eventType === "SUCCESSFUL_TRANSACTION" || (b.eventData && typeof b.eventData === "object")) {
    const d = (b.eventData ?? b) as Record<string, any>;
    if (d.paymentStatus && d.paymentStatus !== "PAID" && d.paymentStatus !== "SUCCESS") return null;
    if (!isNgnCurrency(d.currencyCode || d.currency)) return null;

    const ref = str(d.transactionReference ?? d.paymentReference);
    const van = str(
      d.destinationAccountInformation?.accountNumber ??
        d.accountNumber ??
        d.destinationAccountNumber,
    );
    // Monnify amounts are in NAIRA
    const amountNgn = roundToTwoDecimals(d.amountPaid ?? d.amount ?? d.totalPayable);
    if (!ref || !van || amountNgn === null || amountNgn <= 0) return null;

    const res: NormalizedPayment = { providerRef: ref, virtualAccount: van, amountNgn };
    if (d.paidOn) {
      const ts = new Date(d.paidOn).getTime();
      if (!Number.isNaN(ts)) res.timestamp = ts;
    }
    return res;
  }

  // (4) OPay Cashier / Webhook
  if (
    (b.payload && typeof b.payload === "object" && (b.payload.status === "SUCCESSFUL" || b.payload.status === "SUCCESS")) ||
    (b.status === "SUCCESSFUL" || b.status === "SUCCESS")
  ) {
    const d = (b.payload ?? b) as Record<string, any>;
    if (!isNgnCurrency(d.currency)) return null;

    const ref = str(d.reference ?? d.orderNo ?? d.transactionId);
    const van = str(d.accountNumber ?? d.virtualAccount ?? d.userPhone);
    let amountNgn: number | null = null;
    if (d.amount_kobo !== undefined) {
      amountNgn = koboToNgn(d.amount_kobo);
    } else {
      amountNgn = roundToTwoDecimals(d.amount);
    }
    if (!ref || !van || amountNgn === null || amountNgn <= 0) return null;

    return { providerRef: ref, virtualAccount: van, amountNgn };
  }

  // (5) Direct Bank Transfer Notification (Providus / Wema / Sterling virtual accounts)
  if (b.sessionId || (b.tranAmount !== undefined && b.accountNumber)) {
    if (!isNgnCurrency(b.currency)) return null;

    const ref = str(b.sessionId ?? b.transactionReference ?? b.reference);
    const van = str(b.accountNumber ?? b.virtual_account ?? b.account_number);
    const amountNgn = roundToTwoDecimals(b.tranAmount ?? b.amount);
    if (!ref || !van || amountNgn === null || amountNgn <= 0) return null;

    return { providerRef: ref, virtualAccount: van, amountNgn };
  }

  // (6) ACE canonical
  if (!isNgnCurrency(b.currency)) return null;

  const ref = str(b.reference ?? b.ref ?? b.provider_ref);
  const van = str(b.virtual_account ?? b.virtualAccount ?? b.account_number);
  const amountNgn =
    b.amount_kobo !== undefined ? koboToNgn(b.amount_kobo) : roundToTwoDecimals(b.amount);
  if (!ref || !van || amountNgn === null || amountNgn <= 0) return null;
  return { providerRef: ref, virtualAccount: van, amountNgn };
}

// ─── Amount classification ──────────────────────────────────────────────────────

export type AmountMatch = "exact" | "overpaid" | "underpaid";

/**
 * Compare paid vs. owed in integer kobo to eliminate floating point precision drift.
 * In JavaScript, 2850.10 * 100 === 285009.99999999994.
 * Converting to whole kobo via Math.round guarantees exact integer comparisons.
 */
export function classifyAmount(paidNgn: number, owedNgn: number): AmountMatch {
  const paidKobo = Math.round(paidNgn * 100);
  const owedKobo = Math.round(owedNgn * 100);

  if (paidKobo < owedKobo) return "underpaid";
  if (paidKobo > owedKobo) return "overpaid";
  return "exact";
}

// ─── Precision & unit helpers ───────────────────────────────────────────────────

export function str(v: unknown): string | null {
  if (typeof v === "string" && v.trim().length > 0) return v.trim();
  if (typeof v === "number" && !Number.isNaN(v)) return String(v);
  return null;
}

export function toNumber(v: unknown): number | null {
  const n = typeof v === "string" ? Number(v.replace(/,/g, "")) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? n : null;
}

/** Converts kobo to NGN with float precision protection */
export function koboToNgn(v: unknown): number | null {
  const n = toNumber(v);
  if (n === null) return null;
  // Round to whole kobo, then divide by 100
  return Math.round(n) / 100;
}

/** Converts NGN to integer kobo with float precision protection */
export function ngnToKobo(v: unknown): number | null {
  const n = toNumber(v);
  if (n === null) return null;
  // amount * 100 !== Math.round(amount * 100) — Math.round solves precision error
  return Math.round(n * 100);
}

/** Rounds Naira float to 2 decimal places */
export function roundToTwoDecimals(v: unknown): number | null {
  const n = toNumber(v);
  if (n === null) return null;
  return Math.round(n * 100) / 100;
}
