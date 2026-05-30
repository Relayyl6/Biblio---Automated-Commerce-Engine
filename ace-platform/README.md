# ACE Platform — Phase 2

> **The Full Commerce Operating System**  
> Status: Design phase — development begins post-Series A  
> Prerequisite: Phase 1 (ace-whatsapp/) demo-ready by October 2026

---

## What Phase 2 Is

Phase 1 (ACE WhatsApp) proves the autonomous commerce engine on a single channel. Phase 2 opens ACE into a full, multi-channel commerce OS — extending the same AI execution engine across every channel a merchant uses, adding a rich merchant dashboard for teams, and fully activating the enterprise data intelligence products that Phase 1 has been building toward.

Phase 2 is where **the Scale AI monetisation arc fully kicks in**: by this point, ACE has months of transaction data, trained dialect models, and a negotiation intelligence database that enterprise buyers are willing to pay tens of millions for.

---

## Phase 1 → Phase 2 Transition

| Capability | Phase 1 (WhatsApp) | Phase 2 (Platform) |
|------------|-------------------|---------------------|
| **Channels** | WhatsApp only | WhatsApp + Instagram DM + SMS + Voice + Web widget |
| **Merchant UI** | Exception dashboard + Vendor Communiqué SMS | Full commerce OS — teams, analytics, campaigns |
| **Customer UI** | WhatsApp → PWA | WhatsApp → PWA → native-quality web + app |
| **AI Negotiator** | Active on WhatsApp | Cross-channel — same negotiation logic, any channel |
| **Analytics** | Daily SMS/WA digest | Full BI: revenue forecasts, cohort analysis, demand curves |
| **Multi-user** | Single merchant login | Teams, roles, permissions, audit trails |
| **Supplier network** | WhatsApp template pings | Full supplier portal — orders, invoices, delivery tracking |
| **Data product** | Background collection, pipeline building | Active enterprise marketplace — AI labs, FMCG, banks |
| **API access** | Internal only | Full public API for 3rd-party integrations |
| **Merchant size** | SME (1–5 person, 30–150 orders/month) | Larger merchants, distributors, FMCG agent networks |
| **Infrastructure** | Docker Compose | Kubernetes — multi-region ready |

---

## The New Merchant Experience in Phase 2

### From Exception Dashboard → Full Commerce OS

Phase 1 merchants see a minimal exception queue. Phase 2 merchants have a full professional dashboard:

**Command Center (Web App):**
- Live revenue waterfall (real-time GMV, margin, orders/hour)
- AI-generated demand forecasts: "Based on current velocity, you'll need to reorder Blue Satin Midi by Thursday"
- Customer cohort analysis: LTV distribution, churn risk heatmap, re-engagement opportunities
- Team activity feed: what each sales agent is doing, which escalations they've handled
- Logistics SLA monitoring: carrier performance by route, average delivery time vs promise

**The AI Negotiator in Phase 2:**
The same autonomous negotiation engine from Phase 1, now operating across all channels simultaneously. A customer can start a negotiation on WhatsApp, continue it on Instagram DM, and complete checkout on the web widget — the AI Negotiator maintains full context across all channels.

**The Vendor Communiqué in Phase 2:**
SMS reply-code protocol remains for merchants who prefer it. Web dashboard adds a rich decision queue with full context, suggested actions, and one-click approvals. High-stakes decisions (> ₦500K orders, enterprise distribution contracts) get a dedicated review flow with full context and recommendation.

---

## Phase 2 New Services

### Multi-Channel Ingestion (`services/channels/`)

```
channels/
├── whatsapp/       # Phase 1 engine — unchanged, just imported
├── instagram/      # Instagram Business DM API
├── sms/            # Inbound SMS for low-smartphone markets (Africa's Talking)
├── voice/          # IVR voice ordering (Hausa/Yoruba markets)
└── web/            # Web chat widget for merchant websites
```

Each adapter normalises messages into the unified internal event format. The AI engine consumes normalised events — channel-agnostic. **Same AI, same negotiation logic, any surface.**

### Advanced CRM (`services/crm/`)

Phase 1: customer profiles are stored, segmented automatically.  
Phase 2: full CRM with:
- Custom segments (e.g., "VIP customers who haven't ordered in 14 days AND have LTV > ₦100K")
- Campaign management: AI drafts, merchant edits, ACE schedules and sends
- Automated re-engagement sequences triggered by behavioural signals
- Net Promoter Score collection post-delivery
- Cross-merchant customer journey view (Global Buyer ID powered)

### Supplier Portal (`services/suppliers/`)

Phase 1: suppliers receive WhatsApp template pings from ACE.  
Phase 2: suppliers get a lightweight web portal:
- View all pending purchase orders from ACE merchants
- Accept/decline/counter with one click
- Invoice management and payment tracking
- Delivery scheduling and status updates
- This turns ACE into a **B2B2B platform** — creating additional lock-in at the supply side

### Analytics Engine (`services/analytics/`)

- Real-time revenue dashboards (ClickHouse-powered, sub-second queries)
- Demand forecasting: per-SKU, per-area, per-season (time series ML on Phase 1 data)
- Customer LTV modelling: predictive cohort analysis
- Logistics performance: carrier SLA tracking, route optimisation suggestions
- AI performance monitoring: confidence scores, escalation rates, negotiation success rates
- **Data intelligence feeds:** this service is also the pipeline into the enterprise data products

---

## Phase 2 Enterprise Data Activation

Phase 2 is when the **Scale AI monetisation arc fully activates**. By this point:

- 12+ months of transaction data across 5,000–10,000 merchants
- Dialect BERT fine-tuned on real commerce conversations
- Negotiation traces with price elasticity for hundreds of SKU categories
- Goods-level sell-through data across multiple Nigerian cities
- Merchant behavioural signals for thousands of informal businesses

**This is when enterprise contracts become closing conversations, not exploratory ones.**

```
Phase 2 Enterprise Revenue Timeline:

Month 13–15: Close first AI lab contract (Cohere or Mistral)
             Dataset: 100K Nigerian Pidgin commerce conversations
             Value: $600K one-time + $75K/month ongoing

Month 14–16: Launch FMCG Market Pulse with 1 anchor client (PZ Cussons)
             Pilot: Lagos demand signals for 3 product lines
             Value: $25K/month pilot → $40K/month full contract

Month 16–18: TrustScore API pilot with FairMoney or Carbon
             500K credit checks/month at $0.35 average
             Value: $175K/month ARR

Month 18–24: Scale all three to full contracts
             Total B2B ARR target: $16.53M by end of Year 2
```

---

## Technology Decisions (Phase 2)

| Concern | Phase 1 | Phase 2 |
|---------|---------|---------|
| **Frontend** | React Native (mobile only) | Next.js web app + React Native mobile |
| **Orchestration** | Docker Compose | Kubernetes (GKE or EKS) |
| **API style** | Internal gRPC only | REST + gRPC (public REST API surface) |
| **Multi-region** | Single region (af-south-1) | Multi-region: Nigeria + Kenya + Ghana |
| **Analytics DB** | ClickHouse (Phase 1 basic) | ClickHouse + dbt (full transformation layer) |
| **AI training** | Phase 1 data collection only | Active fine-tuning pipeline on accumulated data |

---

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the full Phase 2 technical design.

---

## Key Documents

- [Phase 1 Foundation](../ace-whatsapp/ARCHITECTURE.md) — what Phase 2 builds on
- [Enterprise Products](../docs/business/ENTERPRISE_PRODUCTS.md) — what Phase 2 monetises
- [Financial Model](../docs/business/FINANCIAL_MODEL.md) — Phase 2 revenue projections
- [Go-to-Market](../docs/business/GO_TO_MARKET.md) — enterprise GTM sequence
- [AI Negotiator](../ace-whatsapp/core/ai-negotiator/README.md) — carries forward unchanged
- [Data Collection](../docs/engineering/DATA_COLLECTION.md) — what Phase 2 monetises

## Status

`[ ] Phase 2 design begins post-Series A · builds on Phase 1 learnings`
