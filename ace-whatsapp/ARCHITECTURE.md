# ACE WhatsApp — Architecture

> Phase 1 Technical Architecture Document  
> Status: **Draft / Placeholder**  
> Last Updated: 2026-05-30  
> Timeline: May 18, 2026 → October 31, 2026

---

## Overview

ACE WhatsApp is a **three-layer autonomous commerce engine** layered invisibly on top of WhatsApp Business. The system processes inbound merchant conversations, extracts commerce intent via a multi-model AI pipeline, and autonomously executes backend operations — all without merchant input. The merchant's only interaction is exception management.

---

## Architecture Principles

1. **Autonomous over assistive** — The AI executes, it does not suggest. Every output results in an action, not a recommendation.
2. **Event-driven, not request-response** — Continuous event stream → AI interprets intent → State machine validates → Autonomous execution.
3. **Exception-first UX** — The merchant's dashboard should be empty most of the time.
4. **Africa-first infrastructure** — Designed for Nigerian 3G/4G reality. Low latency, high fault tolerance.
5. **Message compression by default** — Every design decision minimises Meta API message costs.
6. **Structural lock-in, not convenience lock-in** — Moats must be economically irrational to bypass.
7. **LLM sandboxing** — The LLM never has direct write access to financial or pricing data.

---

## System Architecture Diagram

```
╔══════════════════════════════════════════════════════════════════════╗
║                      LAYER 1: INTERFACE LAYER                       ║
║                                                                      ║
║  Merchant WhatsApp ─────────────────┐                                ║
║  Customer WhatsApp ─────────────────┤                                ║
║  Supplier WhatsApp / SMS ───────────┘                                ║
║                                                                      ║
║  Merchant: React Native App (Expo)                                   ║
║  Customer: WhatsApp → PWA (in-app browser) → eventual native         ║
╚══════════════════════════╦═══════════════════════════════════════════╝
                           ║ Webhooks (WhatsApp Business Cloud API)
                           ▼
╔══════════════════════════════════════════════════════════════════════╗
║                  LAYER 2: AUTONOMOUS STATE ENGINE                   ║
║                   (11 Microservices: Rust + AI SDK)                  ║
║                                                                      ║
║  ┌──────────────────────────────────────────────────────────────┐   ║
║  │  1. INGESTION SERVICE (Rust + Actix-web)                     │   ║
║  │  Webhook ingestion · rate limiting · deduplication           │   ║
║  │  Media download · voice → STT · image OCR                    │   ║
║  └────────────────────────────┬─────────────────────────────────┘   ║
║                               │ Publishes to Kafka                  ║
║  ┌────────────────────────────▼─────────────────────────────────┐   ║
║  │  2. IDENTITY RESOLUTION SERVICE (Rust)                       │   ║
║  │  Phone + username + email → Global Buyer ID                  │   ║
║  │  Fuzzy name matching · cross-platform coherence              │   ║
║  └────────────────────────────┬─────────────────────────────────┘   ║
║                               │                                     ║
║             ┌─────────────────┴───────────────────┐                ║
║             ▼                                     ▼                 ║
║  ┌──────────────────────┐       ┌─────────────────────────────┐    ║
║  │ 3. INTENT PARSER     │       │  4. STATE MACHINE           │    ║
║  │  TypeScript/Vercel   │──────▶│     ORCHESTRATOR (Rust)     │    ║
║  │  AI SDK + FastAPI    │       │                             │    ║
║  │                      │       │  Deterministic state chart  │    ║
║  │  Whisper → BERT      │       │  30-45s debounce window     │    ║
║  │  generateObject()    │       │  AI suggests → Rust approves│    ║
║  │  → typed Intent JSON │       │  Hard rule enforcement      │    ║
║  └──────────────────────┘       └──────────────┬──────────────┘    ║
║                                                │ Domain Events      ║
║         ┌────────────────────────┬─────────────┼──────────┐        ║
║         ▼                        ▼             ▼          ▼        ║
║  ┌─────────────┐  ┌────────────────┐  ┌──────────────┐  ┌──────┐  ║
║  │ 5. PAYMENT  │  │ 6. LOGISTICS   │  │ 7. SUPPLIER  │  │  8.  │  ║
║  │ VERIFICATION│  │ COORDINATION   │  │ INTEGRATION  │  │COMMS │  ║
║  │  (Rust)     │  │  (Rust)        │  │  (Rust)      │  │ROUTER│  ║
║  │             │  │                │  │              │  │(Rust)│  ║
║  │ Virtual     │  │ Kwik/Gokada/   │  │ Auto-ping    │  │ SMS  │  ║
║  │ accounts    │  │ MAX dispatch   │  │ supplier WA  │  │ Voice│  ║
║  │ Bank APIs   │  │ Rider tracking │  │ Pre-negotiate│  │Vendor│  ║
║  │ Escrow      │  │ Customer notif │  │ Draft PO     │  │Comms │  ║
║  └─────────────┘  └────────────────┘  └──────────────┘  └──────┘  ║
║                                                                      ║
║  ┌──────────────────────────────────────────────────────────────┐   ║
║  │  11. AI NEGOTIATOR (Rust circuit breaker + Vercel AI SDK)    │   ║
║  │  Full negotiation arc · 6 merchant-approved tactics          │   ║
║  │  NegotiationTrace logging → goods & price intel              │   ║
║  │  Below-floor → Vendor Communique SMS to merchant             │   ║
║  └──────────────────────────────────────────────────────────────┘   ║
║                                                                      ║
║  ┌──────────────────────────────────────┐                           ║
║  │  9. VISUAL CONTEXT RESOLUTION        │                           ║
║  │     (Rust + Python)                  │                           ║
║  │  Social media scraping daemon        │                           ║
║  │  CLIP/ViT embeddings → SKU match     │                           ║
║  │  Resolves "that dress in your reel"  │                           ║
║  └──────────────────────────────────────┘                           ║
║                                                                      ║
║  ┌──────────────────────────────────────────────────────────────┐   ║
║  │  10. DATA REFINEMENT PIPELINE (Python + Airflow)             │   ║
║  │  PII scrubber · anonymization · synthetic data generation    │   ║
║  │  HITL verification queue · enterprise dataset packaging      │   ║
║  └──────────────────────────────────────────────────────────────┘   ║
╚══════════════════════════╦═══════════════════════════════════════════╝
                           ║ Refined data
                           ▼
╔══════════════════════════════════════════════════════════════════════╗
║             LAYER 3: ENTERPRISE INTELLIGENCE PLATFORM               ║
║                                                                      ║
║  AI Training Data Marketplace · FMCG Intelligence · TrustScore API  ║
║  (see /data-intelligence/)                                           ║
╚══════════════════════════════════════════════════════════════════════╝
```

---

## The 11 Microservices — Detailed

### 1. Ingestion Service `core/ingestion-service/` — Rust + Actix-web
The entry point for all WhatsApp traffic. Owns the connection to the WhatsApp Business Cloud API.

**Key responsibilities:**
- Webhook endpoint + Meta HMAC signature verification
- Rate limiting, deduplication, and message ordering guarantees
- Media download and processing: voice notes → Whisper queue; images → OCR queue
- Publishes normalised `MessageReceived` events to Kafka
- Outbound message delivery (with message batching — see Message Consolidation Engine below)

**Critical design: Message Consolidation Engine**
- 15-second batching window per customer conversation
- Compresses multiple intents into single structured message
- Target: **2.3 messages per completed order** (industry avg: 5–7)
- Service Window Optimizer tracks 24hr free reply window per conversation

---

### 2. Identity Resolution Service `core/identity-resolution/` — Rust
Maintains the **Global Buyer ID** — the cross-platform, cross-merchant customer identity graph.

**Key responsibilities:**
- Clusters phone numbers, usernames, email addresses into single `global_buyer_id`
- Fuzzy name matching ("David", "Dave", "Davido" + same phone → same ID)
- Cross-merchant profile portability (enables 1-tap checkout)
- Enables "customer told Merchant A she prefers Saturday deliveries" to be known by Merchant B

---

### 3. Intent Parser Service `ai/intent-parser/` — TypeScript (Vercel AI SDK) + Python FastAPI
The agent layer of ACE. Uses the **Vercel AI SDK** for orchestration, tool-calling into Rust services, and structured output. Python FastAPI handles heavy inference (Whisper, BERT). See [full README](./ai/intent-parser/README.md) for the complete agent architecture.

**Multi-model pipeline:**
1. **Local Whisper** — Voice note → text transcription (dialect-aware)
2. **Regional Dialect BERT** — Slang normalization (Pidgin, Yoruba, Hausa, Igbo)
3. **GPT-4o** — Intent extraction → structured JSON intent object

**Output format:**
```json
{
  "intent": "purchase",
  "entities": {
    "product_reference": "black gown from yesterday's reel",
    "quantity": 2,
    "reference_type": "social_media_post"
  },
  "dialect": "nigerian_pidgin",
  "confidence": 0.94,
  "requires_visual_resolution": true
}
```

---

### 4. State Machine Orchestrator `core/state-machine/` — Rust
The deterministic control plane. **The AI suggests; this service approves or rejects.**

**Key responsibilities:**
- Deterministic state chart engine (validates all state transitions against business rules)
- 30–45 second debounce window for message clustering (same customer, same intent = one order)
- Hard rule enforcement — LLM cannot override merchant-configured boundaries
- Routes to merchant exception queue when AI confidence < threshold
- Order lifecycle: `Awaiting Intent → Intent Confirmed → Awaiting Payment → Payment Verified → Out for Delivery → Delivered`

---

### 5. Payment Verification Service `core/payment-verification/` — Rust
Autonomous payment reconciliation without merchant checking their bank app.

**Key responsibilities:**
- Spins up dynamic virtual account numbers per transaction (Providus/Wema/Sterling via partner FinTechs)
- Real-time webhook listener for bank payment confirmations
- Vision AI fallback for legacy screenshot scenarios (only when bank API unavailable; confidence threshold: <95% → manual review)
- Micro-escrow: holds funds 24hrs post-delivery, auto-releases or merchant-mediated dispute resolution
- Reconciles Paystack / Flutterwave card payments

---

### 6. Logistics Coordination Service `core/logistics-coordination/` — Rust
Autonomous rider dispatch triggered on `PaymentVerified` state transition.

**Key responsibilities:**
- Logistics aggregator: negotiates enterprise-tier rates across Kwik, Gokada, MAX based on platform volume
- Aggregate pricing tiers: 0–999/mo = ₦600/delivery | 1K–4.9K = ₦450 | 5K–19.9K = ₦350 | 20K+ = ₦280
- Autonomous booking: selects best carrier based on location, load, cost rules
- Real-time rider tracking + customer ETA notifications
- Lock-in mechanism: merchants accessing platform rates save ₦250/order vs going direct

---

### 7. Supplier Integration Service `core/supplier-integration/` — Rust
Detects demand spikes, autonomously pings suppliers, pre-negotiates pricing, and drafts POs for one-tap merchant approval.

**Key responsibilities:**
- Integrates with Inventory Oracle (6-hour background scan of sales velocity)
- Predicts stockout time based on 7-day moving averages
- WhatsApp template message pipeline to verified suppliers
- Margin analysis: validates negotiated price against merchant's acceptable margin range
- Drafts PO → merchant receives: "Tap to approve ₦42K payment. 44% margin. One tap needed."

---

### 8. Out-of-Band Communication Router `core/comms-router/` — Rust
Two roles: (1) customer-facing fallback when WhatsApp is unavailable; (2) **Vendor Communiqué engine** — the SMS reply-code system that keeps merchants in control of exceptions without needing the app open.

**Customer priority routing:**
| Order Value | Channel | Rationale |
|-------------|---------|-----------|
| > ₦50K | AI voice call | High-value = premium UX |
| ₦20K–₦50K | Premium SMS | Important but not critical |
| ₦5K–₦20K | Standard SMS | Cost-effective fallback |
| < ₦5K | Wait for reconnection | Economics don't justify cost |

**Vendor Communiqué (merchant-facing):**
- SMS reply-code: `ACE: Amaka wants dress at ₦12K (floor: ₦14,250). Reply 1-approve, 2-hold, 3-bundle`
- Merchant replies with a single digit from any phone — no app needed
- Digest builder compiles morning briefings (WhatsApp or SMS)
- Quiet hours respected; emergency override for fraud/dispute events
- See [VENDOR_COMMUNIQUE.md](../docs/product/VENDOR_COMMUNIQUE.md) for full design

---

### 9. Visual Context Resolution Service `core/visual-context/` — Rust + Python
Resolves deictic references like "that blue dress in your last reel" to specific SKUs.

**Key responsibilities:**
- Continuous social media scraping daemon (merchant's Instagram, Facebook)
- CLIP/ViT-based vector embeddings per post/frame
- Semantic query: `"blue dress in last reel"` → vector search → SKU match
- Returns product image, SKU, and current stock to Intent Parser

---

### 10. Data Refinement Pipeline `ai/data-refinement/` — Python + Airflow
Transforms raw transactional data into the enterprise intelligence product.

**Key responsibilities:**
- PII scrubber: NER model for phone/name/address redaction + tokenization
- HITL verification workforce queue (university students / micro-taskers correct transcriptions)
- Synthetic data generation for enterprise clients
- Federated learning coordinator for AI lab partnerships (model weights only, not raw data)
- Packages verified datasets for the enterprise data marketplace

---

### 11. AI Negotiator `core/ai-negotiator/` — Rust (rules) + TypeScript/Vercel AI SDK (agent)
The autonomous price negotiation and deal-closing agent. Behaves like a skilled market trader operating within merchant-defined boundaries.

**Key responsibilities:**
- Full negotiation arc management (Anchor → Acknowledge → Counter → Close/Pivot/Escalate)
- 6 configurable tactics: Relationship Anchor, Bundle Pivot, Scarcity Signal, Future Credit, Urgency Window, Soft Close
- Rust circuit breaker: **AI physically cannot close a deal below the merchant's floor price**
- On below-floor: attempts Bundle Pivot → Future Credit → triggers Vendor Communiqué (SMS to merchant)
- `NegotiationTrace` logging: every negotiation arc becomes goods-level price elasticity data for FMCG enterprise product
- Customer tier-based authority: New (5% max) → Returning (15%) → Loyal (22%) → VIP (30%)
- Injection detection: adversarial inputs flagged, logged, escalated

See [full README](./core/ai-negotiator/README.md) for the complete negotiation architecture.

---

## Database Architecture

### PostgreSQL — Primary Transactional DB
- ACID compliance for financial ledger integrity
- Partitioned by `merchant_id` for horizontal scalability
- Key tables: `merchants`, `customers` (`global_buyer_id` as PK), `orders`, `products`, `transactions`, `payment_verifications`, `escrow_accounts`

### Qdrant — Vector Database (Rust-native)
- Conversation embeddings for semantic context retrieval
- Powers long-term memory: "This customer mentioned Saturday deliveries 6 months ago"
- Visual product embeddings (Instagram/social content → SKU resolution)

### Redis — Real-Time State Cache
- Active conversation states (debounce window state per customer)
- Service Window tracking (24hr free WhatsApp window per conversation)
- Rate limiting counters
- Distributed locks preventing race conditions

### Apache Kafka — Event Queue
- Immutable, append-only event log
- Enables event replay for debugging and auditing
- Decouples services for independent scaling
- All inter-service communication is event-driven (no direct API calls for domain events)

### ClickHouse — Data Warehouse
- Columnar storage for fast analytical queries
- Powers real-time FMCG demand dashboards (Layer 3)
- Aggregate merchant performance metrics
- Enterprise buyer data feeds

---

## The Hardened Pricing Architecture

The LLM **never** has direct write access to the pricing database or autonomous override authority.

```
Customer requests price
        │
        ▼
PricingService (Rust) — reads merchant-configured rules
        │
        ▼
AuthorizedPriceRange {
    floor: base_price * (1.0 - tier_discount),  // Cannot go below this
    ceiling: base_price,
    recommended: base_price * 0.95,
}
        │
        ▼
LLM receives ONLY the authorized range
        │
        ├── Customer requests within range → LLM autonomously agrees
        ├── Customer requests below floor → Circuit breaker triggers
        │   └── AI pivots to bundle offer OR escalates to merchant
        └── Customer requests above ceiling → Accept immediately
```

**Customer tiers:**
- New: max 5% discount
- Returning: max 15% discount
- VIP (high LTV): max 30% discount

---

## Autonomous Workflow Data Flows

See [`docs/flows/`](./docs/flows/) for detailed diagrams. Summary:

1. **Lead-to-Close** — Full 10-stage pipeline: lead arrival → qualification → presentation → negotiation → payment → dispatch → delivery → retention. See [LEAD_TO_CLOSE.md](../docs/product/LEAD_TO_CLOSE.md)
2. **Order Flow** — Customer WhatsApp → Ingestion → Identity → Intent → AI Negotiator → State Machine → Payment → Logistics → Confirmation
3. **Restock Flow** — Inventory Oracle alert → Supplier Integration → supplier WhatsApp → margin check → PO draft → Vendor Communiqué (SMS) → merchant 1-tap → payment
4. **Retention Flow** — Nightly analyzer → at-risk customer detection → culturally-nuanced message draft → Vendor Communiqué (4hr hold) → auto-send
5. **Visual Resolution Flow** — Deictic reference → Visual Context Service → CLIP embeddings → SKU → AI Negotiator

---

## Open Architecture Questions

- [ ] WhatsApp Business API: direct Meta vs BSP (Twilio, Vonage, Infobip)?
- [ ] LLM provider: GPT-4o (hosted) vs self-hosted open model for cost at scale?
- [ ] Federated learning infrastructure: GPU rental vs owned hardware?
- [ ] Multi-tenancy: shared DB with `merchant_id` partitioning vs per-merchant schemas?
- [ ] Nigeria-first hosting region: AWS af-south-1 (Cape Town) vs GCP Lagos (coming soon)?

---

## Related Docs

- [API Contracts → docs/api/](./docs/api/)
- [Data Flow Diagrams → docs/flows/](./docs/flows/)
- [Architecture Decision Records → docs/decisions/](./docs/decisions/)
- [Autonomous Workflows → /docs/product/WORKFLOWS.md](../docs/product/WORKFLOWS.md)
- [Lead-to-Close Pipeline → /docs/product/LEAD_TO_CLOSE.md](../docs/product/LEAD_TO_CLOSE.md)
- [Vendor Communiqué System → /docs/product/VENDOR_COMMUNIQUE.md](../docs/product/VENDOR_COMMUNIQUE.md)
- [AI Negotiator → core/ai-negotiator/README.md](./core/ai-negotiator/README.md)
- [Vercel AI SDK Config → /shared/ai-sdk/README.md](../shared/ai-sdk/README.md)
- [Data Collection Architecture → /docs/engineering/DATA_COLLECTION.md](../docs/engineering/DATA_COLLECTION.md)
