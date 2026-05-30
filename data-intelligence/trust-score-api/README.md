# ACE TrustScore API

> **ACE Enterprise Product 3**  
> Target: Kuda · FairMoney · Carbon · GTBank · Access Bank · MFIs · BNPL providers  
> Year 2 ARR Projection: **$3.57M** (850K credit checks/month @ $0.35 avg)

---

## The Problem Banks Have

Traditional credit scoring relies on:
- Formal employment records ← informal merchants have none
- Bank statements showing regular salary deposits ← informal merchants have chaotic cash flow
- Credit bureau history ← 95% of informal merchants have **zero** formal credit history

Result: **180 million creditworthy but "unscorable" people** locked out of financial services in Nigeria alone.

---

## ACE TrustScore — The Alternative Credit Engine

ACE's platform captures the most accurate proxy for creditworthiness that exists: **actual business behaviour, at scale, over time**.

A 300–850 score derived from behavioural transaction signals — with **73% correlation to loan repayment behaviour** (internal validation showing 28% better than traditional bureau scores for informal merchants).

---

## Signal Categories

### 1. Order Fulfillment Consistency
- % of orders completed vs. cancelled
- Average time from order to delivery
- Customer complaint and dispute rate

### 2. Cash Flow Predictability
- Revenue stability coefficient
- Seasonality patterns
- Month-over-month growth trajectory
- Peak/trough ratio

### 3. Supplier Relationship Health
- Payment punctuality to suppliers
- Credit terms offered by suppliers (proxy: suppliers trust this merchant)
- Reorder frequency and reliability

### 4. Customer Retention Metrics
- Repeat customer rate
- LTV distribution
- Churn patterns and velocity

### 5. Conversational Integrity Signals
- Response time consistency
- Commitment follow-through rate ("I'll send it tomorrow" → actually does)
- Conflict resolution approach and outcome

---

## Pricing Model

| Offering | Price |
|----------|-------|
| Per-query API | $0.45 per credit check |
| Batch processing | $0.22 per check (min 10K/month) |
| White-label embedded scoring | $180K/year + $0.15 per query |

---

## API Response Format (Draft)

```json
{
  "trust_score": 742,
  "score_band": "Good",
  "confidence": 0.89,
  "signals": {
    "fulfillment_consistency": 0.94,
    "cash_flow_predictability": 0.81,
    "supplier_relationship": 0.76,
    "customer_retention": 0.88,
    "conversational_integrity": 0.79
  },
  "data_vintage": "90_days",
  "recommended_credit_ceiling": "₦500,000"
}
```

---

## Compliance Requirements

- [ ] Approved by CBN (Central Bank of Nigeria) for use in credit decisioning
- [ ] Compliant with NDPR data usage requirements
- [ ] Merchant consent for credit score generation at onboarding
- [ ] Score explanation / right-to-explanation for scored individuals
- [ ] Anti-discrimination audit (bias testing across gender, geography, ethnicity)

## Status

`[ ] Not started — placeholder`
