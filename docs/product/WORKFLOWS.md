# Autonomous Workflows — Detailed Reference

> The four core autonomous workflows that define what ACE does.  
> These are the proof points for "the AI doesn't assist; it executes."

---

## Workflow 1: Autonomous Order Fulfillment

**Trigger:** Customer sends any purchase-intent message on WhatsApp  
**Merchant input required:** Zero  
**Merchant notification:** Outcome summary after completion

### Flow

```
1. Customer: "Abeg I need two of that black gown wey you post for IG"

2. Ingestion Service: ingests message, queues for intent parsing

3. Intent Parser (Python AI pipeline):
   ├─ Whisper transcribes (if voice note)
   ├─ Dialect BERT normalises: "Please, I need two of the black gown from your Instagram"
   ├─ GPT-4o extracts: {intent: purchase, qty: 2, ref: "IG post", ref_type: social_media}
   └─ requires_visual_resolution: true

4. Visual Context Resolution:
   ├─ Scrapes merchant's recent IG posts
   ├─ CLIP embedding search: finds "Black Lace Evening Gown" (SKU: BLK-001)
   └─ Returns: SKU, stock: 5, price: ₦15,000

5. State Machine validates:
   ├─ Customer history: LTV ₦87K, avg 5% discount → VIP tier
   ├─ Pricing Service: floor ₦10,500 (30% VIP max) → ₦28,500 for 2 is fine
   └─ Transition: AWAITING_INTENT → INTENT_CONFIRMED

6. ACE AI responds (via Ingestion Service, single message):
   "Perfect! The black lace gown is ₦15,000 each. For you, ₦28,500 for both (5% loyalty discount).
    Reserved. Tap here to pay: [PWA link]"

7. Customer opens PWA (inside WhatsApp browser):
   ├─ Pre-filled from Global Buyer ID
   ├─ Selects: Bank transfer to virtual account
   └─ Virtual account: 9876543210, exactly ₦28,500

8. State Machine: INTENT_CONFIRMED → AWAITING_PAYMENT (15min timer starts)

9. Customer completes bank transfer

10. Payment Verification Service:
    ├─ Bank webhook received: ₦28,500 to account 9876543210 ✓
    ├─ State Machine: AWAITING_PAYMENT → PAYMENT_VERIFIED
    ├─ Inventory: BLK-001 stock 5 → 3
    └─ Triggers: logistics booking

11. Logistics Coordination:
    ├─ Selects Kwik (best rate + availability)
    ├─ Books pickup, receives rider + tracking link
    └─ State Machine: PAYMENT_VERIFIED → OUT_FOR_DELIVERY

12. Customer auto-message:
    "Payment confirmed! Rider dispatched. Track: [link]. ETA: 45 mins."

13. Merchant notification:
    "Order #2847 auto-fulfilled. ₦28,500 received. Rider dispatched. ✓ No action needed."
```

**Merchant never:** typed a response, checked bank app, called a rider, updated inventory.

---

## Workflow 2: Autonomous Demand-Driven Restocking

**Trigger:** Inventory Oracle detects impending stockout (runs every 6 hours)  
**Merchant input required:** One tap to approve payment (≈8 seconds)

### Flow

```
1. Inventory Oracle (background, every 6hrs):
   ├─ Red Ankara Fabric (SKU: RAF-042): stock 8 yards
   ├─ 7-day moving avg: 12 yards/day
   └─ Predicted stockout: 16 hours → TRIGGERS RESTOCK

2. Supplier Integration:
   ├─ Fetches: primary supplier = Alhaji Ibrahim Textiles
   ├─ Historical price: 50 yards @ ₦800/yard
   └─ Sends WhatsApp template: "Need 50 yards Red Ankara at ₦800/yard. Available?"

3. Supplier responds: "Yes. ₦42,000 for 50 yards."

4. Margin analysis:
   ├─ COGS: ₦840/yard (₦42K ÷ 50)
   ├─ Selling price: ₦1,500/yard
   ├─ Margin: 44% > merchant floor (35%) ✓
   └─ Auto-approvable

5. Merchant notification:
   "Red Ankara running out (8 yards, ~16hrs).
    Restock: 50 yards from Alhaji Ibrahim, ₦42K (44% margin).
    [Approve Payment] [Modify] [Reject]"

6. Merchant taps "Approve" (8 seconds total merchant time):
   ├─ Payment triggered to Alhaji Ibrahim's account
   ├─ Pickup confirmation WhatsApp sent to supplier
   └─ Inventory forecast updated: expected arrival tomorrow 10am

7. During gap: AI auto-tells inquiring customers:
   "Fresh stock tomorrow morning! Reserve now — 10% off for pre-orders."
```

---

## Workflow 3: Autonomous Customer Retention Engine

**Trigger:** Nightly predictive relationship analysis  
**Merchant input required:** Optional review before send (4hr window); defaults to auto-send

### Flow

```
1. Nightly analyzer:
   ├─ Customer "Blessing" (GBI-782934): LTV ₦124,000
   ├─ Purchase pattern: every 2 weeks (8 months consistent)
   ├─ Last purchase: 27 days ago (deviation: +13 days)
   ├─ Sentiment history: avg 0.82 (positive), no complaints
   └─ Classification: "High-Value At-Risk Customer"

2. ACE generates retention strategy:
   ├─ Purchase analysis: 83% Ankara fabrics
   ├─ Current inventory: Gold Embroidered Ankara just arrived
   └─ Drafts culturally-nuanced message (not generic marketing):

   "Blessing! 👋 It's been a minute o! Hope you're doing amazing.
    I just got this stunning gold embroidered Ankara that immediately made me
    think of you (remember that gorgeous outfit you made last time? 😍).
    I'm setting aside 4 yards at our usual special rate if you're interested.
    No pressure at all sha, just wanted you to see it first! 💛"
    [attaches fabric image]

3. Merchant notification:
   "VIP Alert: Blessing hasn't ordered in 27 days (unusual for her).
    Draft ready. [Send Now] [Edit] — auto-sends in 4 hours if no action."

4. Blessing replies: "Omo! Yes! Hold 4 yards, coming tomorrow."

5. ACE:
   ├─ Reserves 4 yards
   ├─ Sends confirmation to Blessing
   └─ Merchant: "Blessing re-engaged! ₦18,000 order secured. ✓"
```

---

## Workflow 4: Multimodal Visual Product Resolution

**Trigger:** Customer uses deictic reference ("that dress in your last reel")  
**Merchant input required:** Zero

### Flow

```
1. Customer: "How much for the blue dress in your last reel?"

2. Visual Context Resolution Service:
   ├─ Identifies: deictic reference "last reel" + descriptor "blue dress"
   ├─ Fetches merchant's IG Reel cache (posted 14 hours ago)
   ├─ Extracts frames → CLIP embeddings
   ├─ Vector search: blue garments in merchant's inventory
   └─ Match: SKU "BLUE-SATIN-MIDI-DRESS" (confidence: 0.97)

3. AI response:
   "Ah, the royal blue satin midi dress from yesterday's reel! 😍
    ₦18,500. Available in sizes 10, 12, 14. Which size?"
    [product image attached]

4. Customer: "Size 12, but can I get ₦16K?"

5. Pricing Service (Rust circuit breaker):
   ├─ Base: ₦18,500 | Floor: ₦12,950 (30% max, VIP tier)
   ├─ Requested: ₦16,000 > ₦12,950 ✓ (within range)
   ├─ Customer LTV: ₦65,000 (repeat customer)
   └─ Autonomously approved

6. AI: "Because you're one of my best customers, ₦16K works! Tap to order: [PWA link]"

7. Merchant notification:
   "Blue Satin Midi from reel. 13% loyalty discount applied (₦18,500 → ₦16,000).
    Your margin: 41%. Auto-approved within your pricing rules."
```

---

## The Numbers That Matter

| Metric | Without ACE | With ACE |
|--------|------------|---------|
| Merchant time per order | 45–90 minutes | < 1 minute (exceptions only) |
| Revenue ceiling | $50K/year | Uncapped |
| Payment reconciliation | Manual, error-prone | 99%+ automated |
| Stockout events | Frequent (reactive) | Rare (predictive, 16hr lead time) |
| At-risk customer detection | Never | Nightly, automated |
| Social product resolution | Manual lookup | Instant (CLIP embeddings) |
