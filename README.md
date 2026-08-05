# ACE — Autonomous Commerce Engine

> ### **"Your business runs itself while you sleep."**
> **ACE Technologies Limited** · Nigerian C-Corp · Delaware flip option post-Series A

---

## The 30-Second Pitch

ACE is an invisible operating system for informal commerce. We turn WhatsApp chaos into autonomous businesses through radical AI automation. Merchants keep texting customers on WhatsApp — our AI handles inventory, payments, negotiations, logistics, and customer retention **completely in the background**.

**No new apps for customers. No manual work for merchants. Just autonomous growth.**

---

## The Problem

In Nigeria and across emerging markets, **$2.3 trillion** in commerce happens entirely on WhatsApp. ~480,000 merchants in Lagos alone manage 30–150 customer conversations daily through unstructured text, voice notes in Pidgin, and screenshots of bank transfers. These merchants are growing **40% YoY** but hit a hard ceiling at $50K annual revenue — they can't scale past their personal bandwidth.

| Current "Solution" | Why It Fails |
|-------------------|-------------|
| WhatsApp Business App | Zero state management, no payment integration, no inventory tracking |
| Respond.io / Zoko / Hilos | Routes chats to human agents — still requires merchants to check bank apps, call riders, update inventory manually |
| Shopify / WooCommerce | Requires customers to leave WhatsApp → **78% conversion drop** in emerging markets |
| Traditional ERP (Zoho, Odoo) | Desktop-oriented, requires structured data input — alien to merchants who think in conversations |

**The core insight:** The merchant's current system isn't broken — it's optimised for n=1. WhatsApp works perfectly for one customer. It catastrophically fails at 50 concurrent conversations. The merchant doesn't need a better inbox. They need an autonomous operating system that executes business logic while they sleep.

---

## The Paradigm Shift

| ❌ What We're NOT Building | ✅ What We ARE Building |
|---------------------------|------------------------|
| An AI chatbot that drafts responses for merchants to review | An autonomous OS that **executes** |
| A fancy CRM with "AI-powered insights" | An event-driven engine with no manual steps |
| Another unified inbox with message routing | Invisible back-office infrastructure |
| A tool requiring customers to change behaviour | Invisible layer on existing WhatsApp behaviour |

**The AI doesn't ask permission. It executes complex multi-step business logic and reports outcomes. The merchant's job shifts from operational execution to strategic exception management.**

---

## System Workings & Architecture

### 1. End-to-End Negotiation Flow Across the ACE Architecture

```mermaid
sequenceDiagram
    autonumber
    actor Customer as Customer (WhatsApp)
    participant Comms as Comms Router (Debounce)
    participant Agent as AI Negotiator (Groq Llama 3.3)
    participant Arc as Negotiation Arc (Strategy State)
    participant Pricing as Pricing Service & DB
    participant StateMachine as Order State Machine
    participant Payment as Payment Gateway / VAN

    Customer->>Comms: "How much for the black sneakers size 43? Can you do 12k?"
    Note over Comms: Debounce Window (4.5s burst pool)
    Comms->>Agent: Dispatches turn payload with customer profile

    Agent->>Arc: Load / Hydrate Strategic Arc State
    Agent->>Pricing: check_inventory(SKU) & computeAuthorizedRange()
    Pricing-->>Agent: Base: ₦18,000 | Floor: ₦14,500 | Tier: Loyal (Max 22% off)
    Agent->>Arc: projectRangeOntoArc(anchor: 18000, floor: 14500)

    Note over Agent: Groq LLM evaluates available tactics & limits
    Agent->>Arc: availableTactics(arc, stock)
    Arc-->>Agent: [relationship_anchor, scarcity_signal, soft_close]

    rect rgb(240, 248, 255)
        Note over Agent: LLM Tool Selection & Execution
        Agent->>Arc: advanceArc(AGENT_COUNTERED, offer: 15000, tactic: relationship_anchor)
        Arc-->>Agent: Updated Arc: Stage = COUNTER (Attempt 1/3)
    end

    Agent-->>Customer: "Ah my loyal customer! Regular price is ₦18k, but for you I fit drop am to ₦15k last."

    Customer->>Agent: "Oya ₦15k is fine, I take am"

    rect rgb(240, 255, 240)
        Note over Agent: Deal Closure & Order Machine Transition
        Agent->>Arc: advanceArc(DEAL_ACCEPTED, finalPrice: 15000)
        Agent->>StateMachine: transition(QUOTE_CREATED, { price: 15000, sku: "SNK-BLK-43" })
        StateMachine->>Payment: Generate Virtual Account Number (VAN)
        Payment-->>Customer: WhatsApp Checkout Card: Transfer ₦15,000 to Monnify VAN: 9023481234
    end
```

---

### 2. End-to-End Multimodal Pipeline & Execution Flow

```mermaid
flowchart TD
    subgraph Inbound["1. Inbound Ingestion (Baileys / Meta)"]
        A1[Customer WhatsApp] -->|Text / Voice / Image| A2[Baileys Gateway / Ingestion Service]
        A2 -->|HMAC Verification & Deduplication| A3{Message Type}
        A3 -->|Voice Note / Audio| B1[Groq Whisper Turbo\nFast Speech-to-Text]
        A3 -->|Product Image / Photo| B2[Groq Vision Llama 3.2\nImage Extraction]
        A3 -->|Text / Quote Reply| B3[Normalized MessageContent]
        B1 --> B3
        B2 --> B3
    end

    subgraph Buffering["2. Sliding Debounce & Batching"]
        B3 --> C1[BullMQ Redis Queue]
        C1 -->|10s Burst Window Consolidation| C2[Atomic ConversationTurn]
    end

    subgraph Agent["3. AI Negotiator & Strategic Arc"]
        C2 --> D1[Load Merchant Voice & Dialect\nPidgin / Yoruba / Hausa / Igbo / English]
        D1 --> D2[Extract Customer Counter-Offer\nRegex 15k, ₦12,000, do 14000]
        D2 --> D3[advanceArc: CUSTOMER_COUNTERED]
        D3 --> D4[Groq Llama 3.3 Multi-Tool Loop]
        D4 --> D5{Tool Execution}
        D5 -->|check_inventory| E1[Postgres SKU & Price Range Check]
        D5 -->|propose_price| E2[Deterministic Floor Gate]
        D5 -->|deploy_tactic| E3[Relationship / Bundle / Scarcity / Credit]
        D5 -->|escalate_to_merchant| E4[Vendor Communiqué SMS / WhatsApp 1/2/3]
        D5 -->|close_deal| E5[OrderStateMachine: QUOTE_CREATED]
    end

    subgraph Payment["4. Payment & Delivery Resolution"]
        E5 --> F1[Issue Virtual Account Number / Monnify Link]
        F1 --> F2[Payment Webhook Receiver :3002]
        F2 -->|HMAC Verified| F3{Payment Amount Check}
        F3 -->|Exact / Overpay| G1[PAYMENT_CONFIRMED -> payment_verified]
        F3 -->|Underpay| G2[awaiting_payment preserved -> Balance Prompt]
    end
```

---

### 3. Multi-Service Event Topology

```mermaid
flowchart TB
    subgraph Inbound Channels
        WA_Cloud["WhatsApp Cloud API (Meta Webhook)"]
        WA_Baileys["WhatsApp Web (Baileys Business Line)"]
        PSP_Hook["PSP Webhook (Paystack / Monnify)"]
    end

    subgraph Core Engine
        Ingest["ingestion-service (:3001)"]
        Baileys["baileys-gateway (:3005)"]
        Comms["comms-router (BullMQ + Redis)"]
        Agent["ai-negotiator (Groq SDK)"]
        Arc["NegotiationArc (Reducer)"]
        StateMachine["orderStateMachine (Invariants)"]
        PayVerif["payment-verification (:3002)"]
        CatSync["catalog-sync (:3003)"]
        MerchantAPI["merchant-api (:3004)"]
    end

    subgraph Data & Storage
        PG[("PostgreSQL\n(Orders, Products, Merchants)")]
        RedisDB[("Redis\n(Debounce, Sessions, Locks)")]
    end

    WA_Cloud -->|HMAC Verified POST| Ingest
    WA_Baileys -->|Socket Message| Baileys
    Ingest -->|Push Raw Turn| Comms
    Baileys -->|Voice/Text/Media| Comms
    Comms -->|Debounced Turn| Agent

    Agent <-->|Strategic Working Memory| Arc
    Agent <-->|Rules & Stock| PG
    Agent -->|On Deal Close| StateMachine
    StateMachine -->|State Updates| PG

    PSP_Hook -->|Credit Webhook| PayVerif
    PayVerif -->|PAYMENT_CONFIRMED| StateMachine
    PayVerif -->|Double-entry Ledger| PG

    MerchantAPI <--> PG
    CatSync <-->|Sync Catalog| PG
    Comms <--> RedisDB
```

---

### 4. Circuit Breaker & Vendor Escalation Flow

```mermaid
sequenceDiagram
    autonumber
    actor Customer as Customer (WhatsApp)
    participant Agent as AI Negotiator
    participant Arc as Negotiation Arc
    participant Comms as Vendor Communiqué
    actor Merchant as Merchant (SMS / WhatsApp)

    Customer->>Agent: "Do ₦10k for the dress (Floor is ₦14,250)"
    Agent->>Arc: Check tactical attempts (Bundle + Credit)
    Arc-->>Agent: Both tactics exhausted, price < floor
    Agent->>Comms: Trigger below-floor escalation
    Comms->>Merchant: SMS: "Customer Amaka offers ₦10k (floor: ₦14.25k). Reply: 1-Approve, 2-Counter ₦12k, 3-Reject"
    Agent-->>Customer: "Hold on small make I check with my oga..."

    alt Merchant Replies "1"
        Merchant->>Comms: "1"
        Comms->>Arc: overrideFloorApproved(₦10,000)
        Comms->>Customer: "Oga don agree! Deal confirmed at ₦10,000. Generating payment details..."
    else Merchant Replies "2"
        Merchant->>Comms: "2"
        Comms->>Arc: setCounterTarget(₦12,000)
        Comms->>Customer: "Oga say lowest we fit do na ₦12,000 last last. How you see am?"
    else Timeout / Reject
        Comms->>Customer: "I beg we no fit reach that amount, ₦14,250 na our final price."
    end
```

---

### 5. Deterministic Order State Machine Lifecycle

```mermaid
stateDiagram-v2
    [*] --> no_order
    no_order --> draft: ORDER_CREATED (Item selected)
    draft --> draft: QUOTE_CREATED (Re-quote / price update)
    draft --> awaiting_payment: INVOICE_GENERATED (VAN Issued)
    
    awaiting_payment --> payment_verified: PAYMENT_CONFIRMED (Exact / Overpayment)
    awaiting_payment --> cancelled: ORDER_CANCELLED (Timeout / Explicit)
    
    payment_verified --> processing: FULFILLMENT_STARTED
    processing --> out_for_delivery: DISPATCHED (Rider assigned)
    out_for_delivery --> delivered: DELIVERY_CONFIRMED
    
    draft --> cancelled: ORDER_CANCELLED
    delivered --> [*]
    cancelled --> [*]
```

---

### 6. Vendor WhatsApp Inventory Ingestion & Auto-Status Posting

```mermaid
sequenceDiagram
    autonumber
    actor Vendor as Merchant / Vendor (WhatsApp)
    participant Gateway as Baileys Gateway (:3005)
    participant Parser as Multimodal Parser (Groq Vision / Whisper)
    participant Catalog as PostgreSQL Catalog
    participant Cron as Auto-Status Scheduler

    Vendor->>Gateway: Sends product photos with Pidgin voice note:<br/>"I get 10 pieces of this original sneaker, selling for 18k"
    Gateway->>Parser: Media + Audio Extraction
    Parser->>Parser: Whisper STT + Llama 3.2 Vision classification
    Parser->>Catalog: Upserts SKU, Stock (10), Price (₦18,000), Generated Tags & Description
    Catalog-->>Gateway: Ingestion Confirmed
    Gateway-->>Vendor: WhatsApp Reply: "✅ Added 'Classic Black Sneaker' (₦18,000, 10 in stock) to your catalog!"

    Note over Cron: Scheduled Status Trigger
    Cron->>Catalog: Fetch low-velocity / high-margin products
    Cron->>Gateway: Post WhatsApp Status Story with catalog caption & automated direct buy trigger
```

---

## Architectural Walkthrough by Feature

### 1. Regional Dialect & Cultural Persona (`Pidgin`, `English`, `Yoruba`, `Hausa`, `Igbo`)
- **Dialect Guidance**: [`dialectGuidance()`](file:///c:/Users/USER/Documents/Biblio/ace-whatsapp/core/ai-negotiator/src/agentLoop.ts#L329) injects culture-specific prompt framing based on the merchant's configuration:
  - **Pidgin**: Warm Nigerian Pidgin (*"abeg"*, *"o"*, *"sharp sharp"*, *"no wahala"*).
  - **Yoruba**: Yoruba-inflected English (*"ẹ kú iṣẹ́"*, *"ó dára"*).
  - **Igbo**: Igbo-inflected English (*"daalụ"*, *"ọ dị mma"*).
  - **Hausa**: Hausa-inflected English (*"sannu"*, *"madalla"*).
  - **English**: Clear, polite Nigerian English.
- **Trace Persistence**: The dialect is stamped onto both the in-memory [`NegotiationArc`](file:///c:/Users/USER/Documents/Biblio/ace-whatsapp/core/ai-negotiator/src/negotiationArc.ts) and the historical `negotiation_traces` database table.

### 2. Voice Notes (`.ogg` / `.opus` WhatsApp Audio)
- **Transcription**: In [`mediaProcessor.ts`](file:///c:/Users/USER/Documents/Biblio/ace-whatsapp/core/baileys-gateway/src/mediaProcessor.ts#L123), inbound audio streams are converted to in-memory files and transcribed with **Groq Whisper (`whisper-large-v3-turbo`)**.
- **Context Injection**: Transcriptions are passed to the agent as `[Voice note]: <transcript>`, instructing the model to respond naturally to the customer's speech without robotic meta-commentary.
- **Price Extraction**: Spoken price counter-offers (e.g. *"I get 12k for you"*) are parsed by [`extractCustomerPriceOffer`](file:///c:/Users/USER/Documents/Biblio/ace-whatsapp/core/ai-negotiator/src/agentLoop.ts#L252), triggering `advanceArc(CUSTOMER_COUNTERED)` automatically.

### 3. Image Processing & Auto-Status Posting
- **Vendor Inventory Push**: Vendor product photos sent to their line are parsed via **Groq Vision (`llama-3.2-11b-vision-preview`)** in [`inventoryParser.ts`](file:///c:/Users/USER/Documents/Biblio/ace-whatsapp/core/baileys-gateway/src/inventoryParser.ts), cataloged into PostgreSQL, and optionally broadcast to WhatsApp Status via [`postProductToStatus()`](file:///c:/Users/USER/Documents/Biblio/ace-whatsapp/core/baileys-gateway/src/statusPoster.ts#L30).
- **Customer Photo Queries**: Customer images sent during negotiation are base64-encoded and passed directly to the vision model to identify matching stock.

### 4. Payment Structures & Underpayment Protection
- **Virtual Account Numbers (VAN)**: [`issuePaymentLink`](file:///c:/Users/USER/Documents/Biblio/ace-whatsapp/core/ai-negotiator/src/tools.ts#L508) generates dynamic transfer cards with merchant bank details.
- **Webhook Reconciliation**: [`payment-verification/src/index.ts`](file:///c:/Users/USER/Documents/Biblio/ace-whatsapp/core/payment-verification/src/index.ts) listens on `:3002`, validates HMAC headers (`x-paystack-signature`, `x-ace-signature`), and checks amounts:
  - **Full Payment**: Transitions state to `payment_verified`, unlocks fulfillment, and sends receipt.
  - **Underpayment**: Locks state in `awaiting_payment`, prompts for the remaining deficit, and emits telemetry to `DataIntelligenceEngine`.

### 5. Burst Debouncing (ManyChat-Style Smoothness)
- [`debounce.ts`](file:///c:/Users/USER/Documents/Biblio/ace-whatsapp/core/comms-router/src/debounce.ts) consolidates rapid customer messages sent within 10 seconds into a single, cohesive `ConversationTurn`, preventing the AI from interrupting or double-responding.

---

## The Three-Layer Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│  LAYER 3: ENTERPRISE INTELLIGENCE PLATFORM (B2B)                 │
│  AI Training Data · FMCG Market Pulse · ACE TrustScore API       │
│  The "Scale AI of Informal Commerce" — $16.5M ARR by Year 2      │
└───────────────────────────────┬──────────────────────────────────┘
                                │ (Refined data → enterprise buyers)
┌───────────────────────────────▼──────────────────────────────────┐
│  LAYER 2: AUTONOMOUS STATE ENGINE (Core IP)                       │
│  11 microservices: Rust core + Vercel AI SDK agent layer          │
│  Ingestion → Identity → AI Negotiator → State Machine →           │
│  Payment → Logistics → Supplier → Visual Context → Comms Router   │
│  Every interaction: data collected, refined, monetised            │
└───────────────────────────────┬──────────────────────────────────┘
                                │ (Raw commerce events)
┌───────────────────────────────▼──────────────────────────────────┐
│  LAYER 1: INTERFACE LAYER                                         │
│  Merchant: React Native app (exception dashboard)                 │
│  Customer: WhatsApp → PWA Trojan Horse → Global Buyer ID          │
│  Vendor Communiqué: SMS reply-code for merchant decisions         │
└──────────────────────────────────────────────────────────────────┘
```

---

## The Four Autonomous Workflows

ACE automates the **entire commercial lifecycle** — from first customer message to post-sale retention. The merchant interacts only with exceptions.

| Workflow | What ACE Does | Merchant Input |
|----------|--------------|---------------|
| **Order Fulfillment** | Customer texts → AI parses intent (Groq Llama 3.3) → AI Negotiator closes deal → virtual account issued → payment verified → rider dispatched → merchant notified | **Zero** |
| **Demand-Driven Restocking** | Inventory Oracle detects stockout (16hr lead) → pings supplier WhatsApp → negotiates price → margin analysis → drafts PO | **1 tap (8 seconds)** |
| **Customer Retention Engine** | Nightly analyser detects at-risk VIP → generates culturally-nuanced message → sends after 4hr hold if no merchant action | **Optional review** |
| **Multimodal Visual Resolution** | "That blue dress in your last reel" → CLIP / Llama 3.2 Vision embeddings → SKU resolved → price negotiated autonomously | **Zero** |

---

## The AI Negotiator — ACE's Most Differentiated Feature

ACE doesn't apply discounts. It **negotiates** — like a skilled market trader who knows the customer's full history, operates in their dialect, and closes deals autonomously within merchant-defined boundaries.

**The negotiation arc:** Anchor → Acknowledge → Counter → Close / Pivot / Escalate

**6 autonomous tactics:** Relationship Anchor · Bundle Pivot · Inventory-Verified Scarcity · Future Credit · Urgency Window · Sentiment-Aware Soft Close

**The anti-haggling concession guard:** Physical limit of max 3 agent offers per conversation thread before pricing locks permanently.

**The Rust / State Machine circuit breaker:** The AI is **physically prevented** from closing below the merchant's floor price. On below-floor requests: Bundle Pivot → Future Credit → Vendor Communiqué SMS to merchant.

**Every negotiation is a data asset:** `NegotiationTrace` logs price elasticity per SKU, per geography, per customer tier → sold to FMCG brands as market intelligence.

---

## The Vendor Communiqué System

ACE keeps merchants in control without requiring them to be at a dashboard.

```
Exception detected → Channel selected by urgency:
  > ₦50K order dispute  → AI voice call
  Pricing exception     → SMS: "Amaka wants dress at ₦12K (floor: ₦14,250). Reply 1-approve, 2-hold, 3-bundle"
  Restock approval      → SMS: "Red Ankara running out. Alhaji: ₦42K for 50yds (44% margin). Reply 1 to approve."
  Routine orders        → WhatsApp morning digest
  Stats                 → App push (weekly)
```

Merchants respond with a single digit from **any phone**. No app needed. Works on feature phones.

---

## Instant 1-Step Auto-Provisioning & Admin Portal

### 1. Zero-Config WhatsApp Line Onboarding
Any new Nigerian WhatsApp phone number can be provisioned in one seamless command or single button click in the Admin Portal without manual database seeding:
- **CLI**:
  ```bash
  npm run pair 2348012345678
  ```
- **Admin Portal UI**:
  ```bash
  npm run admin-portal
  ```
  Navigate to **WhatsApp Auto-Pairing** (`/vendor-status`), enter the phone number, and click **Auto-Provision & Pair**.
  - Automatically provisions PostgreSQL `merchants` and `vendors` records.
  - Seeds standard Nigerian pricing rules (floor margin, counter-offer step limits).
  - Configures cultural dialect voice (Pidgin, Yoruba, Igbo, Hausa, English).
  - Immediately requests and displays the **8-digit WhatsApp pairing code**.

### 2. Stateful "Note-to-Self" WhatsApp Business Mode
Merchants can operate and test their storefront directly on the same phone via WhatsApp's *"Message yourself"* chat:
- Send **`business`** to enter active business management mode.
- All product images, voice notes, pricing descriptions, and catalog queries sent in this state are parsed by the AI Vision & Whisper models and added to the store catalog.
- Send **`end-business`** to gracefully close the business management session.

---

## Technology Stack

| Layer | Stack |
|-------|-------|
| **Agent / AI orchestration** | TypeScript + **Groq SDK** (`llama-3.3-70b-versatile` & `llama-3.2-11b-vision-preview`) |
| **Core microservices** | Fastify, TypeScript, BullMQ, Redis, PostgreSQL |
| **WhatsApp Gateways** | Meta WhatsApp Cloud API (`ingestion-service`) & Baileys Multi-Device Web Sockets (`baileys-gateway`) |
| **Merchant app** | React Native + Expo |
| **Customer interface** | WhatsApp Direct UI & Progressive Web App |
| **Primary DB** | PostgreSQL (ACID, partitioned by `merchant_id`) |
| **State cache & Queue** | Redis + BullMQ (4.5s debounce window, rate-limiting, locks) |
| **Payments** | Monnify / Paystack / Flutterwave Dynamic Virtual Account Numbers (VAN) |

---

## Key Documents

### Product & Architecture
- [Phase 1 Architecture](./ace-whatsapp/ARCHITECTURE.md) — Multi-service system architecture
- [Autonomous Workflows](./docs/product/WORKFLOWS.md) — 4 core workflows with step-by-step flows
- [Lead-to-Close Pipeline](./docs/product/LEAD_TO_CLOSE.md) — 10-stage full automation pipeline
- [Vendor Communiqué System](./docs/product/VENDOR_COMMUNIQUE.md) — SMS decision protocol
- [AI Negotiator](./ace-whatsapp/core/ai-negotiator/README.md) — Negotiation arc, 6 tactics, circuit breaker

### Engineering & Infrastructure
- [Database Architecture](./infra/README.md) — PostgreSQL schema, indexing, and design rationale
- [Engineering Guidelines](./docs/engineering/GUIDELINES.md) — 8 principles, critical vulnerability mitigations
- [Data Collection Architecture](./docs/engineering/DATA_COLLECTION.md) — 5 data types, Kafka topology