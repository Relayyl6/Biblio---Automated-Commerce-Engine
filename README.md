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
| **Order Fulfillment** | Customer texts → AI parses intent (Whisper → BERT → GPT-4o) → AI Negotiator closes deal → virtual account issued → payment verified → rider dispatched → merchant notified | **Zero** |
| **Demand-Driven Restocking** | Inventory Oracle detects stockout (16hr lead) → pings supplier WhatsApp → negotiates price → margin analysis → drafts PO | **1 tap (8 seconds)** |
| **Customer Retention Engine** | Nightly analyser detects at-risk VIP → generates culturally-nuanced message → sends after 4hr hold if no merchant action | **Optional review** |
| **Multimodal Visual Resolution** | "That blue dress in your last reel" → CLIP embeddings → SKU resolved → price negotiated autonomously | **Zero** |

---

## The AI Negotiator — ACE's Most Differentiated Feature

ACE doesn't apply discounts. It **negotiates** — like a skilled market trader who knows the customer's full history, operates in their dialect, and closes deals autonomously within merchant-defined boundaries.

**The negotiation arc:** Anchor → Acknowledge → Counter → Close / Pivot / Escalate

**6 autonomous tactics:** Relationship Anchor · Bundle Pivot · Inventory-Verified Scarcity · Future Credit · Urgency Window · Sentiment-Aware Soft Close

**The Rust circuit breaker:** The AI is **physically prevented** from closing below the merchant's floor price. On below-floor requests: Bundle Pivot → Future Credit → Vendor Communiqué SMS to merchant.

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

## The Secondary Business — The Real Moat

By operating the primary product, ACE becomes **the most valuable dataset in emerging markets** — data that is ungoogleable, unscrapeable, and doesn't exist in structured form anywhere else.

| Enterprise Product | Buyers | Year 2 ARR |
|-------------------|--------|------------|
| [AI Training Data Marketplace](./data-intelligence/ai-training-marketplace/) | OpenAI, Anthropic, Google DeepMind, Meta AI, Mistral | $7.2M |
| [FMCG Market Pulse](./data-intelligence/fmcg-intelligence/) | Unilever, Nestlé, P&G, PZ Cussons, Dangote | $5.76M |
| [ACE TrustScore API](./data-intelligence/trust-score-api/) | Kuda, FairMoney, GTBank, Access Bank, MFIs | $3.57M |
| **Total B2B (Year 2)** | | **$16.53M** |

**Five data types collected at zero marginal cost:** Conversational transcripts (AI labs) · Commerce signals (FMCG) · Negotiation traces / price elasticity (FMCG) · Merchant behavioural signals (TrustScore) · Goods-level product intel (FMCG + TrustScore)

> **We are Scale AI meets Respond.io, built for the $2.3T informal economy that traditional SaaS completely ignores.**

---

## The Four Structural Moats (Disintermediation is Economically Irrational)

A merchant considering leaving ACE must calculate:

| What They Lose | Monthly Cost of Leaving |
|---------------|------------------------|
| Aggregate logistics pricing (₦600 → ₦280/delivery) | ₦20,000/month |
| Escrow trust signal (34% higher conversion, 22% higher AOV) | ₦35,000/month revenue impact |
| Exclusive supplier network (20% COGS discount) | ₦15,000/month margin loss |
| Global Buyer ID 1-tap checkout network | ₦40,000/month revenue impact |
| **Total cost of leaving** | **₦110,000/month** |
| **Cost of staying (subscription)** | **₦12,000/month** |
| **ROI of staying** | **817%** |

---

## Technology Stack

| Layer | Stack |
|-------|-------|
| **Agent / AI orchestration** | TypeScript + **Vercel AI SDK** (`generateObject` for typed intents, tool-calling into Rust services) |
| **Core microservices** | Rust (Actix-web, Tokio, SQLx, Tonic, rdkafka) |
| **AI/ML inference** | Python + FastAPI (Whisper, regional dialect BERT, GPT-4o) |
| **Merchant app** | React Native + Expo (OTA updates) |
| **Customer interface** | Progressive Web App (WhatsApp in-app browser, < 3s on 3G) |
| **Primary DB** | PostgreSQL (ACID, partitioned by `merchant_id`) |
| **Vector DB** | Qdrant (conversation embeddings, visual product embeddings) |
| **State cache** | Redis (conversation state, service window tracking, distributed locks) |
| **Event bus** | Apache Kafka (immutable event log — all domain events) |
| **Data warehouse** | ClickHouse (FMCG dashboards, enterprise analytics) |

---

## Market Sizing

| | Size |
|--|------|
| **TAM** — Sub-Saharan Africa, SE Asia, Latin America | $2.3T annually |
| **SAM** — WhatsApp-dominant markets (Nigeria, Kenya, Indonesia, Brazil, Mexico) | $840B |
| **SOM Year 1** — Nigerian fashion, food distribution, personal care | $12B |

---

## Revenue Architecture

| Revenue Stream | Year 1 | Year 2 | Year 5 |
|---------------|--------|--------|--------|
| Merchant subscriptions (B2C) | $1.2M | $8.27M | $45M |
| AI Training Data | — | $7.2M | $18M |
| FMCG Intelligence | — | $5.76M | $22M |
| TrustScore API | — | $3.57M | $16M |
| Proprietary ASR API | — | — | $15M |
| **Total ARR** | **$1.2M** | **$24.8M** | **$116M** |

---

## Timeline — Demo-Ready in 5.5 Months

| Milestone | Date |
|-----------|------|
| Project start | May 18, 2026 |
| 50 beta merchants onboarded (Lagos) | July 31, 2026 |
| All 4 autonomous workflows operational | August 31, 2026 |
| Payment verification live (banking API + escrow) | September 15, 2026 |
| Logistics aggregator live (Kwik + Gokada) | September 30, 2026 |
| Demo-ready: full lead-to-close pipeline autonomous | **October 31, 2026** |

---

## Key Documents

### Product
- [Phase 1 Architecture](./ace-whatsapp/ARCHITECTURE.md) — 11 microservices, full system diagram
- [Autonomous Workflows](./docs/product/WORKFLOWS.md) — 4 core workflows with step-by-step flows
- [Lead-to-Close Pipeline](./docs/product/LEAD_TO_CLOSE.md) — 10-stage full automation pipeline
- [Vendor Communiqué System](./docs/product/VENDOR_COMMUNIQUE.md) — SMS decision protocol
- [AI Negotiator](./ace-whatsapp/core/ai-negotiator/README.md) — Negotiation arc, 6 tactics, circuit breaker

### Business
- [Financial Model](./docs/business/FINANCIAL_MODEL.md) — Subscription tiers, unit economics, projections
- [Go-to-Market Strategy](./docs/business/GO_TO_MARKET.md) — Lagos pilot, merchant acquisition
- [Enterprise Products](./docs/business/ENTERPRISE_PRODUCTS.md) — B2B data product strategy
- [Competitive Moats](./docs/business/COMPETITIVE_MOATS.md) — Four structural lock-in mechanisms
- [Risk Mitigation](./docs/business/RISK_MITIGATION.md) — Critical flaws and hardened solutions

### Engineering
- [Engineering Guidelines](./docs/engineering/GUIDELINES.md) — 8 principles, critical vulnerability mitigations
- [AI Training Strategy](./docs/engineering/AI_TRAINING.md) — Model hierarchy, RLHF pipeline
- [Data Collection Architecture](./docs/engineering/DATA_COLLECTION.md) — 5 data types, Kafka topology

### Phase 2
- [Phase 2 Architecture](./ace-platform/ARCHITECTURE.md) — Multi-channel enterprise platform

### Shared Infrastructure
- [Vercel AI SDK Config](./shared/ai-sdk/README.md) — Tools, schemas, training middleware
- [Database Architecture](./infra/README.md) — All 5 databases with design rationale




















 Now the payment-verification service. This is the integration that
  closes the order lifecycle: awaiting_payment → payment_verified. Let
  me set up the work.

● Update(infra\schema.sql)
 
───────────────────────────────────────────────────────────────────────
 Edit file
 infra\schema.sql
╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌
 62  
 63  create index orders_customer_merchant_idx on orders (customer_id, 
     merchant_id, updated_at desc);
 64  
 65 +-- Payment-verification looks up the awaiting-payment order by the
    + virtual account                                                  
 66 +-- number the customer paid into. This expression index keeps that
    + lookup cheap.                                                    
 67 +create index orders_virtual_account_idx on orders ((state->>'virtu
    +alAccountNumber'));                                               
 68 +                                                                  
 69 +-- ─── Transactions (payment ledger) ─────────────────────────────
    +────────────────                                                  
❯ Module '"./negotiationArc"' has no exported member                   
  'projectRangeOntoArc'. then add this payment‑verification webhook    
  and any other thing for ace-whatsapp to work well                    

● First let me settle the projectRangeOntoArc error — my tsc run passed
  clean, so I suspect a stale TS server, but I won't hand-wave it. Let
  me verify the actual on-disk state and read the payment-verification
  spec.

● Bash(grep -n "projectRangeOntoArc"
      ace-whatsapp/core/ai-negotiator/src/negotiationArc.ts; echo
      "---"; git -c core.fileMode=false status --short --
      ace-whatsapp/core/…)
  ⎿  219:export function projectRangeOntoArc(
     ---
     AM ace-whatsapp/core/ai-negotiator/src/negotiationArc.ts

  Read 2 files (ctrl+o to expand)

● Resolved: projectRangeOntoArc is exported (line 219) and tsc --noEmit
  passes with exit 0. That error is a stale TS language-server cache
  in your editor, not a real compile error — restart it (VS Code:
  Ctrl+Shift+P → "TypeScript: Restart TS Server", or just reload the
  window). The code on disk is correct.

  Now the payment-verification service. This is the integration that
  closes the order lifecycle: awaiting_payment → payment_verified. Let
  me set up the work.

● Update(infra\schema.sql)
  ⎿  Added 24 lines
      62  
      63  create index orders_customer_merchant_idx on orders (c
          ustomer_id, merchant_id, updated_at desc);
      64  
      65 +-- Payment-verification looks up the awaiting-payment 
         +order by the virtual account                          
      66 +-- number the customer paid into. This expression inde
         +x keeps that lookup cheap.                            
      67 +create index orders_virtual_account_idx on orders ((st
         +ate->>'virtualAccountNumber'));                       
      68 +                                                      
      69 +-- ─── Transactions (payment ledger) ─────────────────
         +────────────────────────────                          
      70 +-- One row per inbound payment event from a bank/card 
         +provider. `provider_ref` is                           
      71 +-- UNIQUE — it is the idempotency key that makes webho
         +ok redelivery a no-op (the                            
      72 +-- payment provider, like Meta, retries until it gets 
         +a 2xx). Mirrors the                                   
      73 +-- `transactions` table in infra/README.md.           
      74 +create table transactions (                           
      75 +  id uuid primary key default uuid_generate_v4(),     
      76 +  order_id uuid references orders(id),                
      77 +  merchant_id uuid not null references merchants(id), 
      78 +  customer_id text not null,                          
      79 +  amount numeric not null,                 -- amount p
         +aid, in NGN                                           
      80 +  virtual_account text,                    -- the VAN 
         +credited                                              
      81 +  provider_ref text not null unique,       -- bank/car
         +d reference — idempotency key                         
      82 +  status text not null,                    -- 'confirm
         +ed' | 'underpaid' | 'unmatched'                       
      83 +  created_at timestamptz not null default now()       
      84 +);                                                    
      85 +                                                      
      86 +create index transactions_order_idx on transactions (o
         +rder_id, created_at desc);                            
      87 +create index transactions_merchant_idx on transactions
         + (merchant_id, created_at desc);                      
      88 +                                                      
      89  create table escalations (
      90    id uuid primary key default uuid_generate_v4(),
      91    merchant_id uuid not null references merchants(id),

● API Error: 402 {"error":"Usage limit reached, will reset on 
  tomorrow at 12:04 AM (UTC+8)"}

✻ Worked for 2m 56s

  3 tasks (0 done, 1 in progress, 2 open)
  ◼ Add transactions table to schema
  ◻ Build payment-verification service (pure logic + webhoo…
  ◻ Wire up env, scripts, seed, gap tracker