# ACE Platform — Architecture

> Phase 2 Technical Architecture Document  
> Status: **Draft / Placeholder**  
> Last Updated: 2026-05-30

---

## Overview

ACE Platform is the evolution of the WhatsApp-native engine into a full, multi-channel commerce operating system. Where Phase 1 was invisible and WhatsApp-only, Phase 2 is a rich SaaS product that merchants actively operate — while retaining all the autonomy and AI execution that defined Phase 1.

Think **respond.io meets Shopify**, rebuilt for informal emerging market commerce, with an autonomous AI layer that executes rather than assists.

---

## Architecture Principles

1. **Multi-channel, channel-agnostic core** — Commerce logic is channel-independent. Channels are adapters.
2. **Phase 1 compatibility** — WhatsApp engine from Phase 1 becomes the `channels/whatsapp` service here.
3. **API-first** — All platform capabilities exposed as APIs; the web and mobile apps are consumers.
4. **Scale-ready** — Kubernetes-native from the start; designed for multi-region.
5. **Data as a product** — Every transaction enriches the data intelligence layer.
6. **Enterprise extensible** — Clean tenant isolation, API keys, webhooks for enterprise buyers.

---

## High-Level Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                          CHANNEL LAYER                                   │
│                                                                          │
│  WhatsApp  │  Instagram DM  │  SMS  │  Voice  │  Web Widget  │  Email    │
└────────────────────────────────┬─────────────────────────────────────────┘
                                 │ Normalised Message Events
                                 ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                        CHANNELS SERVICE                                  │
│                                                                          │
│  Per-channel adapters → unified internal event format                    │
│  Media handling, transcription, OCR (from Phase 1 Gateway)               │
└────────────────────────────────┬─────────────────────────────────────────┘
                                 │
                                 ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                         API GATEWAY                                      │
│                                                                          │
│  Authentication · Rate limiting · Routing · Tenant isolation             │
│  Public API (3rd-party) · Internal service mesh                          │
└────────────────────────────────┬─────────────────────────────────────────┘
                                 │
                    ┌────────────┴────────────┐
                    ▼                         ▼
┌───────────────────────────┐   ┌─────────────────────────────────────────┐
│       AI ENGINE           │   │           WEB APP / MOBILE APP          │
│                           │   │                                         │
│  (Enhanced Phase 1 AI)    │   │  Full merchant commerce OS              │
│  Multi-channel NLP        │   │  Team collaboration                     │
│  Autonomous execution     │   │  Analytics dashboards                   │
│  Cross-channel context    │   │  Campaign management                    │
└───────────┬───────────────┘   └─────────────────────────────────────────┘
            │ Domain Events
            ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                       MICROSERVICES LAYER                                │
│                                                                          │
│  ┌──────────┐ ┌──────────┐ ┌───────────┐ ┌─────┐ ┌──────────────────┐  │
│  │Inventory │ │ Payments │ │ Logistics │ │ CRM │ │    Analytics     │  │
│  └──────────┘ └──────────┘ └───────────┘ └─────┘ └──────────────────┘  │
└──────────────────────────────────┬───────────────────────────────────────┘
                                   │
                                   ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                     DATA INTELLIGENCE LAYER                              │
│                                                                          │
│  Transaction lake · Consumer demand signals · Credit signals             │
│  Language model training data · FMCG distribution signals               │
│                                                                          │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────┐   │
│  │  AI Labs API     │  │  FMCG Brand API  │  │  Bank Credit API     │   │
│  │  (training data) │  │  (demand signals)│  │  (alt credit scores) │   │
│  └──────────────────┘  └──────────────────┘  └──────────────────────┘   │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Application Breakdown

### `web-app`
The primary merchant-facing product. A rich, full-featured commerce OS.

**Key modules:**
- Unified inbox (all channels, all conversations)
- Order management
- Inventory management
- Customer CRM
- Analytics & reporting
- Campaign management (re-engagement, promotions)
- Team management & permissions
- Settings & integrations

---

### `mobile-app`
iOS and Android companion app. Optimised for merchants on the move.

**Key modules:**
- Unified inbox with push notifications
- Exception queue (AI escalations)
- Quick order status updates
- Inventory spot-checks
- Daily business summary

---

### `api-gateway`
The unified entry point for all external traffic and internal service communication.

**Key responsibilities:**
- JWT authentication and API key management
- Tenant (merchant) isolation
- Rate limiting and quota enforcement
- Request routing to microservices
- Webhook delivery to merchant-configured endpoints
- Public API documentation endpoint

---

### `ai-engine`
Enhanced version of the Phase 1 AI Engine. Cross-channel context awareness.

**Key enhancements over Phase 1:**
- Cross-channel conversation continuity (same customer, different channel)
- Richer entity models trained on Phase 1 data
- Active learning from merchant behaviour patterns
- Campaign trigger intelligence
- Demand forecasting signals fed to Analytics service
- Data quality scoring for intelligence product

---

### `admin-portal`
Dual purpose: ACE internal ops + enterprise client access.

**Internal ops module:** Same as Phase 1, enhanced for scale.

**Enterprise client module:**
- AI lab data access portal
- FMCG brand demand intelligence dashboard
- Bank credit score API console

---

## Service Breakdown

### `channels/`
Houses adapters for every supported communication channel. Each adapter normalises its channel's messages into the unified internal event format.

```
channels/
├── whatsapp/      # Evolved from Phase 1 whatsapp-gateway
├── instagram/     # Instagram Business DM API
├── sms/           # SMS (Africa's Talking, Twilio)
├── voice/         # Voice call handling (IVR flows)
└── web/           # Web widget / chat embed
```

### `analytics/`
Business intelligence and forecasting layer.

- Real-time revenue and order dashboards
- Demand forecasting (per product, per area, per season)
- Customer cohort analysis and LTV modelling
- Logistics performance metrics
- AI engine performance monitoring
- Data feeds to the intelligence product

### `data-intelligence/`
The enterprise data product layer. See also [`/data-intelligence/`](../data-intelligence/) at the monorepo root.

- Anonymised transaction dataset curation
- Consumer demand signal API
- Alternative credit score calculation and API
- Language model training dataset pipeline
- Enterprise buyer authentication and quota management

---

## New Integration Surface (Phase 2)

| Integration | Purpose |
|-------------|---------|
| Instagram Business API | DM commerce channel |
| Africa's Talking | SMS channel for low-smartphone markets |
| Voice/IVR providers | Voice-based order taking |
| Enterprise CDN | Web storefront hosting |
| Analytics warehouse | BI data store (BigQuery / Redshift / TBD) |
| Enterprise buyer APIs | Outbound data product delivery |

---

## Technology Decisions

> ⚠️ These are **placeholder / proposed** — to be confirmed during Phase 2 technical design.

| Concern | Phase 1 | Phase 2 Proposed |
|---------|---------|-----------------|
| Frontend | Lightweight web | React / Next.js (TBD) |
| Mobile | None | React Native / Flutter (TBD) |
| Orchestration | Docker Compose | Kubernetes |
| API style | Internal only | REST + GraphQL (TBD) |
| Analytics DB | TBD | ClickHouse / BigQuery (TBD) |
| Data pipeline | None | Apache Kafka + Spark (TBD) |

---

## Open Architecture Questions

- [ ] Monorepo vs separate repos for web-app and mobile-app?
- [ ] GraphQL vs REST for the merchant-facing API?
- [ ] Data intelligence delivery: push vs pull for enterprise buyers?
- [ ] Multi-region deployment strategy for NG/GH/KE/ZA?
- [ ] Privacy and data sovereignty requirements per market?

---

## Related Docs

- [Phase 1 Architecture](../ace-whatsapp/ARCHITECTURE.md) — Foundation this builds on
- [Data Intelligence Strategy](../data-intelligence/README.md)
- [API Contracts → docs/api/](./docs/api/)
- [Data Flow Diagrams → docs/flows/](./docs/flows/)
- [Architecture Decision Records → docs/decisions/](./docs/decisions/)
