# Data Collection Architecture

> **ACE — Data Collection for Enterprise Data Products**  
> How every interaction becomes a sellable asset

---

## The Fundamental Architecture Insight

ACE collects data at **three levels simultaneously** from every single interaction:

```
[Customer WhatsApp message]
          │
          ├──► Level 1: COMMERCE SIGNALS
          │    (what was bought, at what price, from where, when)
          │    → Feeds: FMCG Intelligence product, TrustScore API
          │
          ├──► Level 2: LANGUAGE SIGNALS  
          │    (how people talk about commerce in dialect)
          │    → Feeds: AI Training Data Marketplace
          │
          └──► Level 3: BEHAVIOURAL SIGNALS
               (payment patterns, reliability, retention)
               → Feeds: TrustScore API, FMCG Intelligence
```

Zero additional data collection effort. ACE's primary product *is* the data collection mechanism.

---

## Data Taxonomy — What We Collect

### Type A: Conversational Commerce Transcripts
**Feeds:** AI Training Data Marketplace

| Field | Description | Enterprise Value |
|-------|-------------|-----------------|
| `raw_utterance` (PII-scrubbed) | Original message text | NLP training |
| `normalised_text` | Dialect → Standard English | Translation pair |
| `dialect_tag` | pidgin / yoruba / hausa / igbo / code_switch | Dialect classification |
| `intent_label` | purchase / payment / enquiry / etc. | Intent classification |
| `audio_transcript_pair` | (audio file, corrected transcript) | ASR fine-tuning |
| `merchant_correction` | AI output vs human preferred output | RLHF preference pairs |

**Unique value to buyers:** Real conversational commerce data in Nigerian dialects does not exist anywhere else. It's not scraped text — it's goal-oriented, real transactions.

---

### Type B: Demand & Commerce Signals
**Feeds:** FMCG Market Intelligence

| Field | Description | Enterprise Value |
|-------|-------------|-----------------|
| `product_category` | FMCG category (normalised) | Category demand tracking |
| `product_name` | Normalised SKU name | SKU-level signals |
| `enquiry_count` | Number of customer enquiries per SKU | Pre-purchase demand signal |
| `purchase_count` | Completed transactions per SKU | Actual sell-through |
| `geo_area` | Local government area / neighbourhood | Hyper-local demand map |
| `price_point` | Transaction price | Price elasticity data |
| `competitor_mentioned` | When customers mention competitor brands | Competitive intelligence |
| `stockout_event` | When product ran out + demand at time | Supply gap signal |
| `timestamp` | Time of interaction | Seasonality, trend detection |

**Processing:** Aggregated across all merchants in a geography. No individual merchant's data is identifiable to FMCG buyers. Delivered as aggregate heatmaps, not raw rows.

---

### Type C: Merchant Behavioural Signals
**Feeds:** ACE TrustScore API

| Signal | How Derived | Credit Proxy |
|--------|-------------|-------------|
| Order fulfillment rate | Completed / created orders ratio | Reliability |
| Payment punctuality to suppliers | Time from PO approval to supplier payment | Financial discipline |
| Revenue stability coefficient | Std deviation of weekly revenue | Cash flow predictability |
| Customer complaint rate | Disputes / total orders | Quality proxy |
| Repeat customer rate | Customers with 2+ orders / total customers | Business health |
| Response time consistency | Std deviation of AI + merchant response times | Operational reliability |
| Commitment follow-through | "I'll send tomorrow" → actually does? | Integrity signal |
| LTV distribution | P90 customer LTV / P10 customer LTV | Business quality |

**Note:** Merchant must consent to credit scoring at onboarding. Opt-in only. Score generated only after 90 days of platform usage (minimum data quality threshold).

---

### Type D: Goods-Level Product Intelligence
**Feeds:** FMCG Market Intelligence, Supplier Intelligence, TrustScore (inventory reliability)

This is the data type most unique to ACE. Every SKU sold on the platform generates a structured **product event** — not aggregated, not delayed, not inferred. Real sell-through data at the exact moment of transaction.

| Field | How Captured | Enterprise Value |
|-------|-------------|-----------------|
| `sku_name` (normalised) | From merchant catalogue | SKU-level demand tracking |
| `category` | Merchant-tagged + AI inferred | Category intelligence |
| `units_sold` | State Machine: inventory decrement | Volume signal |
| `transaction_price` | Payment Verification: exact amount | Real price (not listed price) |
| `listed_price` | Product catalogue | Discount / elasticity spread |
| `negotiated_discount_pct` | AI Negotiator: anchor vs close | Price elasticity per SKU |
| `geo_lga` | Delivery address → LGA mapping | Hyper-local demand map |
| `customer_tier` | Identity Resolution | Segment purchasing patterns |
| `stockout_proximity` | Inventory Oracle: stock at time of sale | Scarcity-demand correlation |
| `reorder_velocity` | Days between merchant reorders of same SKU | Supply chain signal |
| `enquiry_to_purchase_ratio` | Enquiries for SKU / completed purchases | Conversion rate per product |
| `brand_mentioned_by_customer` | NLP on customer messages | Brand awareness signal |
| `competitor_mentioned` | NLP on customer messages | Competitive switching signal |

**The FMCG insight this creates:**

A brand like Unilever currently knows: "We shipped 10,000 units of Close-Up toothpaste to Lagos."

ACE tells them: "In Surulere specifically, Close-Up 75ml sold at an average of ₦850 (vs your recommended ₦900), with 63% of customers who asked about it completing the purchase, and 12% mentioning Oral-B in the same conversation. Demand velocity is up 23% vs last month. There are 340 enquiries with no merchant stock available — unfulfilled demand."

**That intelligence — real-time, SKU-level, street-level — does not exist anywhere else.**

---

### Type E: Negotiation Intelligence
**Feeds:** FMCG Price Elasticity, AI Training Data (RLHF pairs), TrustScore

Every AI Negotiator interaction generates a `NegotiationTrace` — a complete record of the negotiation arc from anchor to close.

| Signal | Enterprise Value |
|--------|-----------------|
| Anchor price (listed) | Baseline for elasticity calculation |
| Customer first offer | True willingness-to-pay signal |
| Counter-offer sequence | Negotiation dynamics by customer tier |
| Final close price | Actual transaction price elasticity |
| Tactic deployed → succeeded / failed | AI training: tactic effectiveness data |
| Bundle acceptance rate | Product affinity / bundling intelligence |
| Abandonment price point | Demand cliff — price at which customers leave |
| Dialect of negotiation | Language signal for code-switching research |

**Price elasticity at this granularity** — per SKU, per geography, per customer tier, per season — is exactly what FMCG pricing teams pay $200K+ research projects to estimate. ACE generates it continuously, at zero marginal cost.

---

## Kafka Topic Architecture for Data Collection

```
training.interactions.raw          ← All raw Vercel AI SDK interaction traces
training.interactions.hitl         ← Needs human review (confidence 0.70–0.95)
training.interactions.verified     ← Ready for training (confidence ≥ 0.95 OR HITL-approved)
training.interactions.corrections  ← Merchant override signals (highest quality RLHF pairs)
training.interactions.adversarial  ← Injection attempts and adversarial inputs

commerce.events.demand             ← Product enquiries and purchase events (for FMCG)
commerce.events.transactions       ← Completed transactions with price/geo metadata
commerce.events.stockouts          ← Stock-out events and demand context
commerce.events.product_intel      ← Goods-level data: SKU sold, price, geo, tier, elasticity

negotiation.events.traces          ← Full NegotiationTrace per AI Negotiator session
negotiation.events.escalations     ← Below-floor escalations sent to merchant (communiqué)
negotiation.events.outcomes        ← Closed / abandoned / bundle-closed outcomes

vendor.decisions                   ← Merchant decisions via SMS/WhatsApp/app/voice
vendor.communique.sent             ← Log of all communiqués sent (channel, type, timing)

merchant.signals.behavioral        ← Fulfillment rates, response times, etc.
merchant.signals.financial         ← Payment patterns, cash flow signals
merchant.signals.supplier          ← Supplier payment behaviour

data.enterprise.ready              ← Post-processed, PII-clean, enterprise-ready signals
```

---

## Data Processing Pipeline (Airflow DAGs)

### DAG 1: `ace_language_data_pipeline` (hourly)
```
Kafka: training.interactions.verified
  → PII scrub (NER model)
  → Dialect quality check (confidence ≥ 0.90)
  → Format: { audio?, transcript, normalised, intent, dialect, correction? }
  → Write to: S3/ace-training-data/language/{date}/{dialect}/
  → Update: dataset_registry (row count, quality metrics, coverage)
```

### DAG 2: `ace_fmcg_signal_pipeline` (15-minute intervals)
```
Kafka: commerce.events.demand + commerce.events.transactions
  → Aggregate by: (product_category, geo_area, time_window)
  → Compute: enquiry_velocity, purchase_velocity, stockout_risk
  → Anonymise: remove merchant identity, aggregate only
  → Write to: ClickHouse (fmcg_demand_signals table)
  → Push to: FMCG Market Pulse API (live dashboard)
```

### DAG 3: `ace_trustscore_pipeline` (nightly)
```
merchant.signals.behavioral + merchant.signals.financial
  → Compute: 5 signal category scores (0–100 each)
  → Apply: weighted scoring model → 300–850 TrustScore
  → Validate: score against historical loan performance data (once we have it)
  → Write to: PostgreSQL trust_scores table
  → Expose: TrustScore API endpoint
```

### DAG 4: `ace_enterprise_dataset_compiler` (weekly)
```
S3: ace-training-data/ (7-day batch)
  → Dedup, consistency check
  → Balance: ensure dialect distribution is representative
  → Generate: dataset manifest (row counts, dialect breakdown, date range, quality stats)
  → Package: .jsonl + audio/ + metadata.json → S3 enterprise delivery bucket
  → Notify: enterprise client portal (new dataset available)
  → Log: revenue event (dataset download = billing trigger)
```

---

## Enterprise Data Delivery Architecture

### AI Labs — Dataset Access
```
Client authenticates → Enterprise Admin Portal
  → Browses dataset catalogue (by dialect, date range, vertical, size)
  → Selects dataset → generates time-limited S3 presigned URL
  → Downloads: .jsonl transcripts + paired audio + metadata

OR: Federated learning
  → Client submits model checkpoint to ACE compute cluster
  → Training runs on ACE servers (data never leaves)
  → Client receives: updated model weights only
```

### FMCG Brands — Live API
```
REST API: GET /v1/intelligence/fmcg/demand
  → Query params: product_category, geo_area, time_range, aggregation_window
  → Response: time-series demand velocity + competitor signals + stockout risk
  → Rate limited by subscription tier

WebSocket: ws://intelligence.ace.io/fmcg/live
  → Real-time demand signal stream (for premium tier)
  → Push updates when demand velocity spikes ≥ 2x baseline
```

### Banks / Fintechs — TrustScore API
```
REST API: POST /v1/intelligence/trustscore
  → Input: { phone_number_hash OR merchant_id }
  → Output: { score: 742, band: "Good", signals: {...}, confidence: 0.89 }
  → Billing: per-query (webhook confirms successful response)

Batch API: POST /v1/intelligence/trustscore/batch
  → Input: array of merchant IDs (max 10K per request)
  → Output: async job → webhook delivery on completion
  → Billing: per-record in batch
```

---

## Data Quality Standards

| Metric | Threshold | Action if Below |
|--------|-----------|-----------------|
| Dialect detection confidence | ≥ 0.90 | → HITL queue |
| PII scrub completeness | 100% | → Hold, manual audit |
| Inter-annotator agreement | ≥ 0.85 | → Re-annotate |
| Transcript accuracy (WER) | ≤ 15% | → HITL correction |
| FMCG signal completeness | ≥ 95% fields populated | → Exclude from aggregate |
| TrustScore data vintage | ≤ 90 days old | → Staleness flag |

---

## Consent & Compliance Architecture

### Merchant Consent (at onboarding)
- Explicit tick-box consent for:
  - [ ] Anonymised conversation data used to improve ACE AI
  - [ ] Anonymised transaction signals used for market intelligence (FMCG product)
  - [ ] Business behavioural data used for credit scoring (TrustScore product)
- Granular opt-out: merchant can opt out of each independently
- Consent stored: immutable log in PostgreSQL with timestamp + version of consent text shown

### Customer Consent
- WhatsApp opt-in message on first interaction: _"By messaging [Merchant], you agree to ACE's terms..."_
- Link to privacy policy (PWA-hosted)
- Right to deletion: customer can request data removal (NDPR Article 17 equivalent)

### Data Residency
- All raw data stored in Nigeria/Africa-region (AWS af-south-1 or equivalent)
- Processed data (anonymised enterprise signals) can be delivered globally
- Raw audio: never leaves Africa region (data sovereignty)
- AI lab federated learning: compute runs on ACE infrastructure (data never moves)

---

## Monetisation Events (How Data Revenue Is Triggered)

| Event | Revenue Trigger |
|-------|----------------|
| AI lab downloads dataset | Billing: rows downloaded × $0.08 |
| AI lab submits federated learning job | Billing: GPU-hours × $2,500 |
| FMCG API monthly access | Recurring: $25K/month per brand |
| FMCG API query (programmatic) | Billing: $15K/month for API tier |
| TrustScore API single query | Billing: $0.45 per call |
| TrustScore batch job completed | Billing: $0.22 × records in batch |
| Custom enterprise research project | Bespoke: $75K–$200K per project |

All billing events flow through the Enterprise Admin Portal → invoiced monthly or via prepaid credit.
