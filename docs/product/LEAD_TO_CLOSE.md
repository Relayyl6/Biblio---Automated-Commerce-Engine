# Lead-to-Close Pipeline

> **ACE — Complete Autonomous Business Process**  
> From first customer message to confirmed delivery, with zero merchant intervention

---

## The Full Pipeline

ACE automates the **entire commercial lifecycle** of a merchant's business. This is not automation of individual tasks — it is end-to-end orchestration of every stage, from the moment a lead arrives to post-sale retention. The merchant's only job is to occasionally approve high-stakes exceptions.

```
┌──────────────────────────────────────────────────────────────────────────┐
│                    LEAD-TO-CLOSE PIPELINE                                │
│                                                                          │
│  [STAGE 1]      [STAGE 2]      [STAGE 3]      [STAGE 4]      [STAGE 5]  │
│  LEAD           QUALIFY        DISCOVER       NEGOTIATE       CLOSE      │
│  ARRIVAL   ──►  & PROFILE  ──► & PRESENT  ──► & COUNTER  ──► PAYMENT    │
│                                                                    │     │
│  [STAGE 6]      [STAGE 7]      [STAGE 8]      [STAGE 9]          │     │
│  FULFIL    ◄──  DISPATCH   ◄── CONFIRM    ◄── ESCROW        ◄────┘     │
│                                                                          │
│  [STAGE 10]                                                              │
│  POST-SALE → RETENTION LOOP → back to Stage 1 for next purchase          │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Stage 1: Lead Arrival — Ingestion & Context Load

**What happens:** A customer sends the first message — text, voice note, image, or a reference to a social post. ACE captures it before the merchant even knows it arrived.

**Services involved:** `ingestion-service` → `identity-resolution`

```
Customer sends: "How much for that gown you posted?"

Ingestion Service:
  → Receives WhatsApp webhook
  → Deduplicates (same message from poor connection = single event)
  → Media type detection: text / audio / image / video-frame-ref

Identity Resolution Service:
  → Looks up phone number → Global Buyer ID
  → NEW customer: creates profile, assigns GBI, sets tier = "New"
  → RETURNING customer: loads full profile:
      ├─ Purchase history (all merchants)
      ├─ LTV: ₦87,000
      ├─ Average discount accepted: 5%
      ├─ Preferred payment: bank transfer
      ├─ Typical delivery address
      └─ Sentiment history: 0.82 (positive)

Context package assembled → published to Kafka → Intent Parser picks up
```

**Data pooled at this stage:**
- New customer acquisition event (channel: WhatsApp, referral: organic / IG post / referral)
- Geographic origin (phone prefix → region)
- Time of first contact (demand timing signal)

---

## Stage 2: Qualification — Intent & Product Resolution

**What happens:** ACE determines exactly what the customer wants, even when they're vague. References to social posts, voice notes in Pidgin, and blurry product descriptions are all resolved to specific SKUs.

**Services involved:** `intent-parser` (AI) → `visual-context` → `state-machine`

```
Multi-model pipeline (Vercel AI SDK + Python FastAPI):
  ├─ Whisper: transcribes voice note (if audio)
  ├─ Dialect BERT: "that gown wey you post for IG" → normalised
  ├─ GPT-4o via generateObject: classifies intent, extracts entities
  └─ Output: { intent: "purchase", ref_type: "social_media_post", confidence: 0.94 }

Visual Context Resolution (if deictic reference detected):
  ├─ Scrapes merchant's recent IG/Facebook posts
  ├─ CLIP embeddings → finds matching garment in vector DB
  └─ Output: SKU = "BLK-LACE-EVENING-GOWN", stock: 5, base_price: ₦15,000

State Machine validates:
  ├─ Intent confidence ≥ 0.80 → proceed autonomously
  ├─ Intent confidence < 0.80 → Vendor Communiqué: "Unclear intent. Confirm: is this a purchase?"
  └─ Transition: LEAD_ARRIVED → QUALIFIED
```

**Data pooled at this stage:**
- Which product was inquired about (demand signal for FMCG)
- How it was referenced (explicit / visual / deictic — tells us about discovery patterns)
- Dialect and language used (language intelligence signal)
- Inquiry timestamp + geographic area → FMCG demand heatmap feed

---

## Stage 3: Product Discovery & Presentation

**What happens:** ACE presents the product with the right information, the right tone, and already personalised for this customer's history and tier. It's the AI playing the role of a skilled salesfloor assistant who knows the customer.

**Services involved:** `ai-negotiator` (presentation phase) → `ingestion-service` (delivery)

```
Customer context loaded: LTV ₦87K, avg 5% discount, prefers bank transfer

AI Presentation (Vercel AI SDK, generateText):
  "The black lace evening gown 😍 — just arrived last week and it's already flying off.
   ₦15,000 each. We have it in sizes 10, 12, and 14. 
   Which size are you and how many are you looking at?"

What this does:
  ├─ Presents price at anchor (full price — never opens with discount)
  ├─ Uses scarcity truthfully ("flying off" — real velocity data confirms this)
  ├─ Asks a qualifying question → keeps customer engaged, gathers size data
  └─ Single message (message consolidation — counts as 1 of 2.3 target)

Data pooled:
  - Product view event (which SKU was shown, to whom, when)
  - Customer response time (engagement signal)
  - Size/variant requested (inventory planning signal for FMCG/supplier)
```

---

## Stage 4: Negotiation — The AI Negotiator Takes Over

**What happens:** Customer responds with questions, a counter-offer, or a request for a deal. The AI Negotiator manages the full negotiation arc autonomously, within merchant-configured boundaries.

**Services involved:** `ai-negotiator` → `state-machine` (validates every price) → `comms-router` (escalation if needed)

```
Customer: "Size 12, two please. But ₦25K for both, not ₦30K?"

AI Negotiator (Stage: COUNTER):
  ├─ Checks: authorized range for this customer (Returning tier, 15% max)
  ├─ ₦25,000 for two = ₦12,500 each = 17% discount (above 15% max)
  ├─ Counter: aim for ₦27,000 (10% discount = within range)
  └─ Tactic: Relationship Anchor + soft close

AI response:
  "Haha I know you're sharp 😄 Usually I wouldn't move much from ₦30K for two.
   But because you've been with us a while — ₦27,000 for both, and I'll make sure 
   they're packed fresh. That's as far as I can go today."

Customer: "Abeg ₦26K, I go pay now now"

AI Negotiator:
  ├─ ₦26,000 for two = ₦13,000 each = 13.3% discount ✓ (within 15% max)
  ├─ Outcome: CLOSE authorized
  └─ Transition: NEGOTIATION → PRE-CHECKOUT

AI response:
  "You know what, deal! ₦26,000 for both. Reserved for you right now.
   Pay here and they're yours: [PWA Link]"

Data pooled (NegotiationTrace):
  - Anchor: ₦30,000 | Customer first offer: ₦25,000 | Close: ₦26,000
  - Price elasticity signal: 86.7% of base price
  - Tactics: Relationship Anchor → accepted after 1 counter
  - Dialect: Pidgin-English code-switch
  → Feeds: FMCG price elasticity data, AI training RLHF pairs
```

---

## Stage 5: Close — Payment Initiation

**What happens:** ACE converts the verbal close into a transaction. Payment options are presented and a unique virtual account is issued. The PWA pre-fills everything the customer has ever entered before.

**Services involved:** `payment-verification` → `state-machine` → `customer-pwa`

```
PWA opens in WhatsApp browser:
  ├─ Global Buyer ID detected → form pre-filled (name, address, phone)
  ├─ Order summary: 2× Black Lace Evening Gown (Size 12) = ₦26,000
  ├─ Payment options:
  │   ├─ Bank transfer → unique virtual account: 9876543210, exactly ₦26,000
  │   ├─ Card (Paystack)
  │   └─ Pay-on-delivery (if merchant-enabled for this customer tier)
  └─ 15-minute payment window timer starts

State Machine: NEGOTIATION_CLOSED → AWAITING_PAYMENT

Data pooled:
  - Payment method preference (bank transfer vs card → financial behaviour signal)
  - Device type (mobile web → PWA engagement metric)
  - Time from close to payment initiation (engagement quality signal)
```

---

## Stage 6: Payment Verification — Autonomous Reconciliation

**What happens:** Customer completes transfer. ACE confirms it without the merchant checking their bank app. Escrow is opened. Inventory is decremented.

**Services involved:** `payment-verification` → `state-machine`

```
Bank webhook received:
  ├─ Amount: ₦26,000 ✓ (exact match)
  ├─ Account: 9876543210 ✓ (matches transaction virtual account)
  ├─ Timestamp: within 15-minute window ✓
  └─ State Machine: AWAITING_PAYMENT → PAYMENT_VERIFIED

Simultaneous actions (all autonomous):
  ├─ Inventory: BLK-LACE-EVENING-GOWN (Size 12) stock: 5 → 3
  ├─ Escrow: ₦26,000 held (released after delivery confirmation or 24hrs)
  ├─ Customer confirmation: "Payment received! We're packing your order now 📦"
  └─ Vendor Communiqué (optional): "Payment ₦26K confirmed for 2× Black Lace Gown.
                                     Rider being dispatched. No action needed."

Data pooled:
  - Transaction completed: ₦26,000 (for TrustScore: payment reliability signal)
  - Payment-to-confirmation latency (operational metric)
  - SKU sold + price achieved (FMCG sell-through signal)
```

---

## Stage 7: Logistics Dispatch — Autonomous Booking

**What happens:** Payment confirmed → rider booked without anyone making a phone call.

**Services involved:** `logistics-coordination` → `state-machine`

```
Logistics Coordination Service:
  ├─ Queries: merchant's preferred carrier + current platform pricing tier
  ├─ Platform at 5,000+ deliveries/month → Kwik rate: ₦350 (vs ₦600 direct)
  ├─ Calls Kwik API: CreatePickup { merchant_address, customer_address, weight_estimate }
  ├─ Receives: { rider_id: "KWK-4821", tracking_url: "...", eta_minutes: 45 }
  └─ State Machine: PAYMENT_VERIFIED → OUT_FOR_DELIVERY

Customer auto-notification:
  "Your order is packed and on its way! 🛵
   Track your rider: [tracking link]
   Expected arrival: 45 minutes."

Data pooled:
  - Delivery booking event (logistics performance tracking)
  - Carrier selected + cost (for aggregate renegotiation)
  - Estimated vs actual delivery time (SLA monitoring)
```

---

## Stage 8: Delivery Confirmation & Escrow Release

**What happens:** GPS drop-off triggers escrow release. Customer is asked to confirm. No merchant action needed.

**Services involved:** `payment-verification` (escrow) → `logistics-coordination` → `state-machine`

```
Logistics webhook (GPS drop-off confirmed at customer address):
  └─ State Machine: OUT_FOR_DELIVERY → DELIVERED

Escrow Release (auto, after 24hr window or customer confirmation):
  └─ ₦26,000 → merchant's settlement account
     (minus ACE platform fee: ₦26,000 × 1.5% = ₦390)
     Net to merchant: ₦25,610

Customer message: "How was your experience? Tap a star ⭐⭐⭐⭐⭐"
Merchant notification: "Order delivered & payment settled. ₦25,610 in your account. ✓"

Data pooled:
  - Order fulfilled successfully (TrustScore: fulfillment consistency)
  - Customer rating (merchant reputation signal)
  - Delivery time actual vs estimate (logistics partner SLA signal)
```

---

## Stage 9: Merchant Summary — The Only Thing They See

At the end of every completed order cycle, the merchant receives a single, clean summary. This is often the **only interaction** they have with ACE for that transaction.

```
Push notification:
  "Order #2847 complete ✓
   ₦25,610 settled to your account
   2× Black Lace Gown (Size 12) · Delivered in 48 minutes
   AI handled: conversation, negotiation, payment, dispatch, delivery
   Your margin: 41% · Actions taken by you: 0"
```

---

## Stage 10: Post-Sale → The Retention Loop

**What happens:** Every completed order feeds the retention engine. ACE schedules follow-up touchpoints and monitors for disengagement signals.

**Services involved:** `ai/intent-parser` (retention agent) → `comms-router`

```
After delivery confirmed:
  ├─ CRM updated: last_purchase = today, LTV += ₦26,000
  ├─ Retention scheduler: "Next expected purchase in ~14 days (her pattern)"
  ├─ Set: reminder task at Day 18 if no new order
  └─ Set: VIP re-engagement at Day 28 if still no order

Day 18 (if no new purchase):
  AI drafts: "Hey! Hope you loved the gown 😍 We just got new fabric in.
              Coming to check anything out this week?"
  → Vendor Communiqué: "Draft sent to [customer]. Tap to review or auto-sends in 4 hrs."

Day 28 (if still no purchase):
  → Predictive Relationship Analyzer escalates to "At-Risk VIP"
  → Full Workflow 3 (Customer Retention Engine) activates
```

---

## The Complete Merchant Experience

A merchant processing 80 orders/month with ACE:

| Task | Without ACE | With ACE |
|------|------------|---------|
| Responding to customer enquiries | 4–6 hrs/day | 0 |
| Checking bank app for payments | 20+ times/day | 0 |
| Calling dispatch riders | 8–15 calls/day | 0 |
| Updating inventory notes | 30 min/day | 0 |
| Chasing lapsed customers | Rarely, manually | Automated nightly |
| Negotiating prices | Every transaction | AI handles, with boundaries |
| Following up unpaid orders | Ad hoc | Automated 15-min timer |
| **Total active business management time** | **5–8 hours/day** | **< 20 min/day (exceptions only)** |

**The merchant's 20 minutes is spent reviewing genuinely hard decisions — not executing routine work.**
