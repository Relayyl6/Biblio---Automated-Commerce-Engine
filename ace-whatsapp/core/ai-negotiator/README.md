# AI Negotiator

> **ACE WhatsApp — Core Microservice #11**  
> Stack: **Rust (rules engine) + TypeScript/Vercel AI SDK (negotiation agent)**  
> Role: Autonomous price negotiation and deal-closing — the AI market trader

---

## What This Is

The AI Negotiator is the single most differentiated component in ACE. It is not a discount engine. It is not a pricing lookup service. It is a **fully autonomous negotiation agent** that behaves like a skilled, relationship-aware market trader operating on behalf of the merchant.

Where generic AI tools either fix a price or blindly accept any offer, ACE's Negotiator:
- Reads the customer's **full relationship history** before every negotiation
- Opens with the right position based on who it's talking to
- Uses culturally appropriate language and pressure tactics
- Counters, pivots, bundles, and creates urgency autonomously
- Knows exactly where its floor is and never crosses it
- **Closes the deal** — it doesn't just respond, it drives toward a transaction

---

## The Two-Layer Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  NEGOTIATION AGENT LAYER — TypeScript + Vercel AI SDK           │
│                                                                 │
│  - Generates culturally-nuanced negotiation dialogue            │
│  - Multi-turn conversation management (knows where we are       │
│    in the negotiation arc)                                      │
│  - Bundle construction and upsell suggestion                    │
│  - Urgency and scarcity signals (when inventory warrants it)    │
│  - Reads customer sentiment in real-time to adapt tone          │
└─────────────────────────┬───────────────────────────────────────┘
                          │ calls — never overrides
┌─────────────────────────▼───────────────────────────────────────┐
│  RULES ENGINE LAYER — Rust (PricingService)                     │
│                                                                 │
│  - AuthorizedPriceRange computed from merchant rules            │
│  - Circuit breaker: below floor → AI CANNOT proceed            │
│  - All final prices written only by Rust — never by LLM        │
│  - Injection detection: adversarial patterns flagged + logged   │
└─────────────────────────────────────────────────────────────────┘
```

---

## The Negotiation Arc

Every negotiation follows a structured arc. The AI Negotiator manages position across the full arc within a single conversation thread, even across multiple messages over hours.

```
Stage 1: ANCHOR
  AI opens with full price (or recommended price for VIPs).
  Never opens below recommended — anchors high.

Stage 2: ACKNOWLEDGE
  Customer makes counter-offer or objects to price.
  AI acknowledges the relationship/context before responding.
  "Because you've been ordering for 8 months..." / "I understand..."

Stage 3: COUNTER
  AI makes a calculated counter-offer within authorized range.
  Never jumps to floor immediately — reserves room for next counter.
  Uses bundle, urgency, or scarcity to shift value instead of price.

Stage 4: CLOSE / PIVOT / ESCALATE
  ├─ Customer accepts → CLOSE (moves to checkout immediately)
  ├─ Customer below floor → PIVOT (bundle offer, payment plan, future credit)
  └─ Customer firm below floor, high LTV → ESCALATE (merchant communiqué)
```

---

## Negotiation Tactics Available to the AI

The AI has a defined playbook of tactics it can deploy autonomously, within merchant-approved boundaries:

### Tactic 1: The Relationship Anchor
Uses purchase history to justify price and justify value — not discount.
```
"You've spent ₦87,000 with us. You know our quality is top. 
 This gown is worth every kobo of ₦28,500."
```

### Tactic 2: The Bundle Pivot
When customer pushes below floor, AI pivots to a bundle instead of a lower price.
```
Customer: "₦13,000 for the dress"
Floor: ₦14,250 (minimum)
AI: "₦13K is a bit low for just the dress. But what if I do the dress + the matching 
     head wrap for ₦16,500? You're getting more for less per piece."
```

### Tactic 3: Scarcity Signal (Inventory-Verified)
Only deployed when inventory is genuinely low — prevents manipulation.
```
"I only have 2 of this size left. At ₦18,500 they won't last — the last batch 
 sold out in 3 days. I can hold one for you until tomorrow morning."
```
> ⚠️ Inventory oracle must confirm stock ≤ 3 units before this tactic fires. Never fabricated.

### Tactic 4: The Future Credit Offer
Closes the deal now with a forward incentive — no immediate margin loss.
```
"Best I can do today is ₦16,500. But I'll give you ₦1,000 credit on 
 your next order for being loyal. Deal?"
```

### Tactic 5: The Urgency Window
Time-limits the offer to close faster — real countdown, not fake.
```
"I can hold the ₦16,000 price until 6pm today. After that it goes back to ₦18,500."
```

### Tactic 6: The Socially Aware Soft Close
Reads sentiment score. If customer seems hesitant (not price-sensitive), closes with warmth.
```
"No pressure at all o. If you want more time to think, I can hold it for you 
 until tomorrow. Just let me know."
```
> This prevents losing a customer by pushing too hard when price isn't actually the blocker.

---

## The Circuit Breaker (Hardened Rust Rules)

When customer pushes **below the pricing floor**, the Negotiation Agent Layer is **cut off** from closing the deal. It cannot proceed. The Rust Rules Engine enforces this hard stop.

```rust
enum NegotiationOutcome {
    Closed { final_price: f64 },          // Deal done → State Machine
    BelowFloor {
        merchant_escalation: bool,         // → Vendor Communiqué via SMS
        bundle_pivot_attempted: bool,      // Did we try the bundle first?
        future_credit_attempted: bool,     // Did we try future credit?
        customer_final_offer: f64,         // What they want to pay
    },
    CustomerAbandoned,                     // Customer stopped responding
    PricingInjectionDetected,             // Adversarial input logged
}
```

**On `BelowFloor`:**
1. AI first attempts Bundle Pivot (Tactic 2)
2. If still below floor → AI attempts Future Credit (Tactic 4)
3. If still below floor → triggers **Vendor Communiqué** to merchant (SMS)
   - Merchant gets: "Customer Amaka wants the dress at ₦12K. Your floor is ₦14,250. Reply 1 to approve special exception, 2 to hold firm, 3 to offer bundle."

---

## Customer Tier × Negotiation Authority

Merchant configures these once. AI executes within them forever.

| Customer Tier | Max Discount | Max Bundle Value Add | Future Credit Cap |
|--------------|-------------|---------------------|-------------------|
| New (< 1 order) | 5% | 0% (no bundles for unknowns) | None |
| Returning (2–5 orders) | 15% | 10% additional value | ₦1,000 max |
| Loyal (6–20 orders) | 22% | 20% additional value | ₦2,500 max |
| VIP (21+ orders or LTV > ₦100K) | 30% | 30% additional value | ₦5,000 max |

---

## Negotiation Data Collection

Every negotiation is a training signal AND a sellable enterprise data asset:

```typescript
interface NegotiationTrace {
  sessionId: string
  merchantId: string  // hashed
  customerId: string  // hashed
  customerTier: CustomerTier
  
  // Opening position
  anchorPrice: number
  authorizedFloor: number
  
  // The arc
  turns: NegotiationTurn[]  // each message pair: customer offer + AI counter
  
  // Outcome
  outcome: 'closed' | 'below_floor_escalated' | 'bundle_closed' | 'abandoned'
  finalPrice?: number
  finalMargin?: number
  tacticsDeployed: NegotiationTactic[]
  tacticsSucceeded: NegotiationTactic[]
  
  // Enterprise value
  priceElasticitySignal: number  // customer's final offer / base price
  dialect: Dialect
}
```

**What this data tells enterprise buyers:**
- **FMCG brands**: exact price elasticity at SKU level, per geography, per customer segment
- **AI labs**: real-world negotiation dialogue in dialect (extremely rare training data)
- **Banks**: credit signal — customers who abandon at X% are different credit risk profiles

---

## Negotiation Quality Metrics

| Metric | Phase 1 Target | Phase 2 Target |
|--------|---------------|---------------|
| Deals closed within authorized range | ≥ 72% | ≥ 82% |
| Bundle pivot success rate | ≥ 35% of below-floor attempts | ≥ 50% |
| Merchant escalations per 100 negotiations | ≤ 8 | ≤ 4 |
| Average margin achieved vs. floor | +7% above floor | +12% above floor |
| Injection attempt detection rate | ≥ 99% | ≥ 99.9% |

## Status

`[ ] Not started — placeholder`
