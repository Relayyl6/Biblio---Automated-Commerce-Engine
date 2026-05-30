# Financial Model

> **ACE Technologies Limited**  
> Status: Draft — internal planning document  
> Last updated: 2026-05-30

---

## The Business Model

ACE operates a **dual revenue architecture**: a B2C merchant subscription product (the primary product and data collection engine) and a B2B enterprise intelligence business (the true long-term value driver).

```
B2C Merchant Subscriptions        B2B Enterprise Data Products
─────────────────────────         ────────────────────────────
Predictable monthly revenue       High-margin, scalable ARR
Data collection engine            The strategic moat
Lower revenue per merchant        Higher revenue per client
Scales with merchant count        Scales with data quality + volume
```

---

## B2C: Merchant Subscription Pricing

### Subscription Tiers

| Tier | Monthly Price | Annual Price | Who It's For |
|------|--------------|--------------|-------------|
| **Starter** | ₦12,000 (~$14) | ₦120,000 (~$140) | Solo merchants, ≤ 30 orders/month |
| **Growth** | ₦35,000 (~$40) | ₦350,000 (~$410) | Small teams, 31–150 orders/month |
| **Scale** | ₦120,000 (~$140) | ₦1,100,000 (~$1,280) | High-volume merchants, distributors |
| **Enterprise** | Custom | Custom | Wholesalers, multi-location operations |

### What's Included in Each Tier

| Feature | Starter | Growth | Scale | Enterprise |
|---------|---------|--------|-------|------------|
| Autonomous order fulfillment | ✓ | ✓ | ✓ | ✓ |
| AI Negotiator | ✓ | ✓ | ✓ | ✓ |
| Payment verification | ✓ | ✓ | ✓ | ✓ |
| Logistics dispatch | ✓ | ✓ | ✓ | ✓ |
| Vendor Communiqué (SMS) | ✓ | ✓ | ✓ | ✓ |
| Inventory Oracle | — | ✓ | ✓ | ✓ |
| Demand-driven restocking | — | ✓ | ✓ | ✓ |
| Customer retention engine | — | ✓ | ✓ | ✓ |
| Visual product resolution (IG/FB) | — | ✓ | ✓ | ✓ |
| Exclusive supplier network access | — | ✓ | ✓ | ✓ |
| Multi-channel (IG DM, Messenger) | — | — | ✓ | ✓ |
| Advanced analytics dashboard | — | — | ✓ | ✓ |
| Dedicated account manager | — | — | — | ✓ |
| SLA guarantee (99.9% uptime) | — | — | — | ✓ |

---

## Unit Economics — Starter Tier (Conservative Base Case)

### Per Merchant, Per Month

| Item | Amount |
|------|--------|
| **Revenue** | ₦12,000 |
| WhatsApp API costs (2.3 msg/order × 80 orders × $0.01) | –₦2,160 ($2.50) |
| Payment processing (bank API, virtual accounts) | –₦800 |
| Logistics margin (platform pricing, zero for merchant — ACE earns on volume renegotiation) | ₦0 |
| LLM inference costs (GPT-4o, est. 80 orders × 5K tokens) | –₦1,200 |
| Infrastructure (proportional share of Kafka, PG, Redis) | –₦900 |
| **Gross Contribution** | **₦6,940 (~57.8% gross margin)** |

### Assumptions
- WhatsApp message consolidation: 2.3 messages per completed order (vs 5–7 industry avg)
- 78% of conversations within free 24hr service window
- Meta API cost: < $2.50/month per merchant
- LLM cost reduction: fine-tuned models by Month 12 reduce inference cost by ~60%

---

## Customer Acquisition Cost (CAC) & LTV

| Metric | Starter | Growth | Scale |
|--------|---------|--------|-------|
| **CAC (blended)** | ₦8,400 | ₦25,000 | ₦80,000 |
| **Monthly gross contribution** | ₦6,940 | ₦21,250 | ₦82,000 |
| **CAC payback period** | 1.2 months | 1.2 months | 1.0 months |
| **Average merchant lifespan (est.)** | 36 months | 48 months | 60 months |
| **LTV** | ₦249,840 | ₦1,020,000 | ₦4,920,000 |
| **LTV : CAC ratio** | **29.7:1** | **40.8:1** | **61.5:1** |

**CAC breakdown:**
- WhatsApp/Instagram referral campaigns: 35%
- Market-level partnerships (Balogun Market, Computer Village): 30%
- Agent network (merchant-referral programme): 25%
- Direct outreach (SDR team): 10%

---

## Churn Analysis

**Churn is structurally suppressed by the four moats:**

| Merchant leaving ACE loses | Monthly cost |
|---------------------------|-------------|
| Aggregate logistics pricing | ₦20,000 |
| Escrow-backed customer trust (revenue impact) | ₦35,000 |
| Exclusive supplier discounts | ₦15,000 |
| Global Buyer ID 1-tap checkout network | ₦40,000 |
| **Total cost of leaving** | **₦110,000/month** |
| **Cost of staying (Starter subscription)** | **₦12,000/month** |

**Projected annual churn rates:**
- Month 1–6 (pre-moat embedding): 8% monthly
- Month 7–12 (moats active, logistics + supplier): 4% monthly
- Year 2+ (Global Buyer ID network effect live): < 2% monthly

---

## Revenue Projections

### Merchant Count Assumptions

| | Year 1 | Year 2 | Year 3 | Year 5 |
|--|--------|--------|--------|--------|
| **Beta merchants (Lagos)** | 50 | — | — | — |
| **Starter merchants** | 1,200 | 8,500 | 22,000 | 85,000 |
| **Growth merchants** | 180 | 1,800 | 6,500 | 28,000 |
| **Scale merchants** | 20 | 240 | 1,200 | 6,000 |
| **Total merchants** | **1,400** | **10,540** | **29,700** | **119,000** |

### B2C ARR (Subscription Revenue)

| | Year 1 | Year 2 | Year 3 | Year 5 |
|--|--------|--------|--------|--------|
| Starter MRR | ₦14.4M | ₦102M | ₦264M | ₦1.02B |
| Growth MRR | ₦6.3M | ₦63M | ₦227.5M | ₦980M |
| Scale MRR | ₦2.4M | ₦28.8M | ₦144M | ₦720M |
| **Total MRR** | **₦23.1M** | **₦193.8M** | **₦635.5M** | **₦2.72B** |
| **Annual ARR (USD)** | **$1.2M** | **$8.27M** | **$26.5M** | **$113M** |

### B2B ARR (Enterprise Data Products)

| Product | Year 2 | Year 3 | Year 5 |
|---------|--------|--------|--------|
| AI Training Data Marketplace | $7.2M | $2.4M (+ASR) | $33M |
| FMCG Market Intelligence | $5.76M | $6M | $22M |
| ACE TrustScore API | $3.57M | $3.5M | $16M |
| Proprietary ASR API | — | $1.8M | $15M |
| **Total B2B ARR** | **$16.53M** | **$13.7M** | **$86M** |

> Note: Year 3 B2B appears lower than Year 2 due to Year 2 including one-time large dataset licensing deals; recurring contract base grows steadily.

### Combined Revenue

| | Year 1 | Year 2 | Year 3 | Year 5 |
|--|--------|--------|--------|--------|
| B2C (subscriptions) | $1.2M | $8.27M | $26.5M | $113M |
| B2B (enterprise data) | — | $16.53M | $13.7M | $86M |
| **Total ARR** | **$1.2M** | **$24.8M** | **$40.2M** | **$199M** |

---

## Cost Structure

### Year 1 (18-Month Runway)

| Category | Monthly | Annual |
|----------|---------|--------|
| Engineering team (6 FTEs: 2 Rust, 2 Python/AI, 1 RN, 1 infra) | $28,000 | $336,000 |
| AWS af-south-1 (compute, storage, managed services) | $8,500 | $102,000 |
| WhatsApp API + Meta fees | $3,500 | $42,000 |
| OpenAI API (GPT-4o inference) | $4,200 | $50,400 |
| Data labelling (HITL workforce) | $2,000 | $24,000 |
| Sales & marketing | $6,000 | $72,000 |
| Legal, compliance, NDPR | $1,500 | $18,000 |
| Operations & admin | $2,800 | $33,600 |
| **Total monthly burn** | **$56,500** | **$678,000** |

### Funding Requirement

- **Seed round target:** $1.5M USD
- **Runway:** 18 months (to demo + commercial launch)
- **Use of funds:**
  - Engineering: 55% ($825K)
  - Infrastructure: 18% ($270K)
  - Market development + merchant acquisition: 15% ($225K)
  - Legal, compliance, admin: 7% ($105K)
  - Working capital: 5% ($75K)

- **Breakeven merchant count:** ~2,400 merchants (achievable by Month 14 on current trajectory)

---

## Key Financial Metrics to Track

| Metric | Month 6 Target | Month 12 Target | Year 2 Target |
|--------|---------------|----------------|---------------|
| Active merchants | 150 | 800 | 10,000+ |
| Monthly Gross Revenue | ₦3.5M | ₦18M | ₦194M |
| Blended gross margin | 45% | 55% | 65% |
| Meta API cost per merchant | < $3 | < $2.50 | < $1.80 |
| Average messages per order | < 3.0 | < 2.3 | < 2.0 |
| Monthly merchant churn | < 8% | < 5% | < 2% |
| Net Revenue Retention | > 105% | > 115% | > 130% |

> **NRR > 100% is achievable** because merchants naturally upgrade tiers as their order volume grows, and the Global Buyer ID network effect makes subscription expansion the rational choice.
