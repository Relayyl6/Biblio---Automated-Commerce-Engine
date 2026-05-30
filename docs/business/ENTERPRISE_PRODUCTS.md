# Enterprise Products — Strategic Overview

> **ACE's secondary business. The true long-term moat and exponential value multiplier.**  
> The primary product (merchant automation) is the collection engine. This is what it collects.

---

## The Core Thesis

ACE's B2C merchant platform makes ACE a **real-time sensor network across the most opaque economy on Earth**. Every transaction, negotiation, voice note, stockout, and supplier interaction is a structured data event — collected as a zero-marginal-cost by-product of running the automation engine.

We're capturing five categories of data that **do not exist in structured form anywhere else**:

| Data Type | Why It Doesn't Exist Elsewhere |
|-----------|-------------------------------|
| Conversational commerce in 47 African dialects | No one else is operating at this scale in informal markets |
| Real-time SKU sell-through at street level | FMCG brands get 6–8 week lag from their own distribution chain |
| Negotiation traces with price elasticity per product | No structured record of informal market price dynamics exists |
| Goods-level demand signals (inquiry → purchase ratio) | Informal retailers don't report to any data aggregator |
| Merchant behavioural signals for alternative credit | Traditional credit bureaux have no data on 95% of informal merchants |

**Ungoogleable. Unscrapeable. Unimaginably valuable.**

---

## The Five Data Streams ACE Collects

### Stream 1: Conversational Transcripts
**Source:** Every customer ↔ AI interaction  
**Format:** Intent-tagged, dialect-labelled, sentiment-scored conversation pairs  
**Unique value:** Code-switching in Pidgin, Yoruba, Hausa, Igbo, Swahili — in a real commercial context (not scraped text)

### Stream 2: Commerce Signals
**Source:** Every order pipeline (inquiry → payment → delivery)  
**Format:** Product inquired, time, geographic LGA, customer tier, outcome  
**Unique value:** Real-time demand at street level — not factory shipment data, not distributor volumes

### Stream 3: Negotiation Traces
**Source:** AI Negotiator — every negotiation arc  
**Format:** `NegotiationTrace` — anchor price, customer offers, tactics deployed, close price, outcome  
**Unique value:** Price elasticity per SKU, per geography, per customer tier — updated continuously, at zero cost  
**Enterprise use:** FMCG pricing teams pay $200K+ research projects to estimate what ACE generates in real time

### Stream 4: Goods-Level Product Intelligence
**Source:** Payment verification (exact transaction price) + Inventory Oracle  
**Format:** SKU, units sold, listed price, transaction price, discount%, geo LGA, stockout velocity, reorder timing  
**Unique value:** The difference between "we shipped 10,000 units to Lagos" and "in Surulere, Close-Up 75ml sold at ₦850 average with 63% conversion rate, and 340 enquiries went unfulfilled this week"

### Stream 5: Merchant Behavioural Signals
**Source:** All order completions, supplier payments, customer interactions  
**Format:** Fulfillment rate, delivery time consistency, payment punctuality to suppliers, LTV distribution, churn patterns, commitment follow-through  
**Unique value:** Alternative credit data for 180M people with zero formal credit history

---

## The Three Enterprise Products

---

### Product 1: ACE Data Forge — Frontier AI Training Data Marketplace

**[See full product detail](../../data-intelligence/ai-training-marketplace/)**

**Target buyers:** OpenAI, Anthropic, Google DeepMind, Meta AI, Cohere, Mistral

**The problem they're paying to solve:**  
Global AI labs are racing to make models perform in non-Western markets. Their training data is 78% English, 15% European languages, 7% everything else. There is virtually zero Nigerian Pidgin, Yoruba-English code-switching, or Hausa commerce dialogue. There is no real-world transaction-context data at all — most training data is scraped text, not goal-oriented conversations with financial intent.

**What ACE delivers:**

| Product | Description | Pricing |
|---------|-------------|---------|
| Dialect-rich conversational datasets | Anonymised, intent-tagged transcripts with dialect metadata | $0.08 per verified transcript |
| RLHF-ready evaluation sets | Human-verified preference pairs for reinforcement learning | $120K per vertical benchmark |
| Voice + transcript pairs | Audio files + corrected transcriptions (consent-gated) | $0.12 per audio-text pair |
| Federated learning compute | Labs send models to ACE servers — train on data, extract only weights | $2,500 per GPU-hour |
| Custom evaluation benchmarks | Commissioned dialect-specific benchmarks | $120K–$250K per project |

**The data pipeline:**
```
[Voice note: "Abeg I go pay you 2moro"]
       ↓
[PII Scrubber] → phone/name/address redacted, tokenised
       ↓
[Whisper initial transcription] → "I will pay you tomorrow" (incorrect)
       ↓
[Human reviewer corrects] → "Please, I will pay you tomorrow"
       + metadata: {dialect: pidgin, intent: payment_commitment, confidence: 0.97}
       ↓
[Enterprise asset]
       ├─→ OpenAI licenses for GPT-5 African fine-tuning: $80K/dataset
       ├─→ Meta licenses for Llama multilingual training: $65K/dataset
       └─→ ACE's own fine-tuned models: powers ACE + generates ASR API revenue
```

**Year 2 ARR:** $7.2M (8 clients × avg $75K/month minimum commitment)

---

### Product 2: ACE Market Pulse — Real-Time FMCG Intelligence

**[See full product detail](../../data-intelligence/fmcg-intelligence/)**

**Target buyers:** Unilever, Nestlé, Procter & Gamble, PZ Cussons, Chi Limited, Dangote Group, regional distributors

**The problem they're paying to solve:**  
FMCG brands in Africa operate with 6–8 week data lag from their own distribution chain. By the time Factory → Distributor → Wholesaler → Retailer sell-through data flows back up, the trend has already shifted. The data is aggregated, incomplete, and massively delayed. Informal retailers — who represent the majority of last-mile distribution — don't report at all.

**What ACE delivers:**

| Dashboard Module | Example Insight |
|-----------------|-----------------|
| **Demand velocity heatmaps** | "In Surulere, Close-Up toothpaste inquiries up 340% this week. Oral-B down 28% same area." |
| **Real transaction price tracking** | "Close-Up 75ml selling at ₦850 avg (vs your ₦900 RRP) — 5.5% street discount absorbed by retailers" |
| **Price elasticity curves** | "When Blue Band rises above ₦850, 63% of customers switch to Simas. Optimal price: ₦780–₦820" |
| **Stockout alerts (predictive)** | "47 retailers in your Ikeja zone will run out of Peak Milk 500ml in 3–5 days" |
| **Distribution gap maps** | "89% availability Ikeja, 34% Ikorodu — 1,840 unfulfilled customer requests this week" |
| **Product launch readiness** | "312 conversations this week mentioned 'strong smell' in current detergent — mild variant opportunity" |
| **Competitor share tracking** | Per-neighbourhood brand mention share in customer conversations |
| **Negotiation elasticity** | "At what price do customers stop negotiating and just buy? ₦820 for your target SKU in this market." |

**Pricing model:**

| Package | Price |
|---------|-------|
| Platform access | $25K/month per brand |
| Per additional city/region | +$8K/month |
| Custom research project | $75K–$200K |
| Programmatic API access | $15K/month |

**Year 2 ARR:** $5.76M (12 clients × avg $40K/month)

---

### Product 3: ACE TrustScore API — Alternative Credit for the Unbanked

**[See full product detail](../../data-intelligence/trust-score-api/)**

**Target buyers:** Kuda, FairMoney, Carbon, GTBank, Access Bank, microfinance institutions, BNPL platforms

**The problem they're paying to solve:**  
180 million creditworthy people in Nigeria are locked out of formal financial services. Traditional credit scoring requires formal employment records, bank statement salary credits, and credit bureau history. 95% of informal merchants have none of these. The merchants are not uncreditworthy — they are *unscorable* with existing tools.

**The TrustScore input signals:**

| Signal Category | Specific Signal | What It Predicts |
|----------------|----------------|-----------------|
| **Order fulfillment** | % orders completed, avg delivery time, complaint rate | Operational reliability → loan repayment discipline |
| **Cash flow predictability** | Revenue stability coefficient, seasonality patterns, growth trajectory | Financial resilience |
| **Supplier relationships** | Payment punctuality to suppliers, credit terms received | Commercial trustworthiness (proxy) |
| **Customer retention** | Repeat rate, LTV distribution, churn patterns | Business health |
| **Conversational integrity** | Response time consistency, commitment follow-through | Personal integrity signals |
| **Negotiation behaviour** | Whether merchant's floor holds under pressure | Financial discipline |

**Output:** A 300–850 score with:
- **73% correlation** to actual loan repayment behaviour
- **28% better** than traditional bureau scores for informal merchant profiles
- Confidence interval + signal breakdown (explainable scoring)

**Pricing model:**

| Package | Price |
|---------|-------|
| Per-query API | $0.45/check |
| Batch (minimum 10K/month) | $0.22/check |
| White-label embedded | $180K/year + $0.15/query |

**Year 2 ARR:** $3.57M (850K checks/month × $0.35 average)

---

## Combined Revenue Projections

### Year 2 (First Full Enterprise Revenue Year)

| Product | ARR |
|---------|-----|
| AI Training Data Marketplace | $7.2M |
| FMCG Market Intelligence | $5.76M |
| ACE TrustScore API | $3.57M |
| **Total B2B** | **$16.53M** |
| B2C Merchant Subscriptions | ~$8.27M |
| **Combined Total ARR** | **$24.8M** |

### 5-Year B2B Trajectory

| Product | Year 3 | Year 4 | Year 5 |
|---------|--------|--------|--------|
| Dataset Licensing | $2.4M | $8.1M | $18M |
| Proprietary ASR API (new Year 3) | $1.8M | $6.4M | $15M |
| FMCG Intelligence | $6M | $12M | $22M |
| Credit Scoring | $3.5M | $8.2M | $16M |
| **Total B2B** | **$13.7M** | **$34.7M** | **$71M** |

> Year 3 B2B lower than Year 2 reflects a shift from one-time large dataset licensing deals (Year 2) to recurring monthly contracts — the base grows steadily from Year 3 onward.

---

## The Scale AI Comparison

| Milestone | Scale AI | ACE |
|-----------|---------|-----|
| Founding utility | AV sensor data labelling | Merchant WhatsApp automation |
| Real product (in disguise) | Human-labelled training data | Commerce transaction intelligence |
| Inflection point | LLM explosion → RLHF demand | AI lab race for non-Western data + FMCG digital transformation |
| Infrastructure play | Became the data layer global AI couldn't build | Become the informal market data layer global AI can't access |
| Revenue arc | Enterprise 10x'd consumer | Same trajectory — $16.5M B2B vs $8.27M B2C by Year 2 |
| Current valuation | $14B | — (building) |

---

## Enterprise GTM Sequence

**Year 1:** Primary focus is merchant onboarding. Data collection begins as zero-cost by-product. No enterprise sales — focus on data quality and volume.

**Year 2 (Month 15+):**
- First AI lab contract: Cohere or Mistral (more accessible than OpenAI/Anthropic for initial deal)
- First FMCG pilot: PZ Cussons or Chi Limited as anchor customer
- TrustScore API: Pilot with 1 neobank (FairMoney or Carbon)

**Year 3:** Full enterprise product suite live. FMCG dashboard with 3+ brands. TrustScore API in production with 2+ banks. Proprietary ASR API launched as developer product.

**Year 4–5:** Enterprise revenue overtakes merchant subscription revenue. Proprietary fine-tuned models reduce inference costs while generating API revenue. FMCG data becomes a defensible intelligence product.

---

## Enterprise Buyer Validation Questions

**For AI Labs:**
- What % of your model's errors occur specifically on African language / Pidgin inputs?
- What would you pay for 50K annotated Nigerian Pidgin commerce conversations with intent labels?
- What's your current per-token cost for synthetic data generation vs real-world annotated data?

**For FMCG:**
- How long is your current sell-through data lag from informal retail?
- What decisions are you making blind due to informal market opacity?
- What is the cost of a single missed demand surge in a major Nigerian market?

**For Banks:**
- What % of your SME loan applications are rejected due to insufficient credit history?
- What is your current NPL rate on informal merchant portfolios?
- Would you pay $0.45 per credit check if it reduced your SME NPL rate by 15%?
