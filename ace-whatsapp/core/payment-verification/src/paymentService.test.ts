// Tests for the pure payment core: constant-time HMAC verification, provider
// payload normalization (ACE-canonical + Paystack-shaped), and amount
// classification. Forged "payment confirmed" events are the threat model, so
// signature verification gets the most attention.

import { describe, it, expect } from "vitest";
import crypto from "node:crypto";
import {
  verifyWebhookSignature,
  normalizePaymentEvent,
  classifyAmount,
} from "./paymentService";

const SECRET = "whsec_test_123";

function sign(body: string, secret = SECRET): string {
  return crypto.createHmac("sha256", secret).update(Buffer.from(body)).digest("hex");
}

describe("verifyWebhookSignature", () => {
  const body = JSON.stringify({ reference: "r1", virtual_account: "901", amount: 28500 });

  it("accepts a correct bare-hex signature", () => {
    expect(verifyWebhookSignature(Buffer.from(body), sign(body), SECRET)).toBe(true);
  });

  it("accepts a correct sha256=-prefixed signature (Meta/GitHub style)", () => {
    expect(verifyWebhookSignature(Buffer.from(body), `sha256=${sign(body)}`, SECRET)).toBe(true);
  });

  it("rejects a tampered body", () => {
    const tampered = body.replace("28500", "1");
    expect(verifyWebhookSignature(Buffer.from(tampered), sign(body), SECRET)).toBe(false);
  });

  it("rejects a signature made with the wrong secret", () => {
    expect(verifyWebhookSignature(Buffer.from(body), sign(body, "wrong"), SECRET)).toBe(false);
  });

  it("rejects when the signature header is missing", () => {
    expect(verifyWebhookSignature(Buffer.from(body), undefined, SECRET)).toBe(false);
  });

  it("rejects when the secret is empty", () => {
    expect(verifyWebhookSignature(Buffer.from(body), sign(body), "")).toBe(false);
  });

  it("rejects a wrong-length signature without throwing", () => {
    expect(verifyWebhookSignature(Buffer.from(body), "abc123", SECRET)).toBe(false);
  });
});

describe("normalizePaymentEvent — ACE canonical shape", () => {
  it("reads reference / virtual_account / amount (NGN)", () => {
    const n = normalizePaymentEvent({ reference: "r1", virtual_account: "9012", amount: 28500 });
    expect(n).toEqual({ providerRef: "r1", virtualAccount: "9012", amountNgn: 28500 });
  });

  it("converts amount_kobo to NGN", () => {
    const n = normalizePaymentEvent({ reference: "r1", virtual_account: "9012", amount_kobo: 2850000 });
    expect(n?.amountNgn).toBe(28500);
  });

  it("accepts camelCase and alternate field aliases", () => {
    const n = normalizePaymentEvent({ ref: "r2", virtualAccount: "9012", amount: 100 });
    expect(n).toEqual({ providerRef: "r2", virtualAccount: "9012", amountNgn: 100 });
  });

  it("returns null when a required field is missing", () => {
    expect(normalizePaymentEvent({ reference: "r1", amount: 100 })).toBeNull();
    expect(normalizePaymentEvent({ virtual_account: "9012", amount: 100 })).toBeNull();
  });
});

describe("normalizePaymentEvent — Paystack charge.success", () => {
  it("unwraps data, treats amount as kobo, reads the receiver account", () => {
    const n = normalizePaymentEvent({
      event: "charge.success",
      data: {
        reference: "ps_1",
        amount: 2850000, // kobo
        authorization: { receiver_bank_account_number: "9876543210" },
      },
    });
    expect(n).toEqual({ providerRef: "ps_1", virtualAccount: "9876543210", amountNgn: 28500 });
  });

  it("ignores non-credit Paystack events (refunds/transfers)", () => {
    expect(
      normalizePaymentEvent({ event: "transfer.success", data: { reference: "x", amount: 100 } }),
    ).toBeNull();
  });

  it("returns null when the receiver account cannot be found", () => {
    expect(
      normalizePaymentEvent({ event: "charge.success", data: { reference: "x", amount: 100 } }),
    ).toBeNull();
  });
});

describe("normalizePaymentEvent — junk input", () => {
  it.each([null, undefined, 42, "string", []])("returns null for %s", (input) => {
    expect(normalizePaymentEvent(input as unknown)).toBeNull();
  });
});

describe("classifyAmount", () => {
  it.each([
    [28500, 28500, "exact"],
    [30000, 28500, "overpaid"],
    [20000, 28500, "underpaid"],
  ] as const)("paid %i vs owed %i → %s", (paid, owed, expected) => {
    expect(classifyAmount(paid, owed)).toBe(expected);
  });
});