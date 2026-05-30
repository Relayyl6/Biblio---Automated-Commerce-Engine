# Engineering Guidelines

> ACE — Cross-cutting engineering principles  
> Applies to both `ace-whatsapp/` (Phase 1) and `ace-platform/` (Phase 2)

---

## Core Principles

### 1. Autonomous over Assistive
We build systems that **act**, not systems that suggest. Every AI output results in an action, not a recommendation waiting for human approval — unless confidence falls below threshold or the action exceeds merchant-configured autonomy boundaries.

### 2. Africa-First Infrastructure
Latency, connectivity, and cost decisions are made for **Nigerian 3G/4G reality**, not London fibre. Design for degraded connectivity, high SMS costs, and local payment rails from day one. Every performance budget assumes slower networks and higher packet loss than Western defaults.

### 3. Exception-First UX
The merchant's interface should be **empty most of the time**. ACE handles 94%+ of interactions autonomously. Surfacing the right exception at the right moment is the primary UX challenge. Don't build dashboards — build exception queues.

### 4. LLM Sandboxing is Non-Negotiable
**The LLM never has direct write access to any financial or pricing database.** Every LLM output passes through the Rust State Machine Orchestrator before any state change occurs. The AI proposes; Rust approves. This prevents prompt injection, jailbreaks, and pricing manipulation.

### 5. Message Compression by Default
Every feature decision must account for WhatsApp API costs. Default assumption: fewer messages is always better. Use the Message Consolidation Engine. Maximise service window usage. Template messages first, conversational messages as fallback.

### 6. Structural Lock-in, Not Convenience Lock-in
Every product feature should make it **economically irrational** to leave ACE. The four moats (logistics pricing, micro-escrow, supplier network, Global Buyer ID) must be built as structural capabilities — not UX conveniences that can be replicated peer-to-peer.

### 7. Data as a First-Class Product
Every transaction processed creates value for the intelligence product. Schema decisions, event logging, and data quality are **product requirements**, not afterthoughts. Every Kafka event is a potential enterprise data asset.

### 8. Multi-Language is Non-Negotiable
English is not the primary language of our merchants. **Pidgin, Yoruba, Hausa, and Igbo** support must be built in from day one — not retrofitted. The dialect BERT stage of the AI pipeline is as important as GPT-4o.

---

## Technology Stack Standards

### Backend — Rust (Core Services)
- **Framework:** `actix-web` for HTTP/webhooks, `tokio` for async runtime
- **Database queries:** `sqlx` (compile-time verified — no runtime SQL errors)
- **Inter-service (synchronous):** `tonic` (gRPC)
- **Inter-service (async/domain events):** Apache Kafka events via `rdkafka`
- All proto definitions in `shared/proto/`; all event schemas in `shared/event-schemas/`

### AI/ML Services — Python
- **Framework:** `FastAPI` for service APIs
- **Audio:** local `Whisper` (not hosted — data sovereignty)
- **NLP:** dialect BERT → GPT-4o pipeline (never LLM alone)
- **Orchestration:** Apache `Airflow` for data pipelines
- **Visual:** `CLIP` / `ViT` for product embeddings

### Frontend — React Native
- **Framework:** React Native + `Expo`
- OTA updates via Expo (no app store review for hotfixes)
- Offline-capable for core exception management views
- Customer PWA: plain HTML/CSS/JS or lightweight framework — must load < 3s on 3G

---

## Architecture Standards

- [ ] **Event-driven architecture**: all domain events via Kafka; no direct DB access across service boundaries
- [ ] **Service contracts**: OpenAPI specs and proto definitions written before implementation begins
- [ ] **Architecture Decision Records**: all significant decisions documented in `docs/decisions/` (per phase)
- [ ] **No shared databases**: each service owns its data; cross-service reads go via API or events
- [ ] **Idempotent event handlers**: all Kafka consumers must handle duplicate events gracefully

---

## Security Standards

- [ ] All PII encrypted at rest (AES-256) and in transit (TLS 1.3)
- [ ] NDPR (Nigeria Data Protection Regulation) compliance — mandatory
- [ ] No raw customer phone numbers stored outside Identity Resolution Service
- [ ] Secrets management: environment variables only; never hardcoded; Vault/AWS Secrets Manager in prod
- [ ] LLM prompt injection monitoring: all LLM inputs/outputs logged and auditable
- [ ] Webhook signature verification on all inbound webhooks (Meta, banking APIs, logistics APIs)

---

## Development Standards (To Be Defined)

- [ ] Branching strategy (TBD — trunk-based vs GitFlow)
- [ ] Test coverage requirements per service
- [ ] Code review policy (min reviewers, approval requirements)
- [ ] CI/CD requirements and gates
- [ ] Local development setup (Docker Compose)

---

## Critical Vulnerability Mitigations

These are not optional — they are core architectural requirements:

| Vulnerability | Mitigation | Owner |
|--------------|-----------|-------|
| WhatsApp API margin death spiral | Message Consolidation Engine (target: 2.3 msg/order) | `core/ingestion-service` |
| Disintermediation bypass | Four structural moats (logistics, escrow, suppliers, Global Buyer ID) | All core services |
| LLM prompt injection / pricing exploit | Hardened PricingService in Rust; LLM never touches pricing DB | `core/state-machine` |
| Haggling pricing floor discovery | Per-customer-tier authorized price ranges; ranges not disclosed to LLM | `core/state-machine` |
| Payment race conditions | Redis distributed locks; idempotent payment handlers | `core/payment-verification` |
| Duplicate order creation | 30–45s debounce window in State Machine | `core/state-machine` |
