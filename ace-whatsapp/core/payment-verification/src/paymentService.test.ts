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
    [2850.10, 2850.10, "exact"], // Float precision: 2850.10
    [2850.1000000000004, 2850.10, "exact"], // Precision drift
    [2850.09, 2850.10, "underpaid"],
    [2850.11, 2850.10, "overpaid"],
  ] as const)("paid %i vs owed %i → %s", (paid, owed, expected) => {
    expect(classifyAmount(paid, owed)).toBe(expected);
  });
});

describe("Multi-provider signature verification", () => {
  const body = Buffer.from(JSON.stringify({ ref: "tx_123", amount: 5000 }));
  const secret = "test_provider_secret_123";

  it("verifies HMAC-SHA512 for Paystack and Monnify", () => {
    const sha512Sig = crypto.createHmac("sha512", secret).update(body).digest("hex");
    expect(verifyWebhookSignature(body, sha512Sig, secret)).toBe(true);
  });

  it("verifies Flutterwave verif-hash in constant-time", () => {
    const flwSecretHash = "flw_sec_hash_987654";
    expect(verifyWebhookSignature(body, flwSecretHash, flwSecretHash, "flutterwave")).toBe(true);
    expect(verifyWebhookSignature(body, "wrong_hash", flwSecretHash, "flutterwave")).toBe(false);
  });

  it("rejects forged or tampered signatures across providers", () => {
    const validSig = crypto.createHmac("sha512", secret).update(body).digest("hex");
    const tamperedBody = Buffer.from(JSON.stringify({ ref: "tx_123", amount: 1 }));
    expect(verifyWebhookSignature(tamperedBody, validSig, secret)).toBe(false);
  });
});

describe("normalizePaymentEvent — Multi-provider support", () => {
  it("normalizes Flutterwave charge.completed (amount in Naira)", () => {
    const event = {
      event: "charge.completed",
      data: {
        id: 99123,
        tx_ref: "flw_ref_001",
        flw_ref: "FLW-123456",
        amount: 15750.50, // Naira
        currency: "NGN",
        status: "successful",
        account_number: "0123456789"
      }
    };
    const norm = normalizePaymentEvent(event);
    expect(norm).toEqual({
      providerRef: "flw_ref_001",
      virtualAccount: "0123456789",
      amountNgn: 15750.50
    });
  });

  it("normalizes Monnify SUCCESSFUL_TRANSACTION (amount in Naira)", () => {
    const event = {
      eventType: "SUCCESSFUL_TRANSACTION",
      eventData: {
        transactionReference: "MNFY|10001",
        paymentReference: "pay_ref_001",
        amountPaid: 8500, // Naira
        destinationAccountInformation: {
          accountNumber: "9876543210"
        },
        paymentStatus: "PAID"
      }
    };
    const norm = normalizePaymentEvent(event);
    expect(norm).toEqual({
      providerRef: "MNFY|10001",
      virtualAccount: "9876543210",
      amountNgn: 8500
    });
  });

  it("normalizes OPay notification (kobo vs naira)", () => {
    const eventKobo = {
      payload: {
        status: "SUCCESSFUL",
        reference: "opay_tx_001",
        accountNumber: "7778889990",
        amount_kobo: 350000 // 3,500 NGN
      }
    };
    expect(normalizePaymentEvent(eventKobo)).toEqual({
      providerRef: "opay_tx_001",
      virtualAccount: "7778889990",
      amountNgn: 3500
    });

    const eventNaira = {
      status: "SUCCESSFUL",
      reference: "opay_tx_002",
      accountNumber: "7778889990",
      amount: 4200
    };
    expect(normalizePaymentEvent(eventNaira)).toEqual({
      providerRef: "opay_tx_002",
      virtualAccount: "7778889990",
      amountNgn: 4200
    });
  });

  it("normalizes direct Bank Transfer notification (Providus/Wema)", () => {
    const event = {
      sessionId: "000013210312154321000000000001",
      accountNumber: "9912345678",
      tranAmount: 12500,
      transactionReference: "PROV-TX-9988"
    };
    expect(normalizePaymentEvent(event)).toEqual({
      providerRef: "000013210312154321000000000001",
      virtualAccount: "9912345678",
      amountNgn: 12500
    });
  });
});

describe("Unit conversion and float precision helpers", () => {
  it("converts kobo to NGN safely without float precision drift", () => {
    // 285010 kobo = 2850.1 NGN
    expect(normalizePaymentEvent({ reference: "r1", virtual_account: "9012", amount_kobo: 285010 })?.amountNgn).toBe(2850.1);
  });
});
