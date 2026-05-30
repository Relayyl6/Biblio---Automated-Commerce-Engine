# Logistics Coordination Service

> **ACE WhatsApp — Core Microservice #6**  
> Stack: **Rust**  
> Role: Autonomous rider dispatch and the logistics price moat

## Responsibility

Triggered by `PaymentVerified` state transition. Automatically selects the best logistics partner, books the rider, tracks delivery, and sends real-time updates to the customer — without any merchant action.

## Key Functions

### Logistics Aggregator (The Structural Moat)
ACE negotiates enterprise-tier rates based on **aggregate platform volume** across all merchants. Individual merchants cannot access these rates.

| Platform Volume (monthly deliveries) | Per-Delivery Rate | vs. Direct Rate (₦600) |
|--------------------------------------|------------------|------------------------|
| 0 – 999 | ₦600 | No savings |
| 1,000 – 4,999 | ₦450 | 25% savings |
| 5,000 – 19,999 | ₦350 | **41.6% savings** |
| 20,000+ | ₦280 | 53.3% savings |

**Lock-in calculation**: A merchant processing 80 orders/month saves ₦20,000/month on logistics vs. going direct — vs. ₦12,000 ACE subscription. **Leaving ACE costs more than staying.**

### Autonomous Booking
- On `PaymentVerified`: queries merchant's preferred logistics partner(s)
- Selects best carrier based on: delivery location, current load, cost, SLA performance history
- Calls carrier API: creates pickup request
- Receives: rider assignment + tracking link

### Customer Notifications
- Sends auto-message: "Your order is packed and on the way. Rider tracking: [link]. ETA: 45 mins."
- Live updates on rider proximity
- Delivery confirmation request to trigger escrow release

### Performance Tracking
- Per-carrier SLA tracking (on-time %, damage rate, customer ratings)
- Auto-deprioritises underperforming carriers
- Monthly volume reporting (feeds aggregate pricing renegotiation)

## Integrations
- **Kwik Delivery** — Urban on-demand
- **Gokada** — Motorcycle dispatch
- **MAX Delivery** — Electric vehicle fleet
- **GIG Logistics** — Intercity (Phase 1.5+)
- **Sendbox** — Multi-carrier API aggregator

## Status

`[ ] Not started — placeholder`
