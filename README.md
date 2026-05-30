# ACE — Autonomous Commerce Engine

> **"Your business runs itself while you sleep."**

**ACE Technologies Limited** — Nigerian C-Corp | Delaware flip option post-Series A

ACE is an invisible operating system for informal commerce. We turn WhatsApp chaos into autonomous businesses through radical AI automation. Merchants keep texting customers on WhatsApp — our AI handles inventory, payments, logistics, and customer retention completely in the background.

**No new apps for customers. No manual work for merchants. Just autonomous growth.**

---

## The Problem

In Nigeria and across emerging markets, **$2.3 trillion** in commerce happens entirely on WhatsApp. ~480,000 merchants in Lagos alone manage 30–150 customer conversations daily through unstructured text, voice notes in Pidgin, and screenshots of bank transfers. These merchants are growing 40% YoY but hit a hard ceiling at $50K annual revenue — they can't scale past their personal bandwidth.

Current tools fail them:
- **WhatsApp Business App** — Zero state management, no payment integration
- **Respond.io / Zoko** — Routes chats to human agents. Still requires merchants to check bank apps, call riders, update inventory
- **Shopify** — Requires customers to leave WhatsApp → 78% conversion drop
- **Traditional ERP** — Completely alien to merchants who think in conversations, not databases

---

## The Paradigm Shift

| ❌ What We're NOT Building | ✅ What We ARE Building |
|---------------------------|------------------------|
| An AI chatbot that drafts responses | An autonomous commerce OS that **executes** |
| A fancy CRM with "AI insights" | An event-driven state engine with no manual steps |
| Another unified inbox | Invisible back-office infrastructure |
| A tool requiring customers to change behavior | Invisible layer on top of existing WhatsApp behavior |

**The AI doesn't ask permission. It executes. The merchant's only job becomes exception management.**

---

## The Three-Layer Architecture

```
┌─────────────────────────────────────────────────────┐
│  LAYER 3: ENTERPRISE INTELLIGENCE PLATFORM (B2B)    │
│  AI Training Data · FMCG Intelligence · TrustScore  │
└────────────────────────┬────────────────────────────┘
                         │ Refined Data
┌────────────────────────▼────────────────────────────┐
│  LAYER 2: AUTONOMOUS STATE ENGINE (Core IP)         │
│  Event-driven Rust microservices                    │
│  10 services: Ingestion → Identity → Intent →       │
│  State Machine → Payment → Logistics → Supplier...  │
└────────────────────────┬────────────────────────────┘
                         │ Raw Events
┌────────────────────────▼────────────────────────────┐
│  LAYER 1: INTERFACE LAYER                           │
│  Merchant: React Native (Expo)                      │
│  Customer: WhatsApp → PWA → (eventual native app)   │
└─────────────────────────────────────────────────────┘
```

---

## The Two Product Phases

| | [`ace-whatsapp/`](./ace-whatsapp/) | [`ace-platform/`](./ace-platform/) |
|--|----------------------------------|----------------------------------|
| **Phase** | 1 — WhatsApp-native | 2 — Dedicated platform |
| **Channels** | WhatsApp only | WhatsApp + IG + SMS + Voice + Web |
| **Merchant UI** | React Native exception dashboard | Full commerce OS |
| **Customer UI** | WhatsApp → PWA | Multi-channel + native app |
| **Target** | SME merchants (1–5 person ops) | Larger merchants, distributors |
| **Timeline** | May–Oct 2026 (demo-ready) | Year 2+ |

---

## The Secondary Business (The Real Moat)

By processing millions of informal transactions, ACE builds the most valuable dataset in emerging markets — data that is **ungoogleable, unscrapeable, and unimaginably valuable**.

| Enterprise Product | Target Buyers | Year 2 ARR |
|-------------------|---------------|------------|
| [AI Training Data Marketplace](./data-intelligence/ai-training-marketplace/) | OpenAI, Anthropic, Google DeepMind, Meta AI | $7.2M |
| [FMCG Market Intelligence](./data-intelligence/fmcg-intelligence/) | Unilever, Nestlé, P&G, Dangote | $5.76M |
| [ACE TrustScore API](./data-intelligence/trust-score-api/) | Kuda, FairMoney, GTBank, MFIs | $3.57M |
| **Total B2B** | | **$16.53M** |

> We are **Scale AI meets Respond.io**, built for the $2.3T informal economy traditional SaaS ignores.

---

## Repository Structure

```
ace/
├── ace-whatsapp/          # Phase 1 — WhatsApp-native product
│   ├── apps/              # Merchant app (RN), Customer PWA, Admin portal
│   ├── core/              # The Autonomous State Engine (10 Rust microservices)
│   ├── ai/                # Python AI/ML services (intent, data refinement)
│   ├── infra/             # Docker, CI/CD, environments
│   └── docs/              # API specs, flows, ADRs
│
├── ace-platform/          # Phase 2 — Dedicated commerce platform
│   ├── apps/              # Enhanced RN app, web app, admin portal
│   ├── core/              # Enhanced state engine (multi-channel)
│   ├── ai/                # Enhanced AI layer
│   ├── services/          # analytics/, enterprise-intelligence/
│   ├── infra/
│   └── docs/
│
├── data-intelligence/     # Enterprise data products (secondary business)
│   ├── ai-training-marketplace/
│   ├── fmcg-intelligence/
│   └── trust-score-api/
│
├── shared/                # Shared across phases
│   ├── proto/             # gRPC protobuf definitions
│   ├── event-schemas/     # Kafka event schemas
│   ├── ai-models/         # Shared trained models
│   └── common/            # Shared types, utilities
│
├── infra/                 # Global infrastructure definitions
│   ├── postgres/          # Primary transactional DB
│   ├── qdrant/            # Vector DB (conversation embeddings)
│   ├── redis/             # Real-time state cache
│   ├── kafka/             # Event queue / immutable event log
│   └── clickhouse/        # Data warehouse (enterprise analytics)
│
└── docs/
    ├── business/          # Vision, market, enterprise products
    ├── engineering/       # Guidelines, security, architecture overview
    └── product/           # Roadmap, personas, workflows
```

---

## Market Sizing

| | Size |
|--|------|
| TAM (sub-Saharan Africa, SE Asia, LatAm) | $2.3T annually |
| SAM (WhatsApp-dominant markets: NG, KE, ID, BR, MX) | $840B |
| SOM Year 1 (Nigerian fashion, food dist., personal care) | $12B |

---

## Key Documents

- [Vision & Pitch](./docs/business/VISION.md)
- [Phase 1 Architecture](./ace-whatsapp/ARCHITECTURE.md)
- [Phase 2 Architecture](./ace-platform/ARCHITECTURE.md)
- [Engineering Guidelines](./docs/engineering/GUIDELINES.md)
- [Autonomous Workflows](./docs/product/WORKFLOWS.md)
- [Enterprise Products](./docs/business/ENTERPRISE_PRODUCTS.md)
- [Data Intelligence Strategy](./data-intelligence/README.md)
