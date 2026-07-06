# ACE WhatsApp — Phase 1

> **The WhatsApp-native Autonomous Commerce Engine**  
> Timeline: May 18, 2026 → October 31, 2026 (Demo-Ready in 5.5 months)

Phase 1 of ACE. Merchants do nothing new — they keep texting on WhatsApp. ACE operates entirely in the background as a fully autonomous commerce OS.

---

## Core Premise

- Merchants already live on WhatsApp, Instagram, Facebook Messenger, and Email. We don't change that.
- Customers experience zero friction — they never download anything (Phase 1).
- ACE intercepts, interprets, and **executes** commerce operations autonomously.
- **Omni-Channel Shared Inbox**: The entire team manages all customer interactions from one unified interface.
- **Contact Merge**: If the same customer messages you on WhatsApp in the morning and emails you in the afternoon, the platform recognizes it's the same person and merges their profiles into a single thread to avoid duplicate tickets.
- The merchant's only job: **exception management**.

---

## What ACE WhatsApp Automates (The Four Autonomous Workflows)

| Workflow | What Happens |
|----------|-------------|
| **Order Fulfillment** | Customer texts → AI parses intent → payment virtual account issued → logistics booked → merchant notified. Zero merchant input. |
| **Demand-Driven Restocking** | Stock oracle detects impending stockout → pings supplier → negotiates price → drafts PO → merchant approves with one tap (8 seconds). |
| **Customer Retention & Shared Inbox** | Contact Merge unifies Instagram/WhatsApp/Email identities. Nightly analysis detects at-risk VIPs → AI auto-sends a culturally nuanced re-engagement message to their preferred channel. |
| **Multimodal Visual Resolution** | "That blue dress in your last reel" → AI scrapes merchant's IG → CLIP embeddings match product → SKU resolved → price negotiated autonomously. |

---

## Application Structure

```
ace-whatsapp/
│
├── apps/
│   ├── merchant-app/          # React Native (Expo) — exception dashboard
│   ├── customer-pwa/          # Progressive Web App — embedded in WhatsApp browser
│   └── admin-portal/          # Internal ACE ops dashboard
│
├── core/                      # THE AUTONOMOUS STATE ENGINE (Rust microservices)
│   ├── ingestion-service/     # Webhook ingestion (Rust + Actix-web)
│   ├── identity-resolution/   # Global Buyer ID engine (Rust)
│   ├── state-machine/         # Deterministic state orchestrator (Rust)
│   ├── payment-verification/  # Banking API + virtual accounts (Rust)
│   ├── logistics-coordination/# Rider dispatch + tracking (Rust)
│   ├── supplier-integration/  # Autonomous reorder comms (Rust)
│   ├── visual-context/        # IG/social multimodal RAG (Rust + Python)
│   └── comms-router/          # Out-of-band SMS/voice fallback (Rust)
│
├── ai/                        # PYTHON AI/ML SERVICES
│   ├── intent-parser/         # NLP pipeline: Whisper → BERT → GPT-4o (Python + FastAPI)
│   └── data-refinement/       # Anonymization + enterprise data pipeline (Python + Airflow)
│
├── infra/
│   ├── docker/
│   ├── ci-cd/
│   └── environments/          # dev / staging / prod
│
└── docs/
    ├── api/                   # Service contracts + OpenAPI specs
    ├── flows/                 # Data flow diagrams (4 core workflows)
    └── decisions/             # Architecture Decision Records (ADRs)
```

---

## Technology Stack

### The Autonomous State Engine — Rust
| Framework | Purpose |
|-----------|---------|
| `actix-web` | HTTP/webhook ingestion (proven at Discord scale) |
| `tokio` | Async runtime for massive concurrent I/O |
| `sqlx` | Compile-time verified database queries |
| `tonic` | Internal gRPC microservice communication |

### The AI/ML Layer — Python
| Tool | Purpose |
|------|---------|
| `FastAPI` | Intent parser service API |
| `Whisper` (local) | Voice note speech-to-text transcription |
| Regional dialect BERT | Slang normalization (Pidgin, Yoruba, Hausa, Igbo) |
| `GPT-4o` | Intent extraction → structured JSON output |
| `Airflow` | Data refinement pipeline orchestration |
| `CLIP / ViT` | Visual product embeddings (Instagram resolution) |

### The Interface Layer
| App | Stack |
|-----|-------|
| Merchant app | React Native + Expo (iOS + Android, OTA updates) |
| Customer interface | Progressive Web App (opens in WhatsApp in-app browser) |

### Databases
| Database | Role |
|----------|------|
| **PostgreSQL** | Primary transactional DB — ACID for financial ledger, partitioned by `merchant_id` |
| **Qdrant** (Rust-native) | Vector DB — conversation embeddings, 6-month context recall |
| **Redis** | Real-time state cache, rate limiting, distributed locks |
| **Apache Kafka** | Immutable event log, service decoupling, event replay |
| **ClickHouse** | Data warehouse — enterprise analytics, FMCG demand dashboards |

---

## The Customer: Progressive Decoupling Strategy

| Phase | Timeline | Experience |
|-------|----------|------------|
| **WhatsApp Funnel** | Months 1–6 | Pure WhatsApp. Zero download friction. |
| **PWA Trojan Horse** | Months 3–12 | AI drops PWA link for complex interactions. Opens in WA browser. Transaction now on ACE servers. |
| **Global Buyer ID** | Months 6–18 | After first PWA checkout → phone number → cross-merchant 1-tap checkout. |
| **Native App Graduation** | Months 12+ | After 3+ purchases, PWA prompts home screen install. |

---

## Critical Design Constraints

### 1. WhatsApp API Cost — Message Compression
> Risk: At 5 messages/order × 80 orders/month × $0.01 = $4/merchant in Meta costs vs $14 subscription  
> Fix: Message Consolidation Engine (Rust). Target: **2.3 messages/completed order**. 78% of conversations in free 24hr service window.

### 2. Disintermediation — Structural Lock-in
> Risk: Merchant and customer exchange phone numbers, bypass ACE after first transaction.  
> Fix: Four structural bottlenecks — (1) Aggregate logistics pricing (₦600 → ₦350/delivery), (2) Micro-escrow trust signal, (3) Exclusive supplier network discounts, (4) Global Buyer ID 1-tap checkout network. **Cost of leaving ACE: ₦110K/month. Cost of staying: ₦12K/month.**

### 3. Pricing — Prompt Injection & Haggling
> Risk: LLM with direct DB write access gets jailbroken. Customer learns AI's pricing floor.  
> Fix: LLM cannot touch pricing DB directly. Hardened `PricingService` (Rust) enforces merchant-set floors per customer tier. Circuit breaker triggers on floor breach → escalates to merchant.

---

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the full technical design.
