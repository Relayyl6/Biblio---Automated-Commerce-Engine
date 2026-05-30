# Data Intelligence — Enterprise Data Products

> ACE's secondary business. The most valuable dataset in emerging markets.

---

## The Core Thesis

ACE's primary product (merchant automation) is a real-time sensor network across the most opaque economy on Earth. By operating at scale, we capture data that **literally doesn't exist in structured form anywhere else**:

- Hyper-localised demand signals from informal commerce
- Conversational commerce patterns in 47 dialects
- Alternative credit behaviour of the unbanked
- Real-time FMCG product movement at street level
- Pricing elasticity in informal markets

**This data is ungoogleable, unscrapeable, and unimaginably valuable.**

---

## The Scale AI Playbook

| Scale AI | ACE |
|----------|-----|
| Started with unglamorous utility (AV labelling) | Start with merchant automation |
| Pivoted to RLHF when LLMs exploded | Pivoting to conversational commerce data |
| Became infrastructure layer for giants | Becoming the data layer for global AI + FMCG + finance |
| $14B valuation | Our trajectory |

**Phase 1 (Years 1–2):** Primary product is the Trojan Horse — captures the data stream  
**Phase 2 (Year 2–3):** Build HITL verification, PII scrubbing, enterprise packaging  
**Phase 3 (Year 3–5):** Enterprise data products become the primary revenue engine

---

## Enterprise Products

| Product | Folder | Target Buyers | Year 2 ARR |
|---------|--------|---------------|------------|
| [AI Training Data Marketplace](./ai-training-marketplace/) | `ai-training-marketplace/` | OpenAI, Anthropic, Google DeepMind, Meta AI, Cohere, Mistral | $7.2M |
| [FMCG Market Intelligence](./fmcg-intelligence/) | `fmcg-intelligence/` | Unilever, Nestlé, P&G, PZ Cussons, Dangote | $5.76M |
| [ACE TrustScore API](./trust-score-api/) | `trust-score-api/` | Kuda, FairMoney, Carbon, GTBank, Access Bank, MFIs | $3.57M |
| **Total Year 2 B2B** | | | **$16.53M** |

Combined with B2C merchant subscription revenue: **$24.8M ARR Year 2 projection**

---

## Revenue Projections (5-Year)

| Product | Year 3 | Year 4 | Year 5 |
|---------|--------|--------|--------|
| Dataset Licensing | $2.4M | $8.1M | $18M |
| Proprietary ASR API | $1.8M | $6.4M | $15M |
| FMCG Intelligence | $6M | $12M | $22M |
| Credit Scoring | $3.5M | $8.2M | $16M |
| **Total B2B** | **$13.7M** | **$34.7M** | **$71M** |

---

## Data Governance (Critical — To Be Developed)

- [ ] NDPR (Nigeria Data Protection Regulation) compliance framework
- [ ] Merchant consent and data usage disclosure at onboarding
- [ ] Customer anonymisation standards (PII scrubbing + tokenisation)
- [ ] Differential privacy implementation
- [ ] Enterprise Data Processing Agreements (DPAs)
- [ ] Data residency requirements per market (NG, KE, GH, ZA)

---

## Data Pipeline (Relationship to Products)

```
ace-whatsapp/ai/data-refinement/    ← Produces the raw assets
        │
        ▼
data-intelligence/
  ├── ai-training-marketplace/      ← Packages for AI labs
  ├── fmcg-intelligence/            ← Packages for FMCG brands
  └── trust-score-api/              ← Packages for banks/fintechs
        │
        ▼
ace-platform/services/analytics/    ← Enterprise buyer dashboards (Phase 2)
```
