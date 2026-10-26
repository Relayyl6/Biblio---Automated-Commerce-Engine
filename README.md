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
    participant Comms as Comms Router (5s Debounce)
    participant Agent as AI Negotiator (Groq Llama 3.3)
    participant Arc as Negotiation Arc (Redis/PG)
    participant Pricing as Pricing Service & Postgres
    participant StateMachine as Order State Machine (Pure Reducer)
    participant Outbound as Outbound Dispatcher

    Customer->>Comms: "How much for the black sneakers size 43? Can you do 12k?"
    Note over Comms: Sliding Debounce Window (5s per customer buffer)
    Comms->>Agent: Dispatches ConversationTurn (messages + orderState)

    Agent->>Arc: loadOrCreateArc(customerId, merchantId)
    Note over Agent: Model Tool Iteration Loop (Max 8 iterations)
    Agent->>Pricing: tool: check_inventory("black sneakers") & get_customer_profile()
    Pricing-->>Agent: SKU: SNK-BLK-43 | Stock: 10 | Base: ₦18k | Floor: ₦14.5k | Tier: loyal
    Agent->>Arc: projectRangeOntoArc(anchor: 18000, floor: 14500)

    Agent->>Arc: availableTactics(arc, stock)
    Arc-->>Agent: [relationship_anchor, bundle_pivot, scarcity_signal]

    rect rgb(240, 248, 255)
        Note over Agent: AI Strategic Action & Arc Advance
        Agent->>Arc: tool: deploy_tactic(relationship_anchor) + propose_price(15000)
        Arc-->>Agent: advanceArc(AGENT_COUNTERED, offer: 15000) (Attempt 1/3)
    end

    Agent->>Outbound: Split into natural chat bubbles (Typing indicator -> Chunks)
    Outbound-->>Customer: "Ah my loyal customer! Regular price is ₦18k, but for you I fit drop am to ₦15k last."

    Customer->>Comms: "Oya ₦15k is fine, I take am"
    Comms->>Agent: Dispatches customer acceptance turn

    rect rgb(240, 255, 240)
        Note over Agent: Deal Closure & Two-Stage Order Transition
        Agent->>Arc: advanceArc(DEAL_ACCEPTED, finalPrice: 15000)
        Agent->>StateMachine: tool: close_deal(15000) -> transition(QUOTE_CREATED) -> draft
        Agent->>StateMachine: tool: issue_payment_link() -> transition(PAYMENT_LINK_ISSUED) -> awaiting_payment
        Note over StateMachine: Mint dynamic VAN via Paystack DVA / Bank Transfer (Providus/Wema)
        Agent->>Outbound: Send WhatsApp checkout card
        Outbound-->>Customer: "Transfer ₦15,000 to Account: 9023481234 (Wema/Providus). Expires in 15 mins."
    end
```

---

### 2. End-to-End Multimodal Pipeline & Execution Flow

```mermaid
flowchart TD
    subgraph Inbound["1. Inbound Channels & Normalization"]
        direction TB
        C_WA[Customer WhatsApp] -->|Text / Audio / Photo| GW{Gateway Layer}
        GW -->|Baileys WebSockets :3005| BG[baileys-gateway]
        GW -->|Meta Graph Webhook :3001| IS[ingestion-service]
        
        BG -->|Voice Note / Audio| W1[Groq Whisper Turbo\nFast Audio STT in mediaProcessor]
        BG -->|Photo / Image| P1[Resolve Media Buffer\nBase64 Encoding]
        IS -->|Meta Cloud Webhook| P2[HMAC SHA-256 Verify\nRedis Idempotency Dedup]
        
        W1 --> NORM[Normalized InboundMessage]
        P1 --> NORM
        P2 --> NORM
    end

    subgraph Buffering["2. Sliding Debounce & Conversation Turn"]
        NORM --> DB1[comms-router: debounce.ts]
        DB1 -->|5s Sliding Window Timer| REDIS[(Redis Scratch Buffer)]
        REDIS -->|Window Closes| TURN[Atomic ConversationTurn\nMessages + Existing OrderState]
    end

    subgraph Agent["3. AI Negotiator Loop (agentLoop.ts)"]
        TURN --> AG1[Hydrate NegotiationArc & Dialect Tone]
        AG1 --> AG2[Extract Spoken/Typed Counter-Offer\nRegex 15k, ₦12k]
        AG2 --> AG3[RAG Exemplar Store\nDynamic Dialect Few-Shot Injection]
        AG3 --> AG4[Groq Llama 3.3 Multi-Tool Loop]
        
        AG4 --> TL{Tool Execution}
        TL -->|check_inventory| T1[Postgres Catalog + CLIP Embeddings]
        TL -->|propose_price| T2[Circuit Breaker Hard Floor Gate]
        TL -->|deploy_tactic| T3[Tactics Guard: Scarcity / Bundle / Credit]
        TL -->|escalate_to_merchant| T4[Vendor Communiqué SMS / Baileys Direct]
        TL -->|close_deal| T5[orderStateMachine: QUOTE_CREATED -> draft]
        TL -->|issue_payment_link| T6[orderStateMachine: PAYMENT_LINK_ISSUED -> awaiting_payment]
    end

    subgraph Payment["4. Payment Verification (:3002)"]
        T6 --> PY1[Customer Bank Transfer]
        PY1 --> PY2[Payment Webhook :3002\nPaystack / Monnify HMAC Verify]
        PY2 --> PY3{Amount Reconciliation}
        PY3 -->|Exact / Overpayment| PY4[orderStateMachine: PAYMENT_CONFIRMED\nState -> payment_verified]
        PY3 -->|Underpayment| PY5[State locked in awaiting_payment\nPrompt customer for remaining balance]
        PY4 --> PY6[Double-Entry Ledger Row in transactions Table]
    end
```

---

### 3. Multi-Service Event Topology

```mermaid
flowchart TB
    subgraph Inbound Channels
        WA_Cloud["WhatsApp Cloud API\n(Meta Webhook :3001)"]
        WA_Baileys["WhatsApp Multi-Device Web\n(Baileys Socket :3005)"]
        PSP_Hook["PSP Webhook\n(Paystack / Monnify :3002)"]
        Vendor_App["Merchant Expo Mobile App\n(REST API :3004)"]
    end

    subgraph Core Services
        Ingest["ingestion-service (:3001)\nMeta Webhook Receiver"]
        Baileys["baileys-gateway (:3005)\nBaileys Sockets & Status Poster"]
        Comms["comms-router (BullMQ)\nSliding Debounce & Outbound"]
        Agent["ai-negotiator (Groq SDK)\nAutonomous Multi-Tool Agent Loop"]
        PayVerif["payment-verification (:3002)\nReconciliation & Ledger"]
        CatSync["catalog-sync (:3003)\nMeta Commerce Catalog Pull"]
        MerchantAPI["merchant-api (:3004)\nMerchant Control Plane & App Backend"]
    end

    subgraph InProcess Engines ["In-Process Deterministic Engines"]
        Arc["NegotiationArc\nPure Strategy Reducer"]
        StateMachine["orderStateMachine\nPure Invariant Reducer"]
        BanditEngine["PricingBandit & ExemplarStore\nLinUCB RL & RAG Memory"]
    end

    subgraph Persistence Layer
        PG[("Neon PostgreSQL\n(merchants, products, orders,\ntransactions, conversation_outcomes)")]
        RedisDB[("Redis Cache & BullMQ\n(Debounce scratch, Locks,\nSessions, Idempotency)")]
    end

    WA_Cloud -->|HMAC POST| Ingest
    WA_Baileys -->|WebSocket Events| Baileys
    Ingest -->|Enqueue Message| Comms
    Baileys -->|Inbound Customer Turns| Comms
    Vendor_App <-->|REST API + JWT| MerchantAPI

    Comms -->|Debounced Turn| Agent
    Agent <--> Arc
    Agent <--> BanditEngine
    Agent --> StateMachine
    Agent <--> PG
    Comms <--> RedisDB

    PSP_Hook -->|HMAC POST| PayVerif
    PayVerif --> StateMachine
    PayVerif --> PG

    MerchantAPI <--> PG
    CatSync <-->|Sync Catalog| PG
    Baileys <--> RedisDB
```

---

### 4. Circuit Breaker & Vendor Escalation Flow

```mermaid
sequenceDiagram
    autonumber
    actor Customer as Customer (WhatsApp)
    participant Agent as AI Negotiator (agentLoop.ts)
    participant Arc as Negotiation Arc
    participant Comms as Vendor Communiqué Engine
    actor Merchant as Merchant Phone (SMS / WhatsApp)
    participant Router as Comms Router (debounce.ts)

    Customer->>Agent: "Do ₦10k for the dress (Floor is ₦14,250)"
    Agent->>Arc: Check tactical attempts (Bundle + Credit)
    Arc-->>Agent: Both tactics attempted & exhausted, price < floor
    Agent->>Comms: escalate_to_merchant(customerOffer: 10000, reason)
    
    rect rgb(255, 245, 230)
        Note over Comms: Dispatch SMS (Africa's Talking) / Baileys
        Comms->>Merchant: "ACE ESCALATION ⚠️ Customer Amaka wants Dress at ₦10,000 (floor: ₦14,250).\nReply: 1-Approve exception, 2-Hold firm at floor, 3-Offer bundle pivot"
        Comms-->>Arc: advanceArc(ESCALATED_TO_MERCHANT)
        Agent-->>Customer: "Hold on small, let me check with my oga..."
    end

    alt Merchant Replies "1" (Approve exception)
        Merchant->>Comms: "1"
        Comms->>Comms: Log choice to vendor_decisions table & clear Redis session
        Comms->>Router: enqueueInboundMessage("[SYSTEM: Merchant approved exception at ₦10,000]")
        Router->>Agent: Resume Agent Loop with approved override
        Agent->>StateMachine: close_deal(10000) -> issue_payment_link()
        Agent-->>Customer: "Oga don agree! Deal confirmed at ₦10,000. Generating payment details..."
    else Merchant Replies "2" (Hold firm)
        Merchant->>Comms: "2"
        Comms->>Router: enqueueInboundMessage("[SYSTEM: Merchant rejected exception. Hold firm at floor ₦14,250]")
        Router->>Agent: Resume Agent Loop
        Agent-->>Customer: "Oga say lowest we fit do na ₦14,250 last last. How you see am?"
    else Merchant Replies "3" (Offer bundle pivot)
        Merchant->>Comms: "3"
        Comms->>Router: enqueueInboundMessage("[SYSTEM: Merchant requested bundle pivot]")
        Router->>Agent: Resume Agent Loop
        Agent-->>Customer: "If you add matching scarf with am, I fit give you both for ₦16,000!"
    end
```

---

### 5. Deterministic Order State Machine Lifecycle

```mermaid
stateDiagram-v2
    [*] --> no_order
    
    no_order --> draft: QUOTE_CREATED (Item selected & quote generated)
    draft --> draft: QUOTE_CREATED (Price updated / re-quoted)
    draft --> awaiting_payment: PAYMENT_LINK_ISSUED (Virtual Account assigned)
    draft --> cancelled: ORDER_CANCELLED (Explicit cancellation)
    
    awaiting_payment --> payment_verified: PAYMENT_CONFIRMED (Amount >= total)
    awaiting_payment --> cancelled: PAYMENT_TIMEOUT (15-min window expired)
    awaiting_payment --> cancelled: ORDER_CANCELLED (Customer cancelled)
    
    payment_verified --> out_for_delivery: RIDER_ASSIGNED (Dispatch tracking URL linked)
    payment_verified --> cancelled: ORDER_CANCELLED (Merchant refund/cancel)
    
    out_for_delivery --> delivered: DELIVERY_CONFIRMED (Delivery verified)
    out_for_delivery --> cancelled: ORDER_CANCELLED (Delivery aborted)
    
    delivered --> [*]
    cancelled --> [*]

    note right of draft
        Pure reducer in orderStateMachine.ts
        Compiler-enforced exhaustiveness (assertNever)
    end note
```

---

### 6. Vendor WhatsApp Inventory Ingestion & Auto-Status Posting

```mermaid
sequenceDiagram
    autonumber
    actor Vendor as Merchant / Vendor (WhatsApp)
    participant Gateway as Baileys Gateway (:3005)
    participant Parser as Multimodal Parser (inventoryParser.ts)
    participant Storage as Cloudinary CDN
    participant Catalog as PostgreSQL Catalog (products)
    participant Cron as Auto-Status Scheduler (statusPoster.ts)

    Note over Vendor,Gateway: [Phase 1 Pipeline - Live in core/baileys-gateway]
    Vendor->>Gateway: Sends product photo with voice note / caption:<br/>"I get 10 pieces of this original sneaker, selling for 18k"
    Gateway->>Gateway: 10s sliding debounce (vendorBuffers)
    Gateway->>Parser: Media + Audio Extraction (Hooked in messageClassifier)
    Parser->>Parser: Groq Whisper Turbo STT + Groq Vision (Llama 3.2 11B)
    Parser->>Storage: uploadImage() (Streams to Cloudinary CDN -> secure_url)
    Parser->>Parser: Generate 512-dim CLIP embedding (embeddings.ts)
    Parser->>Catalog: Upsert SKU, Stock (10), Price (₦18k), Tags & Embedding
    Catalog-->>Gateway: Upsert Confirmed
    Gateway-->>Vendor: WhatsApp Confirmation: "✅ Added 'Classic Black Sneaker' (₦18,000) to catalog!"

    Note over Cron: 30-Minute Status Cron (statusPoster.ts)
    rect rgb(245, 255, 245)
        Note over Cron,Catalog: Algorithmic Promotion & Direct-Buy Execution
        Cron->>Catalog: SELECT product via Sales Velocity & Gross Margin CTE (ORDER BY promotion_score DESC)
        Note over Catalog: Prioritizes low-velocity, high-margin inventory for status promotion
        Cron->>Gateway: Post to status@broadcast with pre-filled wa.me deep-link
        Note over Gateway: Direct-Buy WhatsApp link: https://wa.me/{phone}?text=Buy%20SKU...
    end
```

---

## Architectural Walkthrough by Feature

### 1. Regional Dialect & Cultural Persona (`Pidgin`, `English`, `Yoruba`, `Hausa`, `Igbo`)
- **Dialect Guidance**: [`dialectGuidance()`](file:///c:/Users/USER/Documents/Biblio/ace-whatsapp/core/ai-negotiator/src/agentLoop.ts#L329) injects culture-specific prompt framing based on the merchant's configuration:
  - **Pidgin**: Street-smart Nigerian English with subtle Pidgin flair (*"no wahala"*, *"I don hear"* — strict anti-pattern guards avoid clichés like *"sharp sharp"* or forced slang).
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

### 6. RL + RAG Pipeline — Adaptive Negotiation & Context Engine
- **Core Principle: Learning Proposes; Circuit Breakers Enforce**:
  The AI's learning components only recommend strategic actions (discount tiers, few-shot framing); deterministic state machines and pre-computed floor circuits enforce invariant boundaries. The bandit can never violate the merchant's configured minimum margin.

```mermaid
flowchart TD
    subgraph Inbound["Inbound Customer Message"]
        M1[Customer Message] --> M2[Comms Router: 5s Sliding Debounce]
    end

    subgraph Active_RAG["RAG Exemplar Memory (ACTIVE IN RUNTIME)"]
        M2 --> R1[Exemplar Store: exemplarStore.ts]
        R1 -->|Query by Dialect, Tier & Scenario| R2[(interaction_exemplars Table)]
        R2 -->|Dynamic Nigerian Dialogue Few-Shots| A1[System Prompt Injection in agentLoop.ts]
    end

    subgraph RL_Bandit["LinUCB Contextual Bandit (ACTIVE IN RUNTIME)"]
        M2 -->|Context Extraction| B1[Feature Extractor: 6D Context Vector\nLTV, recency, margin, value, dialect, hour]
        B1 --> B2[LinUCB Pricing Bandit: pricingBandit.ts]
        B2 -->|Select Arm with Matrix Inversion| B3[7 Discrete Arms: 0% to 30%]
        B3 -->|Proposed Arm Signal| A1
    end

    subgraph Safety_Execution["Execution & Circuit Breakers (ACTIVE IN RUNTIME)"]
        A1 --> EX1[Groq Llama 3.3 Versatile LLM]
        EX1 --> CB{Circuit Breaker Gate: pricingService.ts}
        CB -->|Valid Margin (>= Floor)| OUT1[propose_price Tool: Send Counter-Offer]
        CB -->|Breaches Floor| OUT2[Circuit Breaker Trip: Force Bundle / Credit / Escalate]
    end

    subgraph Feedback_Loop["Telemetry & Outcome Feedback (ACTIVE RUNTIME FEEDBACK)"]
        OUT1 --> FB1[interactionFeedback.recordInteraction]
        FB1 --> FB2[(conversation_outcomes Table with bandit_arm)]
        ORD[Payment Confirmed / Deal Closed] -->|Backdated Outcome| FB3[Margin-Based Reward: recordOrderOutcome]
        FB3 -->|Reward Update & Weight Inversion| B2
    end
```

- **Data Foundation (`conversation_outcomes` & `interaction_exemplars`)**:
  - `conversation_outcomes` in Neon PostgreSQL stores full `(context, action, outcome)` tuples including LinUCB state representations, customer reactions, turn counts, and final realized margin.
  - `interaction_exemplars` maintains authenticated conversational patterns across Nigerian Pidgin, Yoruba, Igbo, Hausa, and English.
- **RAG Exemplar Store ([`shared/src/rag/exemplarStore.ts`](file:///c:/Users/USER/Documents/Biblio/shared/src/rag/exemplarStore.ts))**:
  - Dynamically extracts few-shot exemplars matching the customer's dialect, tier (`new`, `regular`, `vip`), and scenario (`first_order`, `hesitation`, `low_stock`, `high_value`).
  - Pre-formats authentic Nigerian commerce dialogue into the system prompt of [`agentLoop.ts`](file:///c:/Users/USER/Documents/Biblio/ace-whatsapp/core/ai-negotiator/src/agentLoop.ts).
- **LinUCB Contextual Bandit ([`shared/src/rl/pricingBandit.ts`](file:///c:/Users/USER/Documents/Biblio/shared/src/rl/pricingBandit.ts))**:
  - **Feature Representation (6D)**: $[1.0, \text{price\_ratio}, \text{clv\_scaled}, \text{is\_vip}, \text{turns\_scaled}, \text{sentiment}]$.
  - **Discrete Action Arms**: $7$ discount options: $[0\%, 5\%, 10\%, 15\%, 20\%, 25\%, 30\%]$.
  - **Upper Confidence Bound**: Action selection via $UCB_a = \hat{\theta}_a^T x + \alpha \sqrt{x^T A_a^{-1} x}$.
  - **Circuit-Breaker Masking**: Clamps proposed discount to prevent any violation of the merchant's configured absolute floor price.
  - **Dual Persistence**: Matrix states persisted in Redis with zero-downtime in-memory caching.
  - **Interaction Feedback Loop ([`shared/src/feedback/interactionFeedback.ts`](file:///c:/Users/USER/Documents/Biblio/shared/src/feedback/interactionFeedback.ts))**:
  - Tracks live turns and merchant manual overrides from the Exception Queue.
  - Backdates order outcomes when a transaction clears, calculating realized margin and updating the LinUCB model:
    $$r = \mathbf{1}_{\{\text{order\_completed}\}} \cdot \text{margin\_realized} - \lambda \cdot \mathbf{1}_{\{\text{merchant\_override}\}}$$

### 7. Graceful Offline Fallback & Edge Resilience Architecture

ACE and Biblio are engineered specifically for emerging market connectivity (cellular volatility, power cuts, WhatsApp session drops). A multi-tier offline-first pipeline protects commerce transactions across every layer:

```mermaid
flowchart TD
    subgraph MobileApp ["📱 Merchant Mobile App (Expo / React Native)"]
        UI[Merchant Screens: Inbox, Catalog, Settings]
        RQ["React Query (networkMode: 'offlineFirst')"]
        Persist["AsyncStorage Cache (24h gcTime)"]
        NetBanner["Offline Banner (Pill Indicator)"]
        NativeLink["wa.me Deep-Link Native WhatsApp"]
    end

    subgraph Backend ["⚡ Biblio Backend & Gateway"]
        BullMQ["BullMQ + Redis Persistent Queues"]
        Debounce["Inbound Debounce Buffer"]
        Poster["Status Poster Engine"]
        Communique["Vendor Communiqué Engine"]
    end

    subgraph Fallbacks ["🛡️ Fallback Channels"]
        SMS["Africa's Talking / Termii SMS"]
        NativeWA["Merchant's Native WhatsApp App"]
        InternalLogistics["Internal Manual Dispatch"]
    end

    UI --> RQ
    RQ <--> Persist
    RQ -.->|No Internet| NetBanner
    UI -->|Baileys Socket Offline| NativeLink --> NativeWA

    Poster -->|Socket Connected| Baileys[Baileys Outbound Socket]
    Poster -->|Socket Offline| NativeLink

    Communique -->|Primary| Baileys
    Communique -->|Socket Offline / 5m Timeout| SMS

    Debounce --> BullMQ
    BullMQ -.->|Retry Exponential Backoff| DB[(Neon Postgres)]
```

- **Client Persistence**: React Query with `networkMode: 'offlineFirst'` and a 24-hour `AsyncStorage` persistence layer renders cached inventory, drafts, and analytics instantaneously when offline.
- **Deep-Link Failover**: If the Baileys gateway socket is disconnected during a status broadcast, the engine returns a pre-filled `wa.me` deep-link opening the native WhatsApp app directly on the merchant's physical phone.
- **Vendor Communiqué SMS Dual-Track**: Escalations attempt WhatsApp delivery via business line socket first; on socket failure, the engine immediately dispatches via Africa's Talking / Termii SMS with an automated 5-minute delayed BullMQ safety reminder.

---

## Production Execution & Architecture Verification Matrix

The table below details all 9 architectural pipelines and confirms their live implementation, active hooks, and production readiness across the physical codebase on disk.

| # | Flow / Claim | Codebase Location | Current Reality on Disk | Status | Production Implementation Details |
|---|--------------|-------------------|-------------------------|:------:|-----------------------------------|
| **1** | **Vendor WhatsApp Intake Dispatching** | [`messageClassifier.ts`](file:///c:/Users/USER/Documents/Biblio/ace-whatsapp/core/baileys-gateway/src/messageClassifier.ts#L7)<br/>[`inventoryParser.ts`](file:///c:/Users/USER/Documents/Biblio/ace-whatsapp/core/baileys-gateway/src/inventoryParser.ts#L134) | Pipeline logic is fully written and **live-hooked** in `messageClassifier.ts`. Inbound media, voice notes, and Note-to-Self messages from vendor business/personal lines automatically route into `parseVendorSubmission` for Whisper transcription, Groq Vision parsing, CLIP embeddings, and database upserts. | ✅ **LIVE & HOOKED** | Extend vendor command vocabulary (e.g. multi-variant stock updates) as needed. |
| **2** | **Persistent Media Storage (Cloudinary CDN)** | [`inventoryParser.ts:uploadImage`](file:///c:/Users/USER/Documents/Biblio/ace-whatsapp/core/baileys-gateway/src/inventoryParser.ts#L693) | Upgraded to production Cloudinary SDK v2. Images are streamed directly to Cloudinary (`ace/vendors/{vendorId}`) using `upload_stream` and return permanent public HTTPS CDN URLs (`secure_url`) stored in `products.image_url`. | ✅ **LIVE (Cloudinary)** | Optional: Configure custom CNAME CDN domain in Cloudinary dashboard. |
| **3** | **Sales-Velocity & Margin Status Scheduler** | [`statusPoster.ts:postNextProduct`](file:///c:/Users/USER/Documents/Biblio/ace-whatsapp/core/baileys-gateway/src/statusPoster.ts#L154) | 30-minute cron scheduler runs an algorithmic ranking CTE. It calculates gross margins `(price - floor)/price` and evaluates 14-day sales velocity (`orders` table lookup) to prioritize slow-moving, high-margin inventory for WhatsApp Status broadcasts. | ✅ **LIVE (Algorithmic)** | Tune promotion scoring weights based on merchant seasonality feedback. |
| **4** | **Automated Direct-Buy Status Trigger** | [`inventoryParser.ts:buildStatusCaption`](file:///c:/Users/USER/Documents/Biblio/ace-whatsapp/core/baileys-gateway/src/inventoryParser.ts#L657) | Status post captions dynamically generate pre-filled `wa.me` click-to-chat deep-links (`https://wa.me/{phone}?text=...`) carrying the exact SKU, product name, and formatted price. Tapping the link instantly opens the chat with pre-filled buyer intent. | ✅ **LIVE (wa.me Deep-Link)** | Optional: Generate short-links with UTM analytics tracking. |
| **5** | **LinUCB Contextual Bandit Live Action Gating** | [`pricingBandit.ts`](file:///c:/Users/USER/Documents/Biblio/shared/src/rl/pricingBandit.ts)<br/>[`agentLoop.ts`](file:///c:/Users/USER/Documents/Biblio/ace-whatsapp/core/ai-negotiator/src/agentLoop.ts#L180) | Live in runtime! `agentLoop.ts` computes the 6D context vector (LTV, order recency, product margin, order value, dialect, time of day) and invokes `proposeBanditPrice` to inject learned pricing signals into the system prompt. Every turn records `bandit_arm`, and `recordOrderOutcome` backdates margin rewards into Redis. | ✅ **LIVE & GATING** | Periodic automated hyperparameter sweeps for exploration factor `alpha`. |
| **6** | **Live Bank Virtual Account Provisioning (VAN)** | [`tools.ts:issuePaymentLink`](file:///c:/Users/USER/Documents/Biblio/ace-whatsapp/core/ai-negotiator/src/tools.ts#L757)<br/>[`payment-verification`](file:///c:/Users/USER/Documents/Biblio/ace-whatsapp/core/payment-verification/src/index.ts) | Integrates with Paystack's Charge API (`bank_transfer` channel) to generate real dynamic dedicated virtual accounts (Providus/Wema). Inbound webhooks on `:3002` verify HMAC signatures and reconcile payments automatically. | ✅ **LIVE (Paystack DVA)** | Add Monnify / Wema Bank direct API backup adapters for multi-PSP redundancy. |
| **7** | **Meta Cloud API Voice Note STT** | [`debounce.ts:turnWorker`](file:///c:/Users/USER/Documents/Biblio/ace-whatsapp/core/comms-router/src/debounce.ts#L201)<br/>[`ingestion-service`](file:///c:/Users/USER/Documents/Biblio/ace-whatsapp/core/ingestion-service/src/index.ts) | Meta Cloud API inbound audio notes are downloaded from the Graph API using per-merchant system tokens, buffered into memory, and transcribed in real-time via Groq Whisper (`mediaProcessor.ts`). | ✅ **LIVE (Graph API + Whisper)** | Cache transcribed audio buffers in Redis to prevent re-fetching on replays. |
| **8** | **Automated Rider Dispatch & Carrier Booking** | [`logistics/src/streamConsumer.ts`](file:///c:/Users/USER/Documents/Biblio/ace-whatsapp/core/logistics/src/streamConsumer.ts)<br/>[`dispatchService.ts`](file:///c:/Users/USER/Documents/Biblio/ace-whatsapp/core/logistics/src/dispatchService.ts) | Redis Stream `stream:payments.verified` publishes verified orders on `PAYMENT_CONFIRMED`. The logistics stream consumer auto-dispatches riders via Sendstack/Kwik APIs, transitions order state to `out_for_delivery`, and notifies customers with live tracking URLs. | ✅ **LIVE (Redis Stream + Sendstack)** | Add courier webhooks to advance state machine from `out_for_delivery` to `delivered`. |
| **9** | **Offline-First Resilience & Deep-Link Failover** | [`_layout.tsx`](file:///c:/Users/USER/Documents/Biblio/ace-merchant-app/app/_layout.tsx)<br/>[`statusPoster.ts`](file:///c:/Users/USER/Documents/Biblio/ace-whatsapp/core/baileys-gateway/src/statusPoster.ts)<br/>[`vendorCommunique.ts`](file:///c:/Users/USER/Documents/Biblio/ace-whatsapp/core/comms-router/src/vendorCommunique.ts) | React Query `offlineFirst` with 24h `AsyncStorage` cache; automatic `wa.me` deep-link failover on socket drop; dual-track SMS escalation with 5-minute delayed BullMQ reminder. | ✅ **LIVE & ACTIVE** | Zero-downtime offline continuity across volatile network conditions. |

---

### 8. Biblio Mobile App Architecture & Hardware Polish
- **Full-Height Modal Drawers ([`SidePanel.tsx`](file:///c:/Users/USER/Documents/Biblio/ace-merchant-app/src/components/SidePanel.tsx))**:
  - Converted the slide-in drawer to a root `<Modal visible transparent statusBarTranslucent>` with `position: 'absolute', top: 0, bottom: 0, right: 0, height: '100%'`.
  - Fixes the Android/iOS hardware navigation bar gap where drawers were previously raised above the screen bottom.
- **Zero White-Flash Screen Transitions**:
  - Added React Navigation `ThemeProvider` directly in [`app/_layout.tsx`](file:///c:/Users/USER/Documents/Biblio/ace-merchant-app/app/_layout.tsx) with theme background matching.
  - Bound `backgroundColor: c.bg` across `GestureHandlerRootView`, `SafeAreaProvider`, and `Tabs` `sceneStyle`.
  - Configured root window dark background `#090A0C` in [`app.json`](file:///c:/Users/USER/Documents/Biblio/ace-merchant-app/app.json).
- **Clean Standardized Header Architecture ([`ScreenHeader.tsx`](file:///c:/Users/USER/Documents/Biblio/ace-merchant-app/src/components/ScreenHeader.tsx))**:
  - Removed redundant boxed container wrappers around headers in [`suppliers.tsx`](file:///c:/Users/USER/Documents/Biblio/ace-merchant-app/app/suppliers.tsx) and [`crm.tsx`](file:///c:/Users/USER/Documents/Biblio/ace-merchant-app/app/crm.tsx).
  - Standardized all sub-screens to consistent hit targets, back arrows, and pill search bars.
- **Live Inventory & Sync Carousel**:
  - Added horizontal carousel to [`app/(tabs)/index.tsx`](file:///c:/Users/USER/Documents/Biblio/ace-merchant-app/app/(tabs)/index.tsx) displaying stock levels, WhatsApp origin tags, and Naira prices.
  - Seamless "Add First Product" routing into [`crm.tsx`](file:///c:/Users/USER/Documents/Biblio/ace-merchant-app/app/crm.tsx), prioritizing manual 1-tap addition with optional WhatsApp catalog syncing.
- **100% Scroll & Safe-Area Coverage**:
  - All screens (`index`, `inbox`, `more`, `crm`, `suppliers`, `chats`, `chat/[id]`, `finance`, `settings`, `notifications`, `support`, `search`) use `ScrollView` or `FlatList` with `keyboardShouldPersistTaps="handled"` and `contentContainerStyle` padding ($100\text{--}140\text{px}$) ensuring elements are never clipped by the floating bottom tab bar.

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
| **RL & Contextual Bandits** | LinUCB Contextual Bandit (`shared/src/rl/pricingBandit.ts`) with 6D state vector & margin-based reward feedback |
| **RAG & Exemplar Memory** | Dialect/tier-indexed Exemplar Store (`shared/src/rag/exemplarStore.ts`) with dynamic prompt injection |
| **Outcome & Feedback Loop** | Interaction Feedback Engine (`shared/src/feedback/interactionFeedback.ts`) & `conversation_outcomes` ledger |
| **Core microservices** | Fastify, TypeScript, BullMQ, Redis, PostgreSQL |
| **WhatsApp Gateways** | Meta WhatsApp Cloud API (`ingestion-service`) & Baileys Multi-Device Web Sockets (`baileys-gateway`) |
| **Merchant app** | React Native + Expo (v57, Reanimated 4, NativeWind 4, TanStack Query) |
| **Customer interface** | WhatsApp Direct UI & Progressive Web App |
| **Primary DB** | PostgreSQL (ACID, Neon serverless, partitioned by `merchant_id`) |
| **State cache & Queue** | Redis + BullMQ (4.5s debounce window, rate-limiting, locks) |
| **Payments** | Monnify / Paystack / Flutterwave Dynamic Virtual Account Numbers (VAN) |

---

## 🚀 Quickstart & Local Testing Guide

### 1. Prerequisites
Ensure you have the following installed:
- **Node.js** >= v20
- **Redis** running locally (`redis://localhost:6379`) or via cloud Redis
- **PostgreSQL** (Neon cloud connection string in `DATABASE_URL`)

### 2. Environment Configuration
Verify that `.env` in the root repository contains:
```env
DATABASE_URL=postgresql://neondb_owner:***@ep-***.us-east-2.aws.neon.tech/biblio?sslmode=require
REDIS_URL=redis://localhost:6379
MERCHANT_API_PORT=3004
BAILEYS_GATEWAY_PORT=3005
APILAYER_API_KEY=your_apilayer_key_here
GROQ_API_KEY=your_groq_key_here
ANTHROPIC_API_KEY=your_anthropic_key_here
PAYSTACK_SECRET_KEY=your_paystack_key_here
```

### 3. Starting the Core Backend Services

You can launch each service in its own terminal window:

```bash
# Terminal 1: Merchant API (Backend REST & Mobile Gateway on :3004)
npm run merchant-api

# Terminal 2: Baileys WhatsApp Gateway (Multi-session WhatsApp Manager on :3005)
npm run baileys-gateway

# Terminal 3: Comms Router & Outbound Queue Worker (Sliding Debounce)
npm run comms-router

# Terminal 4: Event Orchestrator (Retention, Logistics & Outbox Relays)
npm run event-orchestrator
```

### 4. Starting the Mobile & Web Operator App

Launch the merchant mobile app:

```bash
# Navigate to mobile app directory
cd ace-merchant-app

# Run in Web Browser (accessible at http://localhost:8081)
npm run web

# Or run in Expo Go / Android Emulator / iOS Simulator:
npm run start
```

### 5. Verifying Live Endpoints
Run quick verification checks from your terminal:
```bash
# Check Merchant API health
curl http://localhost:3004/health
# Response: {"ok":true}

# Check Baileys Gateway health
curl http://localhost:3005/health
# Response: {"ok":true,"activeSessions":0,"sessions":[]}

# Check Live Test Suite
npm test
# Result: 129 passed (129)

# Verify Strict TypeScript Compilation
npm run typecheck
# Result: 0 errors
```

---

## Key Documents

### Product & Architecture
- [Phase 1 Architecture](./ace-whatsapp/ARCHITECTURE.md) — Multi-service system architecture
- [Autonomous Workflows](./docs/product/WORKFLOWS.md) — 4 core workflows with step-by-step flows
- [Lead-to-Close Pipeline](./docs/product/LEAD_TO_CLOSE.md) — 10-stage full automation pipeline
- [Vendor Communiqué System](./docs/product/VENDOR_COMMUNIQUE.md) — SMS decision protocol
- [AI Negotiator](./ace-whatsapp/core/ai-negotiator/README.md) — Negotiation arc, 6 tactics, circuit breaker
- [RL & RAG Pipeline Architecture](./shared/src/rl/pricingBandit.ts) — LinUCB Bandit, Exemplar Store, & Outcome Feedback

### Engineering & Infrastructure
- [Database Architecture](./infra/README.md) — PostgreSQL schema, indexing, and design rationale
- [Engineering Guidelines](./docs/engineering/GUIDELINES.md) — 8 principles, critical vulnerability mitigations
- [Data Collection Architecture](./docs/engineering/DATA_COLLECTION.md) — 5 data types, Kafka topology
- [Interaction Feedback & Bandit Training](./shared/src/feedback/interactionFeedback.ts) — Outcome backdating & policy updates