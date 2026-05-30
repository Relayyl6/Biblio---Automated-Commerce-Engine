# Payment Verification Service

> **ACE WhatsApp — Core Microservice #5**  
> Stack: **Rust**  
> Role: Autonomous payment reconciliation — merchant never checks their bank app

## Responsibility

Handles all payment verification without merchant intervention. Generates dynamic virtual accounts per transaction, receives real-time bank webhooks, manages the micro-escrow lifecycle, and reconciles card payments.

## Key Functions

### Virtual Account Generation
- Spins up a unique virtual account number per transaction
- Integrates with Providus / Wema / Sterling via partner FinTechs
- Account is transaction-specific (prevents cross-order payment confusion)
- 15-minute timer: if no payment, auto-reminder sent to customer

### Real-Time Bank Webhooks
- Listens for bank credit webhooks (Mono, Okra direct integrations)
- Validates: amount matches ± ₦0 (exact match required)
- Validates: account number matches transaction's virtual account
- On match → publishes `PaymentVerified` event to Kafka

### Screenshot OCR Fallback
- Used only when direct bank API unavailable (legacy scenarios)
- Confidence threshold: **< 95% confidence → escalate to merchant for manual review**
- Vision AI extracts: amount, sender name, reference, bank name

### Micro-Escrow Engine
- Funds held for 24 hours post-confirmed delivery
- Release conditions:
  1. Customer explicitly confirms receipt, OR
  2. 24-hour window expires with no complaint, OR
  3. Delivery GPS webhook confirms drop-off
- Dispute resolution: AI analyses delivery proof + chat history + merchant reputation → auto-resolves 85% of disputes

### Card Payment Reconciliation
- Paystack + Flutterwave webhook listeners
- Handles refunds and chargebacks

## Key Integrations
- Providus Bank, Wema Bank, Sterling Bank (virtual accounts)
- Mono, Okra (open banking, transaction verification)
- Paystack, Flutterwave (card payments)
- Kwik, Gokada, MAX (delivery GPS webhooks for escrow release)

## Status

`[ ] Not started — placeholder`
