

=== C:\Users\USER\Documents\Biblio\README.md ===


# ACE â€” Autonomous Commerce Engine

> ### **"Your business runs itself while you sleep."**
> **ACE Technologies Limited** Â· Nigerian C-Corp Â· Delaware flip option post-Series A

---

## The 30-Second Pitch

ACE is an invisible operating system for informal commerce. We turn WhatsApp chaos into autonomous businesses through radical AI automation. Merchants keep texting customers on WhatsApp â€” our AI handles inventory, payments, negotiations, logistics, and customer retention **completely in the background**.

**No new apps for customers. No manual work for merchants. Just autonomous growth.**

---

## The Problem

In Nigeria and across emerging markets, **$2.3 trillion** in commerce happens entirely on WhatsApp. ~480,000 merchants in Lagos alone manage 30â€“150 customer conversations daily through unstructured text, voice notes in Pidgin, and screenshots of bank transfers. These merchants are growing **40% YoY** but hit a hard ceiling at $50K annual revenue â€” they can't scale past their personal bandwidth.

| Current "Solution" | Why It Fails |
|-------------------|-------------|
| WhatsApp Business App | Zero state management, no payment integration, no inventory tracking |
| Respond.io / Zoko / Hilos | Routes chats to human agents â€” still requires merchants to check bank apps, call riders, update inventory manually |
| Shopify / WooCommerce | Requires customers to leave WhatsApp â†’ **78% conversion drop** in emerging markets |
| Traditional ERP (Zoho, Odoo) | Desktop-oriented, requires structured data input â€” alien to merchants who think in conversations |

**The core insight:** The merchant's current system isn't broken â€” it's optimised for n=1. WhatsApp works perfectly for one customer. It catastrophically fails at 50 concurrent conversations. The merchant doesn't need a better inbox. They need an autonomous operating system that executes business logic while they sleep.

---

## The Paradigm Shift

| âŒ What We're NOT Building | âœ… What We ARE Building |
|---------------------------|------------------------|
| An AI chatbot that drafts responses for merchants to review | An autonomous OS that **executes** |
| A fancy CRM with "AI-powered insights" | An event-driven engine with no manual steps |
| Another unified inbox with message routing | Invisible back-office infrastructure |
| A tool requiring customers to change behaviour | Invisible layer on existing WhatsApp behaviour |

**The AI doesn't ask permission. It executes complex multi-step business logic and reports outcomes. The merchant's job shifts from operational execution to strategic exception management.**

---

## The Three-Layer Architecture

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚  LAYER 3: ENTERPRISE INTELLIGENCE PLATFORM (B2B)                 â”‚
â”‚  AI Training Data Â· FMCG Market Pulse Â· ACE TrustScore API       â”‚
â”‚  The "Scale AI of Informal Commerce" â€” $16.5M ARR by Year 2      â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                                â”‚ (Refined data â†’ enterprise buyers)
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â–¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚  LAYER 2: AUTONOMOUS STATE ENGINE (Core IP)                       â”‚
â”‚  11 microservices: Rust core + Vercel AI SDK agent layer          â”‚
â”‚  Ingestion â†’ Identity â†’ AI Negotiator â†’ State Machine â†’           â”‚
â”‚  Payment â†’ Logistics â†’ Supplier â†’ Visual Context â†’ Comms Router   â”‚
â”‚  Every interaction: data collected, refined, monetised            â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                                â”‚ (Raw commerce events)
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â–¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚  LAYER 1: INTERFACE LAYER                                         â”‚
â”‚  Merchant: React Native app (exception dashboard)                 â”‚
â”‚  Customer: WhatsApp â†’ PWA Trojan Horse â†’ Global Buyer ID          â”‚
â”‚  Vendor CommuniquÃ©: SMS reply-code for merchant decisions         â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

---

## The Four Autonomous Workflows

ACE automates the **entire commercial lifecycle** â€” from first customer message to post-sale retention. The merchant interacts only with exceptions.

| Workflow | What ACE Does | Merchant Input |
|----------|--------------|---------------|
| **Order Fulfillment** | Customer texts â†’ AI parses intent (Whisper â†’ BERT â†’ GPT-4o) â†’ AI Negotiator closes deal â†’ virtual account issued â†’ payment verified â†’ rider dispatched â†’ merchant notified | **Zero** |
| **Demand-Driven Restocking** | Inventory Oracle detects stockout (16hr lead) â†’ pings supplier WhatsApp â†’ negotiates price â†’ margin analysis â†’ drafts PO | **1 tap (8 seconds)** |
| **Customer Retention Engine** | Nightly analyser detects at-risk VIP â†’ generates culturally-nuanced message â†’ sends after 4hr hold if no merchant action | **Optional review** |
| **Multimodal Visual Resolution** | "That blue dress in your last reel" â†’ CLIP embeddings â†’ SKU resolved â†’ price negotiated autonomously | **Zero** |

---

## The AI Negotiator â€” ACE's Most Differentiated Feature

ACE doesn't apply discounts. It **negotiates** â€” like a skilled market trader who knows the customer's full history, operates in their dialect, and closes deals autonomously within merchant-defined boundaries.

**The negotiation arc:** Anchor â†’ Acknowledge â†’ Counter â†’ Close / Pivot / Escalate

**6 autonomous tactics:** Relationship Anchor Â· Bundle Pivot Â· Inventory-Verified Scarcity Â· Future Credit Â· Urgency Window Â· Sentiment-Aware Soft Close

**The Rust circuit breaker:** The AI is **physically prevented** from closing below the merchant's floor price. On below-floor requests: Bundle Pivot â†’ Future Credit â†’ Vendor CommuniquÃ© SMS to merchant.

**Every negotiation is a data asset:** `NegotiationTrace` logs price elasticity per SKU, per geography, per customer tier â†’ sold to FMCG brands as market intelligence.

---

## The Vendor CommuniquÃ© System

ACE keeps merchants in control without requiring them to be at a dashboard.

```
Exception detected â†’ Channel selected by urgency:
  > â‚¦50K order dispute  â†’ AI voice call
  Pricing exception     â†’ SMS: "Amaka wants dress at â‚¦12K (floor: â‚¦14,250). Reply 1-approve, 2-hold, 3-bundle"
  Restock approval      â†’ SMS: "Red Ankara running out. Alhaji: â‚¦42K for 50yds (44% margin). Reply 1 to approve."
  Routine orders        â†’ WhatsApp morning digest
  Stats                 â†’ App push (weekly)
```

Merchants respond with a single digit from **any phone**. No app needed. Works on feature phones.

---

## The Secondary Business â€” The Real Moat

By operating the primary product, ACE becomes **the most valuable dataset in emerging markets** â€” data that is ungoogleable, unscrapeable, and doesn't exist in structured form anywhere else.

| Enterprise Product | Buyers | Year 2 ARR |
|-------------------|--------|------------|
| [AI Training Data Marketplace](./data-intelligence/ai-training-marketplace/) | OpenAI, Anthropic, Google DeepMind, Meta AI, Mistral | $7.2M |
| [FMCG Market Pulse](./data-intelligence/fmcg-intelligence/) | Unilever, NestlÃ©, P&G, PZ Cussons, Dangote | $5.76M |
| [ACE TrustScore API](./data-intelligence/trust-score-api/) | Kuda, FairMoney, GTBank, Access Bank, MFIs | $3.57M |
| **Total B2B (Year 2)** | | **$16.53M** |

**Five data types collected at zero marginal cost:** Conversational transcripts (AI labs) Â· Commerce signals (FMCG) Â· Negotiation traces / price elasticity (FMCG) Â· Merchant behavioural signals (TrustScore) Â· Goods-level product intel (FMCG + TrustScore)

> **We are Scale AI meets Respond.io, built for the $2.3T informal economy that traditional SaaS completely ignores.**

---

## The Four Structural Moats (Disintermediation is Economically Irrational)

A merchant considering leaving ACE must calculate:

| What They Lose | Monthly Cost of Leaving |
|---------------|------------------------|
| Aggregate logistics pricing (â‚¦600 â†’ â‚¦280/delivery) | â‚¦20,000/month |
| Escrow trust signal (34% higher conversion, 22% higher AOV) | â‚¦35,000/month revenue impact |
| Exclusive supplier network (20% COGS discount) | â‚¦15,000/month margin loss |
| Global Buyer ID 1-tap checkout network | â‚¦40,000/month revenue impact |
| **Total cost of leaving** | **â‚¦110,000/month** |
| **Cost of staying (subscription)** | **â‚¦12,000/month** |
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
| **Event bus** | Apache Kafka (immutable event log â€” all domain events) |
| **Data warehouse** | ClickHouse (FMCG dashboards, enterprise analytics) |

---

## Market Sizing

| | Size |
|--|------|
| **TAM** â€” Sub-Saharan Africa, SE Asia, Latin America | $2.3T annually |
| **SAM** â€” WhatsApp-dominant markets (Nigeria, Kenya, Indonesia, Brazil, Mexico) | $840B |
| **SOM Year 1** â€” Nigerian fashion, food distribution, personal care | $12B |

---

## Revenue Architecture

| Revenue Stream | Year 1 | Year 2 | Year 5 |
|---------------|--------|--------|--------|
| Merchant subscriptions (B2C) | $1.2M | $8.27M | $45M |
| AI Training Data | â€” | $7.2M | $18M |
| FMCG Intelligence | â€” | $5.76M | $22M |
| TrustScore API | â€” | $3.57M | $16M |
| Proprietary ASR API | â€” | â€” | $15M |
| **Total ARR** | **$1.2M** | **$24.8M** | **$116M** |

---

## Timeline â€” Demo-Ready in 5.5 Months

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
- [Phase 1 Architecture](./ace-whatsapp/ARCHITECTURE.md) â€” 11 microservices, full system diagram
- [Autonomous Workflows](./docs/product/WORKFLOWS.md) â€” 4 core workflows with step-by-step flows
- [Lead-to-Close Pipeline](./docs/product/LEAD_TO_CLOSE.md) â€” 10-stage full automation pipeline
- [Vendor CommuniquÃ© System](./docs/product/VENDOR_COMMUNIQUE.md) â€” SMS decision protocol
- [AI Negotiator](./ace-whatsapp/core/ai-negotiator/README.md) â€” Negotiation arc, 6 tactics, circuit breaker

### Business
- [Financial Model](./docs/business/FINANCIAL_MODEL.md) â€” Subscription tiers, unit economics, projections
- [Go-to-Market Strategy](./docs/business/GO_TO_MARKET.md) â€” Lagos pilot, merchant acquisition
- [Enterprise Products](./docs/business/ENTERPRISE_PRODUCTS.md) â€” B2B data product strategy
- [Competitive Moats](./docs/business/COMPETITIVE_MOATS.md) â€” Four structural lock-in mechanisms
- [Risk Mitigation](./docs/business/RISK_MITIGATION.md) â€” Critical flaws and hardened solutions

### Engineering
- [Engineering Guidelines](./docs/engineering/GUIDELINES.md) â€” 8 principles, critical vulnerability mitigations
- [AI Training Strategy](./docs/engineering/AI_TRAINING.md) â€” Model hierarchy, RLHF pipeline
- [Data Collection Architecture](./docs/engineering/DATA_COLLECTION.md) â€” 5 data types, Kafka topology

### Phase 2
- [Phase 2 Architecture](./ace-platform/ARCHITECTURE.md) â€” Multi-channel enterprise platform

### Shared Infrastructure
- [Vercel AI SDK Config](./shared/ai-sdk/README.md) â€” Tools, schemas, training middleware
- [Database Architecture](./infra/README.md) â€” All 5 databases with design rationale




















 Now the payment-verification service. This is the integration that
  closes the order lifecycle: awaiting_payment â†’ payment_verified. Let
  me set up the work.

â— Update(infra\schema.sql)
 
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
 Edit file
 infra\schema.sql
â•Œâ•Œâ•Œâ•Œâ•Œâ•Œâ•Œâ•Œâ•Œâ•Œâ•Œâ•Œâ•Œâ•Œâ•Œâ•Œâ•Œâ•Œâ•Œâ•Œâ•Œâ•Œâ•Œâ•Œâ•Œâ•Œâ•Œâ•Œâ•Œâ•Œâ•Œâ•Œâ•Œâ•Œâ•Œâ•Œâ•Œâ•Œâ•Œâ•Œâ•Œâ•Œâ•Œâ•Œâ•Œâ•Œâ•Œâ•Œâ•Œâ•Œâ•Œâ•Œâ•Œâ•Œâ•Œâ•Œâ•Œâ•Œâ•Œâ•Œâ•Œâ•Œâ•Œâ•Œâ•Œâ•Œâ•Œâ•Œâ•Œâ•Œâ•Œ
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
 69 +-- â”€â”€â”€ Transactions (payment ledger) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    +â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€                                                  
â¯ Module '"./negotiationArc"' has no exported member                   
  'projectRangeOntoArc'. then add this paymentâ€‘verification webhook    
  and any other thing for ace-whatsapp to work well                    

â— First let me settle the projectRangeOntoArc error â€” my tsc run passed
  clean, so I suspect a stale TS server, but I won't hand-wave it. Let
  me verify the actual on-disk state and read the payment-verification
  spec.

â— Bash(grep -n "projectRangeOntoArc"
      ace-whatsapp/core/ai-negotiator/src/negotiationArc.ts; echo
      "---"; git -c core.fileMode=false status --short --
      ace-whatsapp/core/â€¦)
  âŽ¿  219:export function projectRangeOntoArc(
     ---
     AM ace-whatsapp/core/ai-negotiator/src/negotiationArc.ts

  Read 2 files (ctrl+o to expand)

â— Resolved: projectRangeOntoArc is exported (line 219) and tsc --noEmit
  passes with exit 0. That error is a stale TS language-server cache
  in your editor, not a real compile error â€” restart it (VS Code:
  Ctrl+Shift+P â†’ "TypeScript: Restart TS Server", or just reload the
  window). The code on disk is correct.

  Now the payment-verification service. This is the integration that
  closes the order lifecycle: awaiting_payment â†’ payment_verified. Let
  me set up the work.

â— Update(infra\schema.sql)
  âŽ¿  Added 24 lines
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
      69 +-- â”€â”€â”€ Transactions (payment ledger) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
         +â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€                          
      70 +-- One row per inbound payment event from a bank/card 
         +provider. `provider_ref` is                           
      71 +-- UNIQUE â€” it is the idempotency key that makes webho
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
         +d reference â€” idempotency key                         
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

â— API Error: 402 {"error":"Usage limit reached, will reset on 
  tomorrow at 12:04 AM (UTC+8)"}

âœ» Worked for 2m 56s

  3 tasks (0 done, 1 in progress, 2 open)
  â—¼ Add transactions table to schema
  â—» Build payment-verification service (pure logic + webhooâ€¦
  â—» Wire up env, scripts, seed, gap tracker


=== C:\Users\USER\Documents\Biblio\ace-platform\README.md ===


# ACE Platform â€” Phase 2

> **The Full Commerce Operating System**  
> Status: Design phase â€” development begins post-Series A  
> Prerequisite: Phase 1 (ace-whatsapp/) demo-ready by October 2026

---

## What Phase 2 Is

Phase 1 (ACE WhatsApp) proves the autonomous commerce engine on a single channel. Phase 2 opens ACE into a full, multi-channel commerce OS â€” extending the same AI execution engine across every channel a merchant uses, adding a rich merchant dashboard for teams, and fully activating the enterprise data intelligence products that Phase 1 has been building toward.

Phase 2 is where **the Scale AI monetisation arc fully kicks in**: by this point, ACE has months of transaction data, trained dialect models, and a negotiation intelligence database that enterprise buyers are willing to pay tens of millions for.

---

## Phase 1 â†’ Phase 2 Transition

| Capability | Phase 1 (WhatsApp) | Phase 2 (Platform) |
|------------|-------------------|---------------------|
| **Channels** | WhatsApp only | WhatsApp + Instagram DM + SMS + Voice + Web widget |
| **Merchant UI** | Exception dashboard + Vendor CommuniquÃ© SMS | Full commerce OS â€” teams, analytics, campaigns |
| **Customer UI** | WhatsApp â†’ PWA | WhatsApp â†’ PWA â†’ native-quality web + app |
| **AI Negotiator** | Active on WhatsApp | Cross-channel â€” same negotiation logic, any channel |
| **Analytics** | Daily SMS/WA digest | Full BI: revenue forecasts, cohort analysis, demand curves |
| **Multi-user** | Single merchant login | Teams, roles, permissions, audit trails |
| **Supplier network** | WhatsApp template pings | Full supplier portal â€” orders, invoices, delivery tracking |
| **Data product** | Background collection, pipeline building | Active enterprise marketplace â€” AI labs, FMCG, banks |
| **API access** | Internal only | Full public API for 3rd-party integrations |
| **Merchant size** | SME (1â€“5 person, 30â€“150 orders/month) | Larger merchants, distributors, FMCG agent networks |
| **Infrastructure** | Docker Compose | Kubernetes â€” multi-region ready |

---

## The New Merchant Experience in Phase 2

### From Exception Dashboard â†’ Full Commerce OS

Phase 1 merchants see a minimal exception queue. Phase 2 merchants have a full professional dashboard:

**Command Center (Web App):**
- Live revenue waterfall (real-time GMV, margin, orders/hour)
- AI-generated demand forecasts: "Based on current velocity, you'll need to reorder Blue Satin Midi by Thursday"
- Customer cohort analysis: LTV distribution, churn risk heatmap, re-engagement opportunities
- Team activity feed: what each sales agent is doing, which escalations they've handled
- Logistics SLA monitoring: carrier performance by route, average delivery time vs promise

**The AI Negotiator in Phase 2:**
The same autonomous negotiation engine from Phase 1, now operating across all channels simultaneously. A customer can start a negotiation on WhatsApp, continue it on Instagram DM, and complete checkout on the web widget â€” the AI Negotiator maintains full context across all channels.

**The Vendor CommuniquÃ© in Phase 2:**
SMS reply-code protocol remains for merchants who prefer it. Web dashboard adds a rich decision queue with full context, suggested actions, and one-click approvals. High-stakes decisions (> â‚¦500K orders, enterprise distribution contracts) get a dedicated review flow with full context and recommendation.

---

## Phase 2 New Services

### Multi-Channel Ingestion (`services/channels/`)

```
channels/
â”œâ”€â”€ whatsapp/       # Phase 1 engine â€” unchanged, just imported
â”œâ”€â”€ instagram/      # Instagram Business DM API
â”œâ”€â”€ sms/            # Inbound SMS for low-smartphone markets (Africa's Talking)
â”œâ”€â”€ voice/          # IVR voice ordering (Hausa/Yoruba markets)
â””â”€â”€ web/            # Web chat widget for merchant websites
```

Each adapter normalises messages into the unified internal event format. The AI engine consumes normalised events â€” channel-agnostic. **Same AI, same negotiation logic, any surface.**

### Advanced CRM (`services/crm/`)

Phase 1: customer profiles are stored, segmented automatically.  
Phase 2: full CRM with:
- Custom segments (e.g., "VIP customers who haven't ordered in 14 days AND have LTV > â‚¦100K")
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
- This turns ACE into a **B2B2B platform** â€” creating additional lock-in at the supply side

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

- 12+ months of transaction data across 5,000â€“10,000 merchants
- Dialect BERT fine-tuned on real commerce conversations
- Negotiation traces with price elasticity for hundreds of SKU categories
- Goods-level sell-through data across multiple Nigerian cities
- Merchant behavioural signals for thousands of informal businesses

**This is when enterprise contracts become closing conversations, not exploratory ones.**

```
Phase 2 Enterprise Revenue Timeline:

Month 13â€“15: Close first AI lab contract (Cohere or Mistral)
             Dataset: 100K Nigerian Pidgin commerce conversations
             Value: $600K one-time + $75K/month ongoing

Month 14â€“16: Launch FMCG Market Pulse with 1 anchor client (PZ Cussons)
             Pilot: Lagos demand signals for 3 product lines
             Value: $25K/month pilot â†’ $40K/month full contract

Month 16â€“18: TrustScore API pilot with FairMoney or Carbon
             500K credit checks/month at $0.35 average
             Value: $175K/month ARR

Month 18â€“24: Scale all three to full contracts
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

- [Phase 1 Foundation](../ace-whatsapp/ARCHITECTURE.md) â€” what Phase 2 builds on
- [Enterprise Products](../docs/business/ENTERPRISE_PRODUCTS.md) â€” what Phase 2 monetises
- [Financial Model](../docs/business/FINANCIAL_MODEL.md) â€” Phase 2 revenue projections
- [Go-to-Market](../docs/business/GO_TO_MARKET.md) â€” enterprise GTM sequence
- [AI Negotiator](../ace-whatsapp/core/ai-negotiator/README.md) â€” carries forward unchanged
- [Data Collection](../docs/engineering/DATA_COLLECTION.md) â€” what Phase 2 monetises

## Status

`[ ] Phase 2 design begins post-Series A Â· builds on Phase 1 learnings`



=== C:\Users\USER\Documents\Biblio\ace-platform\apps\admin-portal\README.md ===


# Admin Portal (Platform)

> **ACE Platform â€” Phase 2**  
> Internal ops dashboard + Enterprise client access portal.

## Modules

### Internal Ops (ACE Team)
- Merchant management at scale (health scoring, SLA monitoring)
- AI performance metrics across all channels
- System health and infrastructure monitoring
- Support ticket management
- Billing and revenue operations

### Enterprise Client Portal
- **AI Lab Portal** â€” Dataset download, API access, usage quotas for training data buyers
- **FMCG Brand Dashboard** â€” Real-time demand signal feeds, regional distribution maps
- **Bank Credit API Console** â€” Alternative credit score API access, query logs, bureau reports

## Status

`[ ] Not started â€” placeholder`



=== C:\Users\USER\Documents\Biblio\ace-platform\apps\ai-engine\README.md ===


# AI Engine (Platform)

> **ACE Platform â€” Phase 2**  
> Enhanced multi-channel autonomous AI engine.

## Responsibility

Evolution of the Phase 1 AI Engine. Extends cross-channel context awareness, richer models trained on Phase 1 data, and active intelligence for the enterprise data product.

## Enhancements Over Phase 1

- **Cross-channel context** â€” Same customer recognised across WhatsApp, Instagram, SMS
- **Richer entity models** â€” Trained on millions of Phase 1 transactions
- **Campaign intelligence** â€” Suggests and executes retention campaigns autonomously
- **Demand forecasting** â€” Signals fed to Analytics service
- **Data quality scoring** â€” Ensures intelligence product data is clean and valuable
- **Active learning** â€” Faster adaptation from merchant behaviour patterns

## Inherited from Phase 1

All Phase 1 AI Engine capabilities (NLP, intent classification, autonomous execution, multi-language support) are carried forward and enhanced.

## Status

`[ ] Not started â€” placeholder`



=== C:\Users\USER\Documents\Biblio\ace-platform\apps\api-gateway\README.md ===


# API Gateway

> **ACE Platform â€” Phase 2**  
> Unified entry point for all external and internal traffic.

## Responsibility

Single entry point for all API traffic. Handles authentication, tenant isolation, rate limiting, and routing to downstream services. Also serves the public API for merchant integrations and enterprise buyers.

## Key Responsibilities

- JWT and API key authentication
- Merchant (tenant) isolation enforcement
- Rate limiting and quota management
- Request routing to microservices
- Webhook registration and delivery
- Public API documentation (OpenAPI/Swagger)
- Internal service mesh routing

## API Surface (Planned)

- `POST /v1/messages` â€” Send messages across channels
- `GET /v1/orders` â€” Order management
- `GET/POST /v1/inventory` â€” Inventory management
- `GET /v1/customers` â€” Customer data
- `GET /v1/analytics` â€” Business metrics
- `GET /v1/intelligence/*` â€” Enterprise data product (for approved buyers)

## Status

`[ ] Not started â€” placeholder`



=== C:\Users\USER\Documents\Biblio\ace-platform\apps\mobile-app\README.md ===


# Mobile App

> **ACE Platform â€” Phase 2**  
> iOS & Android companion application.

## Responsibility

A native mobile app for merchants who are primarily phone-based. Companion to the web app, optimised for quick exception management and on-the-go visibility.

## Key Modules

- **Inbox** â€” Push-notified conversation feed
- **Exception Queue** â€” AI escalations requiring merchant input
- **Orders** â€” Quick status updates and dispatch
- **Inventory** â€” Spot checks, quick adjustments
- **Daily Summary** â€” Revenue, orders, outstanding payments
- **Notifications** â€” Customisable alerts for key business events

## Platform Targets

- iOS (via App Store)
- Android (via Google Play + direct APK for sideload-heavy markets)

## Status

`[ ] Not started â€” placeholder`



=== C:\Users\USER\Documents\Biblio\ace-platform\apps\web-app\README.md ===


# Web App

> **ACE Platform â€” Phase 2**  
> The primary merchant-facing commerce OS.

## Responsibility

The full-featured browser application that merchants use to manage their entire business. This is the respond.io-equivalent product â€” a unified inbox and commerce command centre.

## Key Modules

- **Unified Inbox** â€” All conversations across all channels in one view
- **Orders** â€” Pipeline, fulfilment status, history
- **Inventory** â€” Real-time stock, variants, supplier management
- **Customers** â€” CRM, profiles, purchase history, balance tracking
- **Analytics** â€” Revenue dashboards, demand forecasts, customer cohorts
- **Campaigns** â€” Re-engagement flows, promotions, automated sequences
- **Team** â€” User management, roles, activity log
- **Settings** â€” Channel connections, integrations, AI configuration

## Design Principles

- Mobile-first responsive (merchants use phones)
- Offline-capable for core views
- Low data mode for 3G markets
- English + Pidgin UI copy option

## Status

`[ ] Not started â€” placeholder`



=== C:\Users\USER\Documents\Biblio\ace-platform\docs\api\README.md ===


# API Documentation

> **ACE Platform â€” Phase 2 Public API**

## Planned Contents

- `openapi.yaml` â€” Full OpenAPI 3.x spec for the public API
- `authentication.md` â€” Auth guide (JWT + API keys)
- `webhooks.md` â€” Webhook events catalogue
- `rate-limits.md` â€” Rate limiting and quota documentation
- `enterprise/` â€” Enterprise data product API reference

## Status

`[ ] Not started â€” placeholder`



=== C:\Users\USER\Documents\Biblio\ace-platform\infra\README.md ===


# Infrastructure (Platform)

> **ACE Platform â€” Phase 2**

```
infra/
â”œâ”€â”€ docker/            # Dockerfiles per service
â”œâ”€â”€ kubernetes/        # K8s manifests and Helm charts
â”œâ”€â”€ ci-cd/             # CI/CD pipeline definitions
â””â”€â”€ environments/
    â”œâ”€â”€ dev/
    â”œâ”€â”€ staging/
    â””â”€â”€ prod/
```

## Status

`[ ] Not started â€” placeholder`



=== C:\Users\USER\Documents\Biblio\ace-platform\services\analytics\README.md ===


# Analytics Service

> **ACE Platform â€” Phase 2 Microservice**

## Responsibility

Business intelligence, forecasting, and performance measurement layer for merchants and the ACE data intelligence product.

## Key Capabilities

- Real-time revenue and order volume dashboards
- Demand forecasting per product / area / season
- Customer cohort analysis and LTV modelling
- Logistics performance and cost analysis
- AI engine confidence and accuracy monitoring
- Data quality signals for the intelligence product
- Exportable reports (CSV, PDF)

## Data Sources

- Inventory service (stock events)
- Payments service (transaction events)
- Logistics service (delivery events)
- CRM service (customer interaction events)
- AI Engine (intent classification events)

## Enterprise Feed

Aggregated and anonymised data signals are published to the `data-intelligence/` service for packaging and delivery to enterprise buyers.

## Status

`[ ] Not started â€” placeholder`



=== C:\Users\USER\Documents\Biblio\ace-platform\services\channels\README.md ===


# Channels Service

> **ACE Platform â€” Phase 2 Microservice**

## Responsibility

Multi-channel message ingestion and normalisation. Each supported channel has its own adapter that translates inbound messages into ACE's unified internal event format.

## Supported Channels

| Channel | Adapter | Status |
|---------|---------|--------|
| WhatsApp | Evolved from Phase 1 Gateway | `[ ] Placeholder` |
| Instagram DM | Instagram Business API | `[ ] Placeholder` |
| SMS | Africa's Talking / Twilio | `[ ] Placeholder` |
| Voice | IVR provider (TBD) | `[ ] Placeholder` |
| Web Widget | ACE-built embed | `[ ] Placeholder` |
| Email | TBD | `[ ] Placeholder` |

## Folder Structure

```
channels/
â”œâ”€â”€ whatsapp/
â”œâ”€â”€ instagram/
â”œâ”€â”€ sms/
â”œâ”€â”€ voice/
â””â”€â”€ web/
```

## Status

`[ ] Not started â€” placeholder`



=== C:\Users\USER\Documents\Biblio\ace-platform\services\crm\README.md ===


# CRM Service (Platform)

> **ACE Platform â€” Phase 2 Microservice**  
> Advanced CRM with campaign management and enterprise segmentation.

## Enhancements Over Phase 1

- Advanced segmentation (dynamic rules-based, ML-powered)
- Campaign management (sequences, A/B tests, scheduling)
- Cross-channel interaction history
- Customer scoring (engagement, LTV, churn risk)
- FMCG brand customer data (anonymised, aggregated) â†’ data intelligence pipeline
- Team notes and customer assignments

## Status

`[ ] Not started â€” placeholder`  
_Inherits and extends [ace-whatsapp/services/crm](../../ace-whatsapp/services/crm/)_



=== C:\Users\USER\Documents\Biblio\ace-platform\services\data-intelligence\README.md ===


# Data Intelligence Service (Platform)

> **ACE Platform â€” Phase 2 Microservice**

## Responsibility

The enterprise data product layer. Packages and delivers anonymised market intelligence derived from ACE's transaction processing to enterprise buyers via APIs and data feeds.

## Enterprise Buyer Segments

### AI Labs
- Raw and curated training datasets
- Primarily: non-Western, informal market, multi-dialect NLP data
- Pidgin, Yoruba, Hausa, Igbo transcribed conversations
- Delivery: API + bulk dataset downloads

### FMCG Brands
- Real-time consumer demand signals by product category and region
- Informal distribution channel mapping
- Price elasticity signals from negotiation data
- Delivery: Streaming API / dashboard

### Banks & Fintechs
- Alternative credit scoring based on transaction behaviour
- Cash flow reliability scores for unbanked merchants
- Delivery: Credit bureau-style API

## Compliance Requirements (Placeholder)

- [ ] NDPR (Nigeria Data Protection Regulation) compliance
- [ ] GDPR considerations for international buyers
- [ ] Anonymisation and differential privacy standards
- [ ] Enterprise data processing agreements

## Status

`[ ] Not started â€” placeholder`



=== C:\Users\USER\Documents\Biblio\ace-platform\services\inventory\README.md ===


# Inventory Service (Platform)

> **ACE Platform â€” Phase 2 Microservice**  
> Enhanced from Phase 1 â€” multi-location, variants, enterprise features.

## Enhancements Over Phase 1

- Multi-location / multi-warehouse stock management
- Product variant support (size, colour, weight, etc.)
- Batch and expiry tracking
- Advanced supplier management (multiple suppliers per product, lead time tracking)
- Purchase order management
- Stock movement audit trail

## Status

`[ ] Not started â€” placeholder`  
_Inherits and extends [ace-whatsapp/services/inventory](../../ace-whatsapp/services/inventory/)_



=== C:\Users\USER\Documents\Biblio\ace-platform\services\logistics\README.md ===


# Logistics Service (Platform)

> **ACE Platform â€” Phase 2 Microservice**  
> Extended from Phase 1 â€” fulfilment networks, intercity, and returns.

## Enhancements Over Phase 1

- Multi-carrier intelligent routing (cheapest / fastest / most reliable)
- Intercity and interstate delivery management
- Returns and refund logistics
- Bulk order fulfilment
- Delivery SLA tracking and breach alerting
- Driver / agent performance ratings

## Status

`[ ] Not started â€” placeholder`  
_Inherits and extends [ace-whatsapp/services/logistics](../../ace-whatsapp/services/logistics/)_



=== C:\Users\USER\Documents\Biblio\ace-platform\services\payments\README.md ===


# Payments Service (Platform)

> **ACE Platform â€” Phase 2 Microservice**  
> Expanded from Phase 1 â€” additional payment rails and international support.

## Enhancements Over Phase 1

- Card payments integration (Paystack, Flutterwave)
- Mobile money (M-Pesa, MTN MoMo)
- USSD payment triggering
- Multi-currency support (NGN, GHS, KES, ZAR)
- Invoice generation and management
- Automated payment reminders
- Escrow / payment protection for high-value orders

## Status

`[ ] Not started â€” placeholder`  
_Inherits and extends [ace-whatsapp/services/payments](../../ace-whatsapp/services/payments/)_



=== C:\Users\USER\Documents\Biblio\ace-whatsapp\README.md ===


# ACE WhatsApp â€” Phase 1

> **The WhatsApp-native Autonomous Commerce Engine**  
> Timeline: May 18, 2026 â†’ October 31, 2026 (Demo-Ready in 5.5 months)

Phase 1 of ACE. Merchants do nothing new â€” they keep texting on WhatsApp. ACE operates entirely in the background as a fully autonomous commerce OS.

---

## Core Premise

- Merchants already live on WhatsApp, Instagram, Facebook Messenger, and Email. We don't change that.
- Customers experience zero friction â€” they never download anything (Phase 1).
- ACE intercepts, interprets, and **executes** commerce operations autonomously.
- **Omni-Channel Shared Inbox**: The entire team manages all customer interactions from one unified interface.
- **Contact Merge**: If the same customer messages you on WhatsApp in the morning and emails you in the afternoon, the platform recognizes it's the same person and merges their profiles into a single thread to avoid duplicate tickets.
- The merchant's only job: **exception management**.

---

## What ACE WhatsApp Automates (The Four Autonomous Workflows)

| Workflow | What Happens |
|----------|-------------|
| **Order Fulfillment** | Customer texts â†’ AI parses intent â†’ payment virtual account issued â†’ logistics booked â†’ merchant notified. Zero merchant input. |
| **Demand-Driven Restocking** | Stock oracle detects impending stockout â†’ pings supplier â†’ negotiates price â†’ drafts PO â†’ merchant approves with one tap (8 seconds). |
| **Customer Retention & Shared Inbox** | Contact Merge unifies Instagram/WhatsApp/Email identities. Nightly analysis detects at-risk VIPs â†’ AI auto-sends a culturally nuanced re-engagement message to their preferred channel. |
| **Multimodal Visual Resolution** | "That blue dress in your last reel" â†’ AI scrapes merchant's IG â†’ CLIP embeddings match product â†’ SKU resolved â†’ price negotiated autonomously. |

---

## Application Structure

```
ace-whatsapp/
â”‚
â”œâ”€â”€ apps/
â”‚   â”œâ”€â”€ merchant-app/          # React Native (Expo) â€” exception dashboard
â”‚   â”œâ”€â”€ customer-pwa/          # Progressive Web App â€” embedded in WhatsApp browser
â”‚   â””â”€â”€ admin-portal/          # Internal ACE ops dashboard
â”‚
â”œâ”€â”€ core/                      # THE AUTONOMOUS STATE ENGINE (Rust microservices)
â”‚   â”œâ”€â”€ ingestion-service/     # Webhook ingestion (Rust + Actix-web)
â”‚   â”œâ”€â”€ identity-resolution/   # Global Buyer ID engine (Rust)
â”‚   â”œâ”€â”€ state-machine/         # Deterministic state orchestrator (Rust)
â”‚   â”œâ”€â”€ payment-verification/  # Banking API + virtual accounts (Rust)
â”‚   â”œâ”€â”€ logistics-coordination/# Rider dispatch + tracking (Rust)
â”‚   â”œâ”€â”€ supplier-integration/  # Autonomous reorder comms (Rust)
â”‚   â”œâ”€â”€ visual-context/        # IG/social multimodal RAG (Rust + Python)
â”‚   â””â”€â”€ comms-router/          # Out-of-band SMS/voice fallback (Rust)
â”‚
â”œâ”€â”€ ai/                        # PYTHON AI/ML SERVICES
â”‚   â”œâ”€â”€ intent-parser/         # NLP pipeline: Whisper â†’ BERT â†’ GPT-4o (Python + FastAPI)
â”‚   â””â”€â”€ data-refinement/       # Anonymization + enterprise data pipeline (Python + Airflow)
â”‚
â”œâ”€â”€ infra/
â”‚   â”œâ”€â”€ docker/
â”‚   â”œâ”€â”€ ci-cd/
â”‚   â””â”€â”€ environments/          # dev / staging / prod
â”‚
â””â”€â”€ docs/
    â”œâ”€â”€ api/                   # Service contracts + OpenAPI specs
    â”œâ”€â”€ flows/                 # Data flow diagrams (4 core workflows)
    â””â”€â”€ decisions/             # Architecture Decision Records (ADRs)
```

---

## Technology Stack

### The Autonomous State Engine â€” Rust
| Framework | Purpose |
|-----------|---------|
| `actix-web` | HTTP/webhook ingestion (proven at Discord scale) |
| `tokio` | Async runtime for massive concurrent I/O |
| `sqlx` | Compile-time verified database queries |
| `tonic` | Internal gRPC microservice communication |

### The AI/ML Layer â€” Python
| Tool | Purpose |
|------|---------|
| `FastAPI` | Intent parser service API |
| `Whisper` (local) | Voice note speech-to-text transcription |
| Regional dialect BERT | Slang normalization (Pidgin, Yoruba, Hausa, Igbo) |
| `GPT-4o` | Intent extraction â†’ structured JSON output |
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
| **PostgreSQL** | Primary transactional DB â€” ACID for financial ledger, partitioned by `merchant_id` |
| **Qdrant** (Rust-native) | Vector DB â€” conversation embeddings, 6-month context recall |
| **Redis** | Real-time state cache, rate limiting, distributed locks |
| **Apache Kafka** | Immutable event log, service decoupling, event replay |
| **ClickHouse** | Data warehouse â€” enterprise analytics, FMCG demand dashboards |

---

## The Customer: Progressive Decoupling Strategy

| Phase | Timeline | Experience |
|-------|----------|------------|
| **WhatsApp Funnel** | Months 1â€“6 | Pure WhatsApp. Zero download friction. |
| **PWA Trojan Horse** | Months 3â€“12 | AI drops PWA link for complex interactions. Opens in WA browser. Transaction now on ACE servers. |
| **Global Buyer ID** | Months 6â€“18 | After first PWA checkout â†’ phone number â†’ cross-merchant 1-tap checkout. |
| **Native App Graduation** | Months 12+ | After 3+ purchases, PWA prompts home screen install. |

---

## Critical Design Constraints

### 1. WhatsApp API Cost â€” Message Compression
> Risk: At 5 messages/order Ã— 80 orders/month Ã— $0.01 = $4/merchant in Meta costs vs $14 subscription  
> Fix: Message Consolidation Engine (Rust). Target: **2.3 messages/completed order**. 78% of conversations in free 24hr service window.

### 2. Disintermediation â€” Structural Lock-in
> Risk: Merchant and customer exchange phone numbers, bypass ACE after first transaction.  
> Fix: Four structural bottlenecks â€” (1) Aggregate logistics pricing (â‚¦600 â†’ â‚¦350/delivery), (2) Micro-escrow trust signal, (3) Exclusive supplier network discounts, (4) Global Buyer ID 1-tap checkout network. **Cost of leaving ACE: â‚¦110K/month. Cost of staying: â‚¦12K/month.**

### 3. Pricing â€” Prompt Injection & Haggling
> Risk: LLM with direct DB write access gets jailbroken. Customer learns AI's pricing floor.  
> Fix: LLM cannot touch pricing DB directly. Hardened `PricingService` (Rust) enforces merchant-set floors per customer tier. Circuit breaker triggers on floor breach â†’ escalates to merchant.

---

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the full technical design.



=== C:\Users\USER\Documents\Biblio\ace-whatsapp\ai\data-refinement\README.md ===


# Data Refinement Pipeline

> **ACE WhatsApp â€” AI Microservice #10**  
> Stack: **Python + Apache Airflow**  
> Role: Transforms raw transactional data into the enterprise intelligence product

## Responsibility

The bridge between ACE's primary product (merchant automation) and the secondary business (enterprise data sales). Cleans, anonymises, verifies, and packages conversational commerce data into structured assets for AI labs, FMCGs, and banks.

## The Pipeline

```
[Raw conversational data]
          â”‚
          â–¼
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚  Stage 1: PII Scrubber          â”‚
â”‚  NER model for redaction:       â”‚
â”‚  - Phone numbers â†’ [PHONE]      â”‚
â”‚  - Names â†’ [NAME]               â”‚
â”‚  - Addresses â†’ [ADDRESS]        â”‚
â”‚  - Bank details â†’ [BANK_REF]    â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                 â”‚
                 â–¼
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚  Stage 2: Initial Transcription â”‚
â”‚  Whisper transcription          â”‚
â”‚  Dialect tag assignment         â”‚
â”‚  Intent tag from parser         â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                 â”‚
                 â–¼
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚  Stage 3: HITL Verification     â”‚
â”‚  Human reviewer queue           â”‚
â”‚  (university students /         â”‚
â”‚   remote micro-taskers)         â”‚
â”‚  Corrects transcription errors  â”‚
â”‚  Validates dialect tags         â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                 â”‚
                 â–¼
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚  Stage 4: Enterprise Packaging  â”‚
â”‚  - Dataset compilation          â”‚
â”‚  - Quality scoring              â”‚
â”‚  - Synthetic data generation    â”‚
â”‚  - Federated learning prep      â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                 â”‚
                 â–¼
[Enterprise Data Assets]
  â”œâ”€â”€ AI Lab datasets (transcripts + audio + metadata)
  â”œâ”€â”€ FMCG demand signal feeds
  â””â”€â”€ Credit scoring behavioral signals
```

## Enterprise Data Products Generated

| Output | Buyer | Format |
|--------|-------|--------|
| Dialect-rich conversational transcripts | AI labs | Annotated JSON + audio pairs |
| RLHF evaluation sets | AI labs | Preference pairs, golden datasets |
| Demand velocity signals | FMCGs | Aggregated, real-time API feed |
| Credit behavioral signals | Banks/fintechs | Score-ready behavioral features |

## Federated Learning Coordination
- AI labs don't receive raw data â€” they rent compute on ACE infrastructure
- Their models are sent to ACE servers, trained locally on ring-fenced data
- Only model weights are extracted and returned
- Full data sovereignty maintained; NDPR-compliant

## Quality Standards
- Transcript confidence â‰¥ 0.92 before entering enterprise pipeline
- HITL verification required for all voice note transcriptions
- PII scrub audit log retained (compliance)
- Synthetic data generation to augment sparse categories

## Status

`[ ] Not started â€” placeholder`



=== C:\Users\USER\Documents\Biblio\ace-whatsapp\ai\intent-parser\README.md ===


# Intent Parser Service

> **ACE WhatsApp â€” AI Microservice #3**  
> Stack: **TypeScript + Vercel AI SDK + FastAPI (Python) for heavy models**  
> Role: Multi-model NLP pipeline â€” the agent layer of ACE

---

## Architecture Overview

The intent parser is split into two layers:

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚  AGENT LAYER â€” TypeScript + Vercel AI SDK                       â”‚
â”‚                                                                 â”‚
â”‚  - Orchestrates the full conversation flow                      â”‚
â”‚  - Tool calling â†’ Rust backend services (via gRPC/REST)         â”‚
â”‚  - Structured output (generateObject) for typed intent          â”‚
â”‚  - Streaming responses to WhatsApp Gateway                      â”‚
â”‚  - Interaction logging middleware â†’ training pipeline           â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                             â”‚ (delegates to for heavy inference)
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â–¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚  INFERENCE LAYER â€” Python FastAPI                               â”‚
â”‚                                                                 â”‚
â”‚  - Local Whisper (voice â†’ text, dialect-aware)                  â”‚
â”‚  - Regional dialect BERT (slang normalisation)                  â”‚
â”‚  - Custom fine-tuned models (trained on ACE data)               â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

---

## Vercel AI SDK Integration

### Why Vercel AI SDK

- **Provider-agnostic**: swap between OpenAI, Anthropic, Google, Mistral without rewriting agent logic
- **`generateObject`**: returns *typed, validated* structured output â€” critical for reliable intent extraction
- **Tool calling / multi-step**: the agent can call Rust backend services as tools within a single reasoning step
- **Streaming**: real-time response streaming back to WhatsApp Gateway
- **Middleware hooks**: every interaction is interceptable for training data collection
- **Edge-compatible**: can run on Vercel Edge or standard Node.js

---

## The Agent's Tool Set

The AI agent **never writes directly to any database**. It calls Rust services as tools. The Rust State Machine validates before any state change occurs.

```typescript
// Tool definitions â€” what the AI can "do"
const aceTools = {

  checkInventory: tool({
    description: 'Check current stock for a product SKU',
    parameters: z.object({ sku: z.string(), merchantId: z.string() }),
    execute: async ({ sku, merchantId }) => {
      // â†’ calls Rust inventory service via REST/gRPC
    }
  }),

  getCustomerProfile: tool({
    description: 'Get customer history, LTV, and tier for personalisation',
    parameters: z.object({ globalBuyerId: z.string() }),
    execute: async ({ globalBuyerId }) => {
      // â†’ calls Identity Resolution service
    }
  }),

  getAuthorizedPriceRange: tool({
    description: 'Get the merchant-configured price floor and ceiling for a SKU and customer tier',
    parameters: z.object({ sku: z.string(), customerTier: z.enum(['new','returning','vip']), merchantId: z.string() }),
    execute: async (params) => {
      // â†’ calls Rust Pricing service (hardened â€” floor/ceiling set by merchant, not AI)
    }
  }),

  proposeOrderToStateMachine: tool({
    description: 'Submit a proposed order for validation and execution',
    parameters: z.object({ /* order shape */ }),
    execute: async (order) => {
      // â†’ calls Rust State Machine â€” it validates, AI cannot force execution
    }
  }),

  resolveVisualProductReference: tool({
    description: 'Resolve a social media product reference to a SKU',
    parameters: z.object({ reference: z.string(), merchantId: z.string() }),
    execute: async (params) => {
      // â†’ calls Visual Context Resolution service
    }
  }),

  logInteractionForTraining: tool({
    description: 'Internal â€” logs this interaction to the training pipeline',
    parameters: z.object({ /* interaction schema */ }),
    execute: async (interaction) => {
      // â†’ writes to Kafka training.interactions topic
    }
  }),
}
```

---

## Structured Intent Extraction

`generateObject` ensures the AI always returns a typed, validated intent â€” never freeform text that downstream Rust services have to parse.

```typescript
const { object: intent } = await generateObject({
  model: openai('gpt-4o'),
  schema: z.object({
    intent: z.enum([
      'purchase', 'payment_proof', 'delivery_enquiry',
      'stock_enquiry', 'complaint', 'negotiation', 'reorder', 'unknown'
    ]),
    entities: z.object({
      productReference: z.string().optional(),
      productReferenceType: z.enum(['explicit', 'social_media_post', 'deictic']).optional(),
      quantity: z.number().optional(),
      requestedPrice: z.number().optional(),
    }),
    dialect: z.enum(['english', 'pidgin', 'yoruba', 'hausa', 'igbo', 'code_switch']),
    sentiment: z.enum(['positive', 'neutral', 'negative']),
    confidence: z.number().min(0).max(1),
    requiresVisualResolution: z.boolean(),
    escalateToMerchant: z.boolean(),
  }),
  prompt: buildIntentPrompt(normalisedMessage, merchantContext, customerHistory),
})
```

---

## Conversation Flow (Multi-Step Tool Use)

```typescript
const result = await generateText({
  model: openai('gpt-4o'),
  tools: aceTools,
  maxSteps: 5,  // max tool calls before forcing a response
  system: buildMerchantSystemPrompt(merchant),
  messages: conversationHistory,
})
// Each step is logged via middleware â†’ training pipeline
```

**Typical steps for a purchase flow:**
1. `getCustomerProfile(globalBuyerId)` â€” personalise response
2. `resolveVisualProductReference(ref)` â€” if deictic reference detected
3. `checkInventory(sku)` â€” confirm stock before committing
4. `getAuthorizedPriceRange(sku, tier)` â€” get negotiation bounds
5. `proposeOrderToStateMachine(order)` â€” submit for Rust validation

---

## Middleware: Training Data Collection

Every interaction is captured via SDK middleware before it reaches the agent and after it completes.

```typescript
import { wrapLanguageModel, extractReasoningMiddleware } from 'ai'

const trackedModel = wrapLanguageModel({
  model: openai('gpt-4o'),
  middleware: aceTrainingMiddleware,  // see /ai/training-pipeline/
})
```

See [training-pipeline/README.md](../training-pipeline/README.md) for the full data collection architecture.

---

## Model Provider Strategy

ACE uses the Vercel AI SDK's provider abstraction to stay flexible:

| Provider | Use Case | When |
|----------|---------|------|
| `openai('gpt-4o')` | Primary intent extraction and response generation | Phase 1 |
| `anthropic('claude-sonnet-*')` | Fallback / A/B testing | Phase 1 |
| `openai('gpt-4o-mini')` | Low-stakes, high-volume interactions (cart reminders) | Phase 1 (cost) |
| ACE fine-tuned model | Intent extraction on Nigerian dialects | Phase 2+ (post training) |
| Self-hosted (Ollama/vLLM) | Data-sovereign inference (training data never leaves ACE infra) | Phase 3 |

---

## Prompt Injection Hardening

- System prompt is built from **merchant-controlled structured config** â€” not user input
- Customer messages are injected as `user` role only â€” never `system` or `assistant`
- All tool executions pass through Rust validation â€” AI cannot override hard rules
- Injection attempt detection: patterns like "ignore all previous instructions" â†’ intent classified as `unknown`, logged as `injection_attempt`, escalated

## Status

`[ ] Not started â€” placeholder`



=== C:\Users\USER\Documents\Biblio\ace-whatsapp\ai\training-pipeline\README.md ===


# Training Pipeline

> **ACE WhatsApp â€” AI Training Infrastructure**  
> Stack: **TypeScript (Vercel AI SDK middleware) + Python (Airflow) + HITL tooling**  
> Role: Continuously improve ACE's models using ACE's own interaction data

---

## The Core Loop

ACE's models get better the more merchants use the platform. Every conversation is a training signal. Every merchant correction teaches the AI what it got wrong. This is the flywheel that compounds into a durable moat.

```
[Live Interactions]
      â”‚
      â–¼ (Vercel AI SDK middleware captures every step)
[Raw Interaction Log]  â†’  Kafka: training.interactions
      â”‚
      â–¼
[Auto-Quality Filter]  â†’  removes low-confidence, duplicate, trivial events
      â”‚
      â–¼
[PII Scrubber]  â†’  phone numbers, names, addresses redacted / tokenised
      â”‚
      â”œâ”€â”€â†’ [Auto-Labelled Queue]    confidence > 0.95 â†’ used directly
      â”‚
      â””â”€â”€â†’ [HITL Queue]             confidence 0.70â€“0.95 â†’ human review
                  â”‚
                  â–¼
         [Verified Dataset Store]   (PostgreSQL + S3 cold storage)
                  â”‚
          â”Œâ”€â”€â”€â”€â”€â”€â”€â”´â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
          â–¼                  â–¼
  [Model Fine-tuning]  [Enterprise Data Products]
  (ACE internal)       (sold to AI labs, FMCGs, banks)
```

---

## Stage 1: Interaction Capture (Vercel AI SDK Middleware)

Every call to the Vercel AI SDK is wrapped with `aceTrainingMiddleware`. This captures the full interaction trace â€” inputs, tool calls, outputs, and final merchant/customer outcome.

### What Gets Captured Per Interaction

```typescript
interface TrainingInteraction {
  // Identity (anonymised)
  merchantId: string            // hashed merchant ref
  sessionId: string             // conversation session UUID
  globalBuyerIdHash: string     // hashed customer ref

  // Input
  rawMessage: string            // original customer message (pre-PII scrub)
  dialect: Dialect              // detected language/dialect
  hasAudio: boolean             // was this a voice note?
  audioTranscript?: string      // Whisper output (pre-PII scrub)

  // AI reasoning trace
  modelUsed: string             // e.g. 'gpt-4o-2024-...'
  toolCallSequence: ToolCall[]  // ordered list of tools called + responses
  intentClassified: Intent      // structured intent object from generateObject
  responseGenerated: string     // final message sent to customer

  // Outcome signals (filled in asynchronously)
  customerEngaged: boolean      // did customer reply positively?
  orderCompleted: boolean       // did an order result from this?
  merchantCorrected: boolean    // did merchant override the AI's action?
  merchantCorrectionDetails?: string  // what the merchant changed

  // Quality signals
  aiConfidence: number          // 0â€“1 from generateObject
  latencyMs: number             // time to first token
  tokensUsed: number            // for cost tracking

  // Timestamps
  capturedAt: string            // ISO 8601
}
```

### Middleware Implementation (Vercel AI SDK)

```typescript
// ace-whatsapp/ai/intent-parser/src/middleware/training.ts

import { wrapLanguageModel } from 'ai'
import type { LanguageModelV1Middleware } from 'ai'

export const aceTrainingMiddleware: LanguageModelV1Middleware = {
  wrapGenerate: async ({ doGenerate, params }) => {
    const startTime = Date.now()
    const result = await doGenerate()

    // Publish raw interaction to Kafka
    await kafkaProducer.send({
      topic: 'training.interactions.raw',
      messages: [{
        key: params.sessionId,
        value: JSON.stringify({
          params,
          result,
          latencyMs: Date.now() - startTime,
        })
      }]
    })

    return result
  },

  wrapStream: async ({ doStream, params }) => {
    // Streaming variant â€” captures after stream completes
    const { stream, ...rest } = await doStream()
    return { stream: captureStreamForTraining(stream, params), ...rest }
  },
}
```

---

## Stage 2: Auto-Quality Filtering (Rust)

Kafka consumer that reads `training.interactions.raw` and routes each event:

| Condition | Route |
|-----------|-------|
| `aiConfidence >= 0.95` AND `orderCompleted = true` | â†’ `training.interactions.verified` (auto-labelled gold) |
| `aiConfidence 0.70â€“0.95` | â†’ `training.interactions.hitl` (needs human review) |
| `merchantCorrected = true` | â†’ `training.interactions.corrections` (high-value signal) |
| `aiConfidence < 0.70` | â†’ `training.interactions.lowquality` (archived, not trained on) |
| Injection attempt detected | â†’ `training.interactions.adversarial` (separate analysis) |

---

## Stage 3: PII Scrubbing (Python)

Automated pipeline on all queues before any data leaves the raw store.

```python
# Entities detected and replaced by NER model:
PII_ENTITY_TYPES = [
    'PHONE_NUMBER',        # â†’ [PHONE]
    'PERSON_NAME',         # â†’ [NAME]
    'LOCATION_ADDRESS',    # â†’ [ADDRESS]
    'BANK_ACCOUNT',        # â†’ [BANK_ACCOUNT]
    'BANK_TRANSFER_REF',   # â†’ [TRANSFER_REF]
    'EMAIL_ADDRESS',       # â†’ [EMAIL]
]

# After scrubbing, original is deleted. Scrubbed version advances to next stage.
# Audit log: scrub timestamp, entity types found (not values), scrubber model version
```

---

## Stage 4: HITL Verification Queue

Human-in-the-loop review for interactions in the `0.70â€“0.95` confidence band and all merchant corrections.

### HITL Reviewer Interface (Internal Tool)

**Queue view** â€” reviewers see:
- Original customer message (PII-scrubbed)
- Dialect tag (to verify)
- AI's classified intent (to verify or correct)
- AI's response (to rate: correct / partially correct / wrong)
- Outcome: did the customer engage / complete purchase?

**Correction interface:**
```
Original: "Abeg I wan buy 2 of the ankara wey dey your page"
AI Intent: { intent: "purchase", product: "ankara fabric", qty: 2, dialect: "pidgin" }

Reviewer options:
  [âœ“ Correct]
  [Edit intent]  â†’  opens structured form
  [Wrong dialect]  â†’  dropdown to correct
  [Ambiguous â€” skip]
```

### HITL Workforce
- Phase 1: internal team + trusted beta merchants
- Phase 2: university student micro-taskers (Lagos, Ibadan, Abuja)
- Phase 3: dedicated annotation team with dialect specialist leads

### Quality Control for HITL
- Inter-annotator agreement threshold: â‰¥ 0.85 for dataset inclusion
- Gold standard test set: 500 pre-verified interactions injected into HITL queue to measure annotator accuracy
- Annotators scoring < 80% on gold set are removed from queue

---

## Stage 5: Merchant Correction Signals (Highest Value)

When a merchant overrides the AI (edits a response, rejects an auto-action), this is captured as the highest-quality training signal â€” **real-world preference data from the person who knows their business best**.

```typescript
interface MerchantCorrection {
  originalAiOutput: string       // what the AI did/said
  merchantOverride: string       // what the merchant replaced it with
  correctionType: 'response_edit' | 'action_rejected' | 'price_override' | 'intent_correction'
  context: ConversationContext   // full conversation history at point of correction
}
```

This data directly powers:
1. **Fine-tuning**: teaches the model merchant-specific preferences
2. **RLHF pairs**: AI output (rejected) vs merchant correction (preferred) = preference pair for RLHF
3. **Enterprise sale**: anonymised correction patterns â†’ AI lab training data

---

## Stage 6: Fine-Tuning Pipeline (Airflow DAGs)

```
DAG: ace_model_finetuning (runs weekly)

Task 1: collect_verified_interactions
  â†’ Query training.interactions.verified (last 7 days)
  â†’ Filter by quality score â‰¥ 0.90
  â†’ Export to S3 staging bucket

Task 2: format_for_finetuning
  â†’ Convert to OpenAI fine-tuning JSONL format:
    { "messages": [{"role": "system", ...}, {"role": "user", ...}, {"role": "assistant", ...}] }
  â†’ OR: preference pairs for RLHF fine-tuning

Task 3: run_finetuning_job
  â†’ Submit to OpenAI fine-tuning API (Phase 1â€“2)
  â†’ OR: submit to self-hosted training cluster (Phase 3)
  â†’ Monitor job completion

Task 4: evaluate_new_model
  â†’ Run on held-out evaluation set (1000 gold interactions per dialect)
  â†’ Compare: intent accuracy, dialect accuracy, tool call correctness
  â†’ Must beat baseline by â‰¥ 2% to proceed

Task 5: shadow_deployment
  â†’ Route 5% of live traffic to new model
  â†’ Monitor: merchant correction rate, order completion rate
  â†’ If correction rate â†‘ by > 1% â†’ rollback automatically

Task 6: full_deployment
  â†’ Update model pointer in Vercel AI SDK config
  â†’ Notify engineering Slack channel
```

---

## Stage 7: Model Evaluation Framework

### Evaluation Datasets (held-out, never trained on)

| Dataset | Size | Purpose |
|---------|------|---------|
| `eval-intent-en` | 500 interactions | Intent accuracy (English) |
| `eval-intent-pidgin` | 500 interactions | Intent accuracy (Nigerian Pidgin) |
| `eval-intent-yoruba` | 300 interactions | Intent accuracy (Yoruba-English code-switch) |
| `eval-intent-hausa` | 300 interactions | Intent accuracy (Hausa) |
| `eval-tool-calls` | 500 interactions | Correct tool call sequence |
| `eval-pricing` | 200 interactions | Correct pricing negotiation within bounds |
| `eval-adversarial` | 200 interactions | Resistance to prompt injection |

### Key Metrics

| Metric | Target (Phase 1) | Target (Phase 2) |
|--------|-----------------|-----------------|
| Intent classification accuracy | â‰¥ 88% | â‰¥ 94% |
| Dialect detection accuracy | â‰¥ 92% | â‰¥ 96% |
| Tool call correctness | â‰¥ 85% | â‰¥ 92% |
| Merchant correction rate | < 8% | < 4% |
| Prompt injection detection | â‰¥ 98% | â‰¥ 99.5% |

---

## Training Data Volumes (Projected)

| Timeline | Merchants | Monthly Interactions | Verified Training Samples (cumulative) |
|----------|-----------|---------------------|----------------------------------------|
| Month 3 | 50 | 60,000 | 15,000 |
| Month 6 | 200 | 240,000 | 90,000 |
| Month 12 | 800 | 960,000 | 480,000 |
| Year 2 | 3,000 | 3.6M | 2.4M |

At Year 2 scale: a **2.4M sample dialect-rich informal commerce dataset** â€” the kind of dataset AI labs pay $80K+ per vertical for.

## Status

`[ ] Not started â€” placeholder`



=== C:\Users\USER\Documents\Biblio\ace-whatsapp\apps\admin-portal\README.md ===


# Admin Portal

> **ACE WhatsApp â€” Phase 1**  
> Internal operations and monitoring dashboard for the ACE team.

## Responsibility

Used exclusively by ACE staff for merchant onboarding, system health monitoring, and operational oversight.

## Key Views

- **Merchant Management** â€” Onboarding, health scores, subscription status
- **AI Performance** â€” Intent accuracy, confidence distributions, error rates, escalation rates
- **System Health** â€” Service uptime, message queue depth, API integration status
- **Manual Interventions** â€” Log of cases where human support stepped in
- **Billing** â€” Subscription management, usage metrics, revenue dashboards

## Status

`[~] Foundation started (2026-06-19)` â€” Vite + React app wired to
`core/merchant-api`. Implemented: **Merchant Management** (look up a merchant,
view seller context + catalog, onboard, trigger WhatsApp catalog sync).

### Run
```bash
cd ace-whatsapp/apps/admin-portal
npm install
MERCHANT_API_URL=http://localhost:3004 npm run dev   # http://localhost:5173
```

> âš ï¸ Foundation, not yet runtime-verified (needs its own `npm install`). Kept out
> of the backend `tsconfig`. Remaining per the spec above: AI Performance, System
> Health, Manual Interventions, Billing â€” these read from the Phase-2 analytics
> service + queue metrics.



=== C:\Users\USER\Documents\Biblio\ace-whatsapp\apps\customer-pwa\README.md ===


# Customer PWA

> **ACE WhatsApp â€” Phase 1**  
> Stack: **Progressive Web App**  
> Delivery: Embedded link sent via WhatsApp, opens in in-app browser

## The Trojan Horse Strategy

Customers interact purely via WhatsApp in Phase 1. For complex interactions (browsing a 50-item catalog, customising orders, managing a checkout), ACE's AI sends a PWA link. It opens **inside WhatsApp's built-in browser** â€” feels native, loads instantly.

**Critical transition point:** The transaction now happens on ACE's servers, not Meta's ecosystem. This is where the Global Buyer ID is created and the network effect begins.

## Core Views

### Product Detail
- Product images, size/variant selectors
- Pre-filled customer details from Global Buyer ID (returning customers)
- Real-time stock availability

### Checkout
- Order summary with applied discounts (from AI negotiation)
- Payment options:
  - Bank transfer to dynamic virtual account
  - Card (Paystack)
  - Pay-on-delivery (where merchant-enabled)
- Delivery address confirmation

### Order Tracking
- Real-time rider tracking (Kwik/Gokada/MAX integration)
- Live ETA updates

### Order History (Phase 1.5+)
- Across all ACE merchants the customer has bought from
- Re-order with one tap

## Global Buyer ID Flow

```
First purchase (any ACE merchant):
  Customer fills checkout form (2 minutes)
  â†’ Global Buyer ID created (phone number â†’ profile)
  
All subsequent purchases (any ACE merchant):
  Form auto-filled â†’ "Confirm" button appears immediately (8 seconds)
```

## Design Constraints
- Must load fast on 3G (< 3s First Contentful Paint)
- Offline-capable for order tracking view
- Touch targets sized for phone-only users
- English + Pidgin UI copy

## Status

`[ ] Not started â€” placeholder`



=== C:\Users\USER\Documents\Biblio\ace-whatsapp\apps\merchant-app\README.md ===


# Merchant App

> **ACE WhatsApp â€” Phase 1**  
> Stack: **React Native + Expo**  
> Platform: iOS + Android

## Why React Native + Expo

- Merchants are mobile-first: 97% of target users never touch a laptop
- Cross-platform from single codebase (iOS + Android)
- Expo OTA updates bypass app store approval for rapid iteration
- Native performance for real-time chat rendering

## Design Philosophy

**The merchant's dashboard should be empty most of the time.** ACE handles 94%+ of interactions autonomously. This app surfaces only the 6% requiring human judgment.

## Core Screens

### 1. Command Center (Home)
- Live order velocity meter (orders/hour)
- Cash flow river (money in vs. out, real-time)
- AI-generated daily briefing: _"3 VIP customers haven't ordered in 2 weeks. Tap to see drafts."_
- Exception queue: _"2 payments need manual verification. 1 supplier awaiting approval."_

### 2. Conversation Hub
- Unified timeline of all customer interactions
- Each thread shows: Customer LTV Â· Order history Â· AI confidence score Â· Autonomous actions taken
- Only the exceptions bubble up

### 3. Inventory Oracle
- Auto-updating stock levels based on sales velocity
- Predictive restocking alerts: _"Run out of Blue Ankara in 4 days. Pre-negotiated restock ready. Approve?"_

### 4. Financial Dashboard
- Real-time reconciliation of all payment channels
- Outstanding receivables with AI-drafted follow-up messages
- Margin analysis per product (live)

### 5. Autonomous Settings
- Define autonomy boundaries: _"Auto-approve purchases under â‚¦50K. Auto-apply loyalty discounts up to 8%."_
- Connect bank accounts, payment processors, logistics partners
- Regional dialect calibration (Pidgin / Yoruba / Hausa / Igbo)

## Status

`[~] Foundation started (2026-06-19)` â€” Expo + expo-router app wired to
`core/merchant-api`. Implemented screens: **Command Center** (`app/index.tsx`),
**Catalog + WhatsApp sync** (`app/catalog.tsx`), **Seller Voice & Settings**
(`app/settings.tsx`). Typed API client in `src/api/client.ts`.

### Run
```bash
cd ace-whatsapp/apps/merchant-app
npm install
npm run start          # Expo dev server (press i / a for iOS / Android)
```
Point it at a running `merchant-api` via `app.json â†’ expo.extra.merchantApiBaseUrl`
(default `http://localhost:3004`).

> âš ï¸ This is a foundation, not yet runtime-verified end-to-end (needs `npm install`
> of the Expo toolchain + a device/simulator). It is intentionally kept out of the
> backend `tsconfig`. Remaining per the spec above: Conversation Hub, Financial
> Dashboard, full Autonomous Settings, auth/session (currently a hardcoded demo
> `MERCHANT_ID`).



=== C:\Users\USER\Documents\Biblio\ace-whatsapp\core\ai-negotiator\README.md ===


# AI Negotiator

> **ACE WhatsApp â€” Core Microservice #11**  
> Stack: **Rust (rules engine) + TypeScript/Vercel AI SDK (negotiation agent)**  
> Role: Autonomous price negotiation and deal-closing â€” the AI market trader

---

## What This Is

The AI Negotiator is the single most differentiated component in ACE. It is not a discount engine. It is not a pricing lookup service. It is a **fully autonomous negotiation agent** that behaves like a skilled, relationship-aware market trader operating on behalf of the merchant.

Where generic AI tools either fix a price or blindly accept any offer, ACE's Negotiator:
- Reads the customer's **full relationship history** before every negotiation
- Opens with the right position based on who it's talking to
- Uses culturally appropriate language and pressure tactics
- Counters, pivots, bundles, and creates urgency autonomously
- Knows exactly where its floor is and never crosses it
- **Closes the deal** â€” it doesn't just respond, it drives toward a transaction

---

## The Two-Layer Architecture

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚  NEGOTIATION AGENT LAYER â€” TypeScript + Vercel AI SDK           â”‚
â”‚                                                                 â”‚
â”‚  - Generates culturally-nuanced negotiation dialogue            â”‚
â”‚  - Multi-turn conversation management (knows where we are       â”‚
â”‚    in the negotiation arc)                                      â”‚
â”‚  - Bundle construction and upsell suggestion                    â”‚
â”‚  - Urgency and scarcity signals (when inventory warrants it)    â”‚
â”‚  - Reads customer sentiment in real-time to adapt tone          â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                          â”‚ calls â€” never overrides
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â–¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚  RULES ENGINE LAYER â€” Rust (PricingService)                     â”‚
â”‚                                                                 â”‚
â”‚  - AuthorizedPriceRange computed from merchant rules            â”‚
â”‚  - Circuit breaker: below floor â†’ AI CANNOT proceed            â”‚
â”‚  - All final prices written only by Rust â€” never by LLM        â”‚
â”‚  - Injection detection: adversarial patterns flagged + logged   â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

---

## The Negotiation Arc

Every negotiation follows a structured arc. The AI Negotiator manages position across the full arc within a single conversation thread, even across multiple messages over hours.

```
Stage 1: ANCHOR
  AI opens with full price (or recommended price for VIPs).
  Never opens below recommended â€” anchors high.

Stage 2: ACKNOWLEDGE
  Customer makes counter-offer or objects to price.
  AI acknowledges the relationship/context before responding.
  "Because you've been ordering for 8 months..." / "I understand..."

Stage 3: COUNTER
  AI makes a calculated counter-offer within authorized range.
  Never jumps to floor immediately â€” reserves room for next counter.
  Uses bundle, urgency, or scarcity to shift value instead of price.

Stage 4: CLOSE / PIVOT / ESCALATE
  â”œâ”€ Customer accepts â†’ CLOSE (moves to checkout immediately)
  â”œâ”€ Customer below floor â†’ PIVOT (bundle offer, payment plan, future credit)
  â””â”€ Customer firm below floor, high LTV â†’ ESCALATE (merchant communiquÃ©)
```

---

## Negotiation Tactics Available to the AI

The AI has a defined playbook of tactics it can deploy autonomously, within merchant-approved boundaries:

### Tactic 1: The Relationship Anchor
Uses purchase history to justify price and justify value â€” not discount.
```
"You've spent â‚¦87,000 with us. You know our quality is top. 
 This gown is worth every kobo of â‚¦28,500."
```

### Tactic 2: The Bundle Pivot
When customer pushes below floor, AI pivots to a bundle instead of a lower price.
```
Customer: "â‚¦13,000 for the dress"
Floor: â‚¦14,250 (minimum)
AI: "â‚¦13K is a bit low for just the dress. But what if I do the dress + the matching 
     head wrap for â‚¦16,500? You're getting more for less per piece."
```

### Tactic 3: Scarcity Signal (Inventory-Verified)
Only deployed when inventory is genuinely low â€” prevents manipulation.
```
"I only have 2 of this size left. At â‚¦18,500 they won't last â€” the last batch 
 sold out in 3 days. I can hold one for you until tomorrow morning."
```
> âš ï¸ Inventory oracle must confirm stock â‰¤ 3 units before this tactic fires. Never fabricated.

### Tactic 4: The Future Credit Offer
Closes the deal now with a forward incentive â€” no immediate margin loss.
```
"Best I can do today is â‚¦16,500. But I'll give you â‚¦1,000 credit on 
 your next order for being loyal. Deal?"
```

### Tactic 5: The Urgency Window
Time-limits the offer to close faster â€” real countdown, not fake.
```
"I can hold the â‚¦16,000 price until 6pm today. After that it goes back to â‚¦18,500."
```

### Tactic 6: The Socially Aware Soft Close
Reads sentiment score. If customer seems hesitant (not price-sensitive), closes with warmth.
```
"No pressure at all o. If you want more time to think, I can hold it for you 
 until tomorrow. Just let me know."
```
> This prevents losing a customer by pushing too hard when price isn't actually the blocker.

---

## The Circuit Breaker (Hardened Rust Rules)

When customer pushes **below the pricing floor**, the Negotiation Agent Layer is **cut off** from closing the deal. It cannot proceed. The Rust Rules Engine enforces this hard stop.

```rust
enum NegotiationOutcome {
    Closed { final_price: f64 },          // Deal done â†’ State Machine
    BelowFloor {
        merchant_escalation: bool,         // â†’ Vendor CommuniquÃ© via SMS
        bundle_pivot_attempted: bool,      // Did we try the bundle first?
        future_credit_attempted: bool,     // Did we try future credit?
        customer_final_offer: f64,         // What they want to pay
    },
    CustomerAbandoned,                     // Customer stopped responding
    PricingInjectionDetected,             // Adversarial input logged
}
```

**On `BelowFloor`:**
1. AI first attempts Bundle Pivot (Tactic 2)
2. If still below floor â†’ AI attempts Future Credit (Tactic 4)
3. If still below floor â†’ triggers **Vendor CommuniquÃ©** to merchant (SMS)
   - Merchant gets: "Customer Amaka wants the dress at â‚¦12K. Your floor is â‚¦14,250. Reply 1 to approve special exception, 2 to hold firm, 3 to offer bundle."

---

## Customer Tier Ã— Negotiation Authority

Merchant configures these once. AI executes within them forever.

| Customer Tier | Max Discount | Max Bundle Value Add | Future Credit Cap |
|--------------|-------------|---------------------|-------------------|
| New (< 1 order) | 5% | 0% (no bundles for unknowns) | None |
| Returning (2â€“5 orders) | 15% | 10% additional value | â‚¦1,000 max |
| Loyal (6â€“20 orders) | 22% | 20% additional value | â‚¦2,500 max |
| VIP (21+ orders or LTV > â‚¦100K) | 30% | 30% additional value | â‚¦5,000 max |

---

## Negotiation Data Collection

Every negotiation is a training signal AND a sellable enterprise data asset:

```typescript
interface NegotiationTrace {
  sessionId: string
  merchantId: string  // hashed
  customerId: string  // hashed
  customerTier: CustomerTier
  
  // Opening position
  anchorPrice: number
  authorizedFloor: number
  
  // The arc
  turns: NegotiationTurn[]  // each message pair: customer offer + AI counter
  
  // Outcome
  outcome: 'closed' | 'below_floor_escalated' | 'bundle_closed' | 'abandoned'
  finalPrice?: number
  finalMargin?: number
  tacticsDeployed: NegotiationTactic[]
  tacticsSucceeded: NegotiationTactic[]
  
  // Enterprise value
  priceElasticitySignal: number  // customer's final offer / base price
  dialect: Dialect
}
```

**What this data tells enterprise buyers:**
- **FMCG brands**: exact price elasticity at SKU level, per geography, per customer segment
- **AI labs**: real-world negotiation dialogue in dialect (extremely rare training data)
- **Banks**: credit signal â€” customers who abandon at X% are different credit risk profiles

---

## Negotiation Quality Metrics

| Metric | Phase 1 Target | Phase 2 Target |
|--------|---------------|---------------|
| Deals closed within authorized range | â‰¥ 72% | â‰¥ 82% |
| Bundle pivot success rate | â‰¥ 35% of below-floor attempts | â‰¥ 50% |
| Merchant escalations per 100 negotiations | â‰¤ 8 | â‰¤ 4 |
| Average margin achieved vs. floor | +7% above floor | +12% above floor |
| Injection attempt detection rate | â‰¥ 99% | â‰¥ 99.9% |

## Status

`[ ] Not started â€” placeholder`



=== C:\Users\USER\Documents\Biblio\ace-whatsapp\core\comms-router\README.md ===


# Omni-Channel Communication Router

> **ACE WhatsApp â€” Core Microservice #10**  
> Stack: **Rust**  
> Role: Omni-Channel Shared Inbox router, message delivery watchdog, and the Vendor CommuniquÃ© engine

---

## Two Responsibilities

This service does two distinct things:

1. **Omni-Channel Customer Routing (Shared Inbox)** â€” routes inbound and outbound interactions across WhatsApp, Instagram, FB Messenger, Email, and VoIP. If a primary channel fails, it handles priority fallback via SMS or AI voice.
2. **Vendor CommuniquÃ© engine** â€” routes merchant decision requests via the appropriate channel (SMS reply-code, WhatsApp, app push, or AI voice call).

---

## Part A: Customer-Facing Fallback

### Priority Routing (Customer Communications)

| Order Value | Channel | Rationale |
|-------------|---------|-----------|
| > â‚¦50,000 | AI voice call | High-value = premium UX, highest conversion |
| â‚¦20,000 â€“ â‚¦50,000 | Premium SMS | Important, cost-justified |
| â‚¦5,000 â€“ â‚¦20,000 | Standard SMS | Cost-effective fallback |
| < â‚¦5,000 | Wait for reconnection | Unit economics don't justify channel cost |

```rust
enum EscalationPriority {
    Critical,   // Order value > â‚¦50K â†’ AI voice call
    High,       // Order value â‚¦20K-â‚¦50K â†’ Premium SMS
    Medium,     // Order value â‚¦5K-â‚¦20K â†’ Standard SMS
    Low,        // Cart reminders < â‚¦5K â†’ wait for reconnection
}
```

### Trigger Conditions
- WhatsApp delivery receipt not received within 5 minutes
- Customer unresponsive for > 2 hours on active order
- Payment timeout approaching (< 3 minutes on 15-min window)

---

## Part B: Vendor CommuniquÃ© Engine

The mechanism by which ACE communicates with merchants for decisions, summaries, and alerts. See full design: [VENDOR_COMMUNIQUE.md](../../../docs/product/VENDOR_COMMUNIQUE.md)

### CommuniquÃ© Types & Channels

| CommuniquÃ© Type | Default Channel | Configurable? |
|----------------|----------------|---------------|
| Negotiation exception (below-floor) | SMS (reply-code) | Yes |
| Restock approval request | SMS (reply-code) | Yes |
| High-value new customer decision | SMS (reply-code) | Yes |
| Payment anomaly alert | SMS (emergency override) | No |
| Order completion confirmation | WhatsApp | Yes |
| Daily morning digest | WhatsApp | Yes (time + channel) |
| Weekly performance summary | App push | Yes |
| AI voice call (> â‚¦50K exceptions) | Voice | Yes (toggle) |

### SMS Reply-Code Processor

```rust
struct SmsReplyProcessor {
    fn process_incoming_reply(
        &self,
        from_number: String,
        reply_text: String,
    ) -> Result<VendorDecision, Error> {
        // 1. Resolve merchant from phone number
        let merchant = self.merchant_repo.find_by_phone(&from_number)?;

        // 2. Find active communiquÃ© session for this merchant
        let session = self.redis
            .get::<CommuniquÃ©Session>(&merchant.id)
            .ok_or(Error::NoActiveCommuniquÃ©)?;

        // 3. Parse reply code (handles: "1", "Yes", "Y", "Approve", "yes" etc.)
        let choice = self.parse_reply_leniently(&reply_text, session.option_count)?;

        // 4. Publish decision event to Kafka
        self.kafka.send("vendor.decisions", VendorDecision {
            merchant_id: merchant.id,
            session_id: session.id,
            choice,
            channel: DecisionChannel::Sms,
            response_time_seconds: session.elapsed_seconds(),
        })?;

        // 5. Send confirmation SMS back to merchant
        self.sms_client.send(SmsMessage {
            to: from_number,
            body: session.confirmation_messages[choice as usize].clone(),
        })?;

        Ok(session.decisions[choice as usize].clone())
    }
}
```

### Quiet Hours & Emergency Override

```rust
fn should_send_now(&self, merchant: &Merchant, communiquÃ©_type: CommuniquÃ©Type) -> bool {
    let is_emergency = matches!(
        communiquÃ©_type,
        CommuniquÃ©Type::PaymentFraud | CommuniquÃ©Type::LogisticsFailureHighValue
        | CommuniquÃ©Type::SupplierDispute | CommuniquÃ©Type::MultipleChargebacks
    );

    if is_emergency {
        return true;  // always sends, regardless of quiet hours
    }

    let now = current_time_for_merchant_timezone(merchant);
    !merchant.communiquÃ©_quiet_hours.contains(now)
}
```

### Digest Builder

Compiles the morning briefing from multiple data sources:

```rust
struct DigestBuilder {
    fn build_daily_digest(&self, merchant_id: &str) -> Digest {
        Digest {
            revenue_yesterday: self.orders.sum_settled(merchant_id, yesterday()),
            orders_completed: self.orders.count_completed(merchant_id, yesterday()),
            orders_pending: self.orders.count_pending(merchant_id),
            awaiting_payment: self.orders.count_awaiting_payment(merchant_id),
            stock_alerts: self.inventory.get_low_stock(merchant_id),
            vip_alerts: self.crm.get_at_risk_vip_customers(merchant_id),
            actions_needed: self.exceptions.get_pending(merchant_id),
        }
    }
}
```

---

## Integrations

**Customer-facing:**
- **Twilio** â€” SMS + voice (primary)
- **Africa's Talking** â€” SMS (Nigeria/Kenya/Ghana optimised, lower latency)
- **Infobip** â€” SMS fallback

**Vendor communiquÃ©:**
- Same SMS providers (separate sender IDs for merchant vs customer comms)
- WhatsApp Business Cloud API (for merchant WhatsApp digests)
- Push notification service â†’ ACE merchant app

## Status

`[ ] Not started â€” placeholder`



=== C:\Users\USER\Documents\Biblio\ace-whatsapp\core\identity-resolution\README.md ===


# Identity Resolution Service

> **ACE WhatsApp â€” Core Microservice #2**  
> Stack: **Rust**  
> Role: Builds and maintains the Global Buyer ID â€” the cross-platform customer identity graph

## Responsibility

Clusters phone numbers, usernames, and email addresses from any channel into a single canonical `global_buyer_id`. This is the foundation of the cross-merchant 1-tap checkout network effect â€” ACE's most powerful structural moat.

## Key Functions

- **Contact Merge (Omni-Channel)**: If the same customer messages on WhatsApp in the morning and emails in the afternoon, the platform recognizes it's the same person and merges their profiles into a single thread.
- **Identifier clustering**: Maps phone numbers, WhatsApp IDs, Instagram handles, emails â†’ single `global_buyer_id`.
- **Fuzzy name resolution**: "David", "Dave", "Davido" + same phone number â†’ same identity.
- **Cross-platform coherence**: Same customer messaging via WhatsApp and Instagram DM = unified profile avoiding duplicate tickets.
- **Profile enrichment**: Aggregates purchase history, preferences, and addresses across all ACE merchants
- **1-tap checkout enablement**: Verified details pre-populate on any ACE PWA after first checkout
- **Privacy-preserving**: Internal ID is a hash â€” PII stored separately with strict access controls

## The Network Effect This Creates

```
Customer first purchase (Merchant A):
  Fills checkout form â†’ global_buyer_id created

Customer second purchase (Merchant B, different merchant):
  Opens PWA â†’ form auto-filled â†’ "Confirm" (8 seconds)

After 3+ purchases across different ACE merchants:
  93% probability customer uses ACE for next informal purchase
```

## Data Model (Draft)

```
global_buyer_id (PK, UUID)
â”œâ”€â”€ phone_number_hash (indexed, anonymised)
â”œâ”€â”€ verified_name
â”œâ”€â”€ verified_address
â”œâ”€â”€ payment_preferences
â”œâ”€â”€ purchase_history[] â†’ cross-merchant order refs
â””â”€â”€ merchant_interactions[] â†’ per-merchant preference data
```

## Status

`[ ] Not started â€” placeholder`



=== C:\Users\USER\Documents\Biblio\ace-whatsapp\core\ingestion-service\README.md ===


# Ingestion Service

> **ACE WhatsApp â€” Core Microservice #1**  
> Stack: **Rust + Actix-web**  
> Role: Entry point for all inbound WhatsApp traffic

## Responsibility

Owns the WhatsApp Business Cloud API connection. Ingests all inbound messages from merchants and customers, normalises them, and publishes to the Kafka event stream.

## Key Functions

- Webhook endpoint with Meta HMAC signature verification
- Rate limiting and deduplication (prevents duplicate processing of same message)
- Message ordering guarantees per conversation thread
- Media processing queue:
  - Voice notes â†’ Whisper transcription queue
  - Images â†’ OCR queue (bank transfer screenshots)
  - Documents â†’ extraction queue
- **Message Consolidation Engine**: 15-second batching window, compresses multiple AI intents into single outbound WhatsApp message (targets 2.3 messages/order)
- **Service Window Optimizer**: tracks 24hr free-reply window per conversation, strategically prompts customer to reply before window expires (â‚¦0 vs $0.01/message)
- Outbound message delivery via WhatsApp Business Cloud API
- Template message auto-selection (â‚¦0.003 vs â‚¦0.01 for conversational â€” 70% savings)

## Publishes (Kafka Events)

- `MessageReceived` â€” text message ingested
- `VoiceNoteReceived` â€” audio file queued for transcription
- `PaymentScreenshotReceived` â€” image queued for OCR
- `OutboundMessageDelivered` â€” confirms delivery status

## Consumes (Kafka Events)

- `OutboundMessageCommand` â€” from State Machine / other services

## Critical Metrics to Track

- Messages per completed order (target: â‰¤ 2.3)
- % conversations in free service window (target: â‰¥ 78%)
- Meta API cost per merchant per month (target: < $2.50)

## Status

`[ ] Not started â€” placeholder`



=== C:\Users\USER\Documents\Biblio\ace-whatsapp\core\logistics-coordination\README.md ===


# Logistics Coordination Service

> **ACE WhatsApp â€” Core Microservice #6**  
> Stack: **Rust**  
> Role: Autonomous rider dispatch and the logistics price moat

## Responsibility

Triggered by `PaymentVerified` state transition. Automatically selects the best logistics partner, books the rider, tracks delivery, and sends real-time updates to the customer â€” without any merchant action.

## Key Functions

### Logistics Aggregator (The Structural Moat)
ACE negotiates enterprise-tier rates based on **aggregate platform volume** across all merchants. Individual merchants cannot access these rates.

| Platform Volume (monthly deliveries) | Per-Delivery Rate | vs. Direct Rate (â‚¦600) |
|--------------------------------------|------------------|------------------------|
| 0 â€“ 999 | â‚¦600 | No savings |
| 1,000 â€“ 4,999 | â‚¦450 | 25% savings |
| 5,000 â€“ 19,999 | â‚¦350 | **41.6% savings** |
| 20,000+ | â‚¦280 | 53.3% savings |

**Lock-in calculation**: A merchant processing 80 orders/month saves â‚¦20,000/month on logistics vs. going direct â€” vs. â‚¦12,000 ACE subscription. **Leaving ACE costs more than staying.**

### Autonomous Booking
- On `PaymentVerified`: queries merchant's preferred logistics partner(s)
- Selects best carrier based on: delivery location, current load, cost, SLA performance history
- Calls carrier API: creates pickup request
- Receives: rider assignment + tracking link

### Customer Notifications
- Sends auto-message: "Your order is packed and on the way. Rider tracking: [link]. ETA: 45 mins."
- Live updates on rider proximity
- Delivery confirmation request to trigger escrow release

### Performance Tracking
- Per-carrier SLA tracking (on-time %, damage rate, customer ratings)
- Auto-deprioritises underperforming carriers
- Monthly volume reporting (feeds aggregate pricing renegotiation)

## Integrations
- **Kwik Delivery** â€” Urban on-demand
- **Gokada** â€” Motorcycle dispatch
- **MAX Delivery** â€” Electric vehicle fleet
- **GIG Logistics** â€” Intercity (Phase 1.5+)
- **Sendbox** â€” Multi-carrier API aggregator

## Status

`[ ] Not started â€” placeholder`



=== C:\Users\USER\Documents\Biblio\ace-whatsapp\core\payment-verification\README.md ===


# Payment Verification Service

> **ACE WhatsApp â€” Core Microservice #5**  
> Stack: **Rust**  
> Role: Autonomous payment reconciliation â€” merchant never checks their bank app

## Responsibility

Handles all payment verification without merchant intervention. Generates dynamic virtual accounts per transaction, receives real-time bank webhooks, manages the micro-escrow lifecycle, and reconciles card payments.

## Key Functions

### Virtual Account Generation
- Spins up a unique virtual account number per transaction
- Integrates with Providus / Wema / Sterling via partner FinTechs
- Account is transaction-specific (prevents cross-order payment confusion)
- 15-minute timer: if no payment, auto-reminder sent to customer

### Real-Time Bank Webhooks
- Listens for bank credit webhooks (Mono, Okra direct integrations)
- Validates: amount matches Â± â‚¦0 (exact match required)
- Validates: account number matches transaction's virtual account
- On match â†’ publishes `PaymentVerified` event to Kafka

### Screenshot OCR Fallback
- Used only when direct bank API unavailable (legacy scenarios)
- Confidence threshold: **< 95% confidence â†’ escalate to merchant for manual review**
- Vision AI extracts: amount, sender name, reference, bank name

### Micro-Escrow Engine
- Funds held for 24 hours post-confirmed delivery
- Release conditions:
  1. Customer explicitly confirms receipt, OR
  2. 24-hour window expires with no complaint, OR
  3. Delivery GPS webhook confirms drop-off
- Dispute resolution: AI analyses delivery proof + chat history + merchant reputation â†’ auto-resolves 85% of disputes

### Card Payment Reconciliation
- Paystack + Flutterwave webhook listeners
- Handles refunds and chargebacks

## Key Integrations
- Providus Bank, Wema Bank, Sterling Bank (virtual accounts)
- Mono, Okra (open banking, transaction verification)
- Paystack, Flutterwave (card payments)
- Kwik, Gokada, MAX (delivery GPS webhooks for escrow release)

## Status

`[ ] Not started â€” placeholder`



=== C:\Users\USER\Documents\Biblio\ace-whatsapp\core\state-machine\README.md ===


# State Machine Orchestrator

> **ACE WhatsApp â€” Core Microservice #4**  
> Stack: **Rust**  
> Role: Deterministic control plane â€” the AI suggests, Rust approves

## Responsibility

The most critical service in the system. Validates all state transitions against hard business rules. The LLM (Intent Parser) proposes transitions; this service either approves them or rejects them based on deterministic logic. **No LLM output can modify merchant financial data without passing through this service.**

## Key Functions

- **Deterministic state chart engine**: validates all proposed state transitions
- **30â€“45 second debounce window**: clusters rapid successive messages from same customer into single intent (prevents duplicate orders)
- **Hard rule enforcement**: merchant-configured boundaries cannot be overridden by LLM
- **Confidence-based escalation**: routes to merchant exception queue when AI confidence < threshold
- **Audit log**: every state transition is logged with timestamp, actor, and reason

## Order State Machine

```
AWAITING_INTENT
    â”‚ (customer message parsed)
    â–¼
INTENT_CONFIRMED
    â”‚ (product found, price negotiated within bounds)
    â–¼
AWAITING_PAYMENT
    â”‚ (virtual account issued, 15min timer started)
    â”œâ”€â†’ PAYMENT_TIMEOUT (15min elapsed, reminder sent)
    â”‚
    â–¼
PAYMENT_VERIFIED
    â”‚ (bank API confirms transfer)
    â”œâ”€â†’ inventory decremented
    â”œâ”€â†’ logistics dispatch triggered
    â–¼
OUT_FOR_DELIVERY
    â”‚ (rider assigned, ETA sent to customer)
    â–¼
DELIVERED
    â”‚ (GPS drop-off confirmed OR 24hr auto-release)
    â”œâ”€â†’ escrow released to merchant
    â””â”€â†’ DISPUTED (customer raises claim within 24hr)
```

## The AI/Determinism Split

```
Intent Parser (Python/LLM):          State Machine (Rust):
  - What does the customer want?        - Is this transition valid?
  - What's the best response?           - Does it violate any rule?
  - What discount should we offer?      - Is the confidence high enough?
  
  Suggests â†’ â†’ â†’ â†’ â†’ â†’ â†’ â†’ â†’ â†’ â†’ â†’ â†’ Approves or Rejects
```

## Exception Routing

Escalates to merchant when:
- AI confidence < 0.80 on intent classification
- Requested action exceeds merchant's configured autonomy boundaries
- Payment amount mismatch > â‚¦500
- New customer, high-value order (> â‚¦100K), no prior history

## Status

`[ ] Not started â€” placeholder`



=== C:\Users\USER\Documents\Biblio\ace-whatsapp\core\supplier-integration\README.md ===


# Supplier Integration Service

> **ACE WhatsApp â€” Core Microservice #7**  
> Stack: **Rust**  
> Role: Autonomous demand-driven restocking â€” merchant's only job is a 1-tap approval

## Responsibility

Detects impending stockouts before they happen, autonomously contacts suppliers, pre-negotiates pricing, performs margin analysis, and surfaces a ready-to-approve purchase order to the merchant. End-to-end time for merchant: ~8 seconds.

## Key Functions

### Inventory Oracle (background â€” runs every 6 hours)
- Analyses sales velocity for all SKUs per merchant
- Computes 7-day moving average sales rate
- Calculates predicted stockout time = `current_stock / avg_daily_sales`
- Triggers restock workflow when predicted stockout < 24 hours

### Supplier Communication
- Queries merchant's verified supplier database
- Sends WhatsApp template message to supplier via Business API
- Example: _"Hello Alhaji, ACE here for [Merchant]. Need 50 yards Red Ankara at your last price â‚¦800/yard. Available?"_
- Awaits supplier response (natural language or structured)

### Margin Analysis
- Calculates COGS from supplier quote
- Validates against merchant's acceptable margin floor (merchant-configured)
- Marks PO as auto-approvable if margin â‰¥ floor, escalates if not
- Example: â‚¦42K for 50 yards â†’ â‚¦840/yard COGS â†’ selling at â‚¦1,500 â†’ 44% margin â†’ âœ“ auto-approvable

### Merchant Notification & 1-Tap Approval
- Sends merchant a concise notification: _"Red Ankara running out (8 yards, ~16hrs). Restock: 50 yards from Alhaji Ibrahim, â‚¦42K (44% margin). Tap to approve."_
- On approval: triggers payment to supplier, sends pickup confirmation, updates inventory forecast

### Gap Management
- During restocking gap, automatically tells customers: _"Fresh stock arriving tomorrow! Reserve now at 10% off for pre-orders."_

## Exclusive Supplier Network (The Structural Moat)
ACE negotiates platform rates with wholesalers based on aggregate committed volume:
- Example: Ankara fabric at â‚¦900/yard direct â†’ â‚¦720/yard via ACE (20% discount)
- For a merchant doing â‚¦500K/month revenue, leaving ACE costs â‚¦100K/month in lost margin vs â‚¦12K subscription

## Status

`[ ] Not started â€” placeholder`



=== C:\Users\USER\Documents\Biblio\ace-whatsapp\core\visual-context\README.md ===


# Visual Context Resolution Service

> **ACE WhatsApp â€” Core Microservice #9**  
> Stack: **Rust + Python**  
> Role: Resolves deictic references ("that blue dress in your reel") to specific SKUs

## Responsibility

Enables customers to reference merchant's social media posts without being precise. The AI understands "that one" and resolves it to a specific SKU using visual AI and vector search.

## Key Functions

### Social Media Scraping Daemon
- Continuous background scraper for merchant's Instagram, Facebook, TikTok (future)
- Triggered on new merchant posts (webhook-based where available, polling fallback)
- Downloads all media: images, video frames (extracted at 1 fps), carousel slides

### Visual Embedding Pipeline
- Runs CLIP / ViT models on all media frames
- Generates semantic vector embeddings per product visible in each post
- Stores embeddings in Qdrant with metadata: `{merchant_id, post_id, timestamp, platform}`

### Deictic Reference Resolution
- Receives query from Intent Parser: `{reference: "blue dress in your last reel", merchant_id: "..."}`
- Translates query to CLIP embedding
- Searches Qdrant: finds nearest-neighbour product embeddings for this merchant
- Returns: matched `SKU`, confidence score, product image URL

### SKUâ†’Catalog Lookup
- Cross-references resolved SKU with merchant's inventory (via PostgreSQL)
- Returns: price, stock level, variants available

## Example Resolution

```
Customer: "How much for the blue dress in your last reel?"

Visual Context Service:
  1. Identifies deictic reference: "last reel" + "blue dress"
  2. Retrieves merchant's latest Instagram Reel (posted 14 hrs ago)
  3. Extracts frames â†’ CLIP embeddings
  4. Searches for blue garments in vector DB
  5. Matches: SKU = "BLUE-SATIN-MIDI-DRESS" (0.97 confidence)
  
Intent Parser receives: product resolved â†’ price negotiation proceeds autonomously
```

## Status

`[ ] Not started â€” placeholder`



=== C:\Users\USER\Documents\Biblio\ace-whatsapp\docs\api\README.md ===


# API Contracts

> **ACE WhatsApp â€” Phase 1**

This directory will contain API specifications and service contracts.

## Planned Contents

- `whatsapp-gateway.yaml` â€” OpenAPI spec for the Gateway
- `ai-engine.yaml` â€” Internal AI Engine API
- `inventory.yaml` â€” Inventory service contract
- `payments.yaml` â€” Payments service contract
- `logistics.yaml` â€” Logistics service contract
- `crm.yaml` â€” CRM service contract
- `internal-events.md` â€” Internal message bus event schema definitions

## Status

`[ ] Not started â€” placeholder`



=== C:\Users\USER\Documents\Biblio\ace-whatsapp\docs\decisions\README.md ===


# Architecture Decision Records

> **ACE WhatsApp â€” Phase 1**

This directory tracks significant technical decisions made during the design and build of Phase 1.

## Template

Each ADR should follow this structure:

```
# ADR-XXX: [Title]

Date: YYYY-MM-DD  
Status: [Proposed | Accepted | Deprecated | Superseded]

## Context
What problem or question prompted this decision?

## Decision
What was decided?

## Consequences
What are the trade-offs and implications?
```

## Index

_(No ADRs yet â€” to be added during technical design phase)_

## Status

`[ ] Not started â€” placeholder`



=== C:\Users\USER\Documents\Biblio\ace-whatsapp\docs\flows\README.md ===


# Data Flow Diagrams

> **ACE WhatsApp â€” Phase 1**

This directory will contain system and user flow diagrams.

## Planned Contents

- `order-flow.md` â€” End-to-end order processing flow
- `payment-flow.md` â€” Payment proof â†’ reconciliation â†’ confirmation flow
- `reorder-flow.md` â€” Autonomous supplier reorder flow
- `retention-flow.md` â€” Customer re-engagement campaign flow
- `exception-flow.md` â€” AI escalation â†’ merchant exception handling flow
- `onboarding-flow.md` â€” Merchant onboarding journey

## Status

`[ ] Not started â€” placeholder`



=== C:\Users\USER\Documents\Biblio\ace-whatsapp\infra\README.md ===


# Infrastructure

> **ACE WhatsApp â€” Phase 1**

This directory will contain all infrastructure-as-code, container definitions, and environment configuration.

## Planned Contents

```
infra/
â”œâ”€â”€ docker/            # Dockerfiles per service
â”œâ”€â”€ ci-cd/             # CI/CD pipeline definitions (GitHub Actions / etc.)
â””â”€â”€ environments/
    â”œâ”€â”€ dev/           # Development environment config
    â”œâ”€â”€ staging/       # Staging environment config
    â””â”€â”€ prod/          # Production environment config
```

## Status

`[ ] Not started â€” placeholder`



=== C:\Users\USER\Documents\Biblio\data-intelligence\README.md ===


# Data Intelligence â€” Enterprise Data Products

> ACE's secondary business. The most valuable dataset in emerging markets.

---

## The Core Thesis

ACE's primary product (merchant automation) is a real-time sensor network across the most opaque economy on Earth. By operating at scale, we capture data that **literally doesn't exist in structured form anywhere else**:

- Hyper-localised demand signals from informal commerce
- Conversational commerce patterns in 47 dialects
- Alternative credit behaviour of the unbanked
- Real-time FMCG product movement at street level
- Pricing elasticity in informal markets

**This data is ungoogleable, unscrapeable, and unimaginably valuable.**

---

## The Scale AI Playbook

| Scale AI | ACE |
|----------|-----|
| Started with unglamorous utility (AV labelling) | Start with merchant automation |
| Pivoted to RLHF when LLMs exploded | Pivoting to conversational commerce data |
| Became infrastructure layer for giants | Becoming the data layer for global AI + FMCG + finance |
| $14B valuation | Our trajectory |

**Phase 1 (Years 1â€“2):** Primary product is the Trojan Horse â€” captures the data stream  
**Phase 2 (Year 2â€“3):** Build HITL verification, PII scrubbing, enterprise packaging  
**Phase 3 (Year 3â€“5):** Enterprise data products become the primary revenue engine

---

## Enterprise Products

| Product | Folder | Target Buyers | Year 2 ARR |
|---------|--------|---------------|------------|
| [AI Training Data Marketplace](./ai-training-marketplace/) | `ai-training-marketplace/` | OpenAI, Anthropic, Google DeepMind, Meta AI, Cohere, Mistral | $7.2M |
| [FMCG Market Intelligence](./fmcg-intelligence/) | `fmcg-intelligence/` | Unilever, NestlÃ©, P&G, PZ Cussons, Dangote | $5.76M |
| [ACE TrustScore API](./trust-score-api/) | `trust-score-api/` | Kuda, FairMoney, Carbon, GTBank, Access Bank, MFIs | $3.57M |
| **Total Year 2 B2B** | | | **$16.53M** |

Combined with B2C merchant subscription revenue: **$24.8M ARR Year 2 projection**

---

## Revenue Projections (5-Year)

| Product | Year 3 | Year 4 | Year 5 |
|---------|--------|--------|--------|
| Dataset Licensing | $2.4M | $8.1M | $18M |
| Proprietary ASR API | $1.8M | $6.4M | $15M |
| FMCG Intelligence | $6M | $12M | $22M |
| Credit Scoring | $3.5M | $8.2M | $16M |
| **Total B2B** | **$13.7M** | **$34.7M** | **$71M** |

---

## Data Governance (Critical â€” To Be Developed)

- [ ] NDPR (Nigeria Data Protection Regulation) compliance framework
- [ ] Merchant consent and data usage disclosure at onboarding
- [ ] Customer anonymisation standards (PII scrubbing + tokenisation)
- [ ] Differential privacy implementation
- [ ] Enterprise Data Processing Agreements (DPAs)
- [ ] Data residency requirements per market (NG, KE, GH, ZA)

---

## Data Pipeline (Relationship to Products)

```
ace-whatsapp/ai/data-refinement/    â† Produces the raw assets
        â”‚
        â–¼
data-intelligence/
  â”œâ”€â”€ ai-training-marketplace/      â† Packages for AI labs
  â”œâ”€â”€ fmcg-intelligence/            â† Packages for FMCG brands
  â””â”€â”€ trust-score-api/              â† Packages for banks/fintechs
        â”‚
        â–¼
ace-platform/services/analytics/    â† Enterprise buyer dashboards (Phase 2)
```



=== C:\Users\USER\Documents\Biblio\data-intelligence\ai-training-marketplace\README.md ===


# AI Training Data Marketplace

> **ACE Enterprise Product 1**  
> Target: OpenAI Â· Anthropic Â· Google DeepMind Â· Meta AI Â· Cohere Â· Mistral  
> Year 2 ARR Projection: **$7.2M** (8 customers @ avg $75K/month)

---

## The Problem AI Labs Have

Global AI labs are desperately trying to make models work in non-Western markets. Their training data is:
- **78% English**, 15% European languages, 7% everything else
- Virtually **zero** Nigerian Pidgin, Yoruba-English code-switching, or Swahili slang
- No real-world transaction context (most training data is scraped text, not goal-oriented conversations)

ACE's platform generates this data as a natural by-product of operating at scale. It's the only source that exists.

---

## Product Offerings

### 1. Dialect-Rich Conversational Datasets
- Anonymised, structured conversation transcripts from real informal commerce
- Metadata tags: intent, sentiment, regional dialect, code-switching patterns
- Voice note transcriptions paired with original audio (consent-gated)

### 2. RLHF-Ready Evaluation Sets
- "Golden datasets" for testing model performance on informal commerce tasks
- Human-verified preference pairs for reinforcement learning from human feedback
- Vertical-specific benchmarks (fashion, food distribution, personal care)

### 3. Federated Learning Compute Rental
- AI labs don't receive raw data â€” they send models to ACE infrastructure
- Models train locally on ring-fenced data; only weight updates extracted
- Full data sovereignty maintained; NDPR-compliant

### 4. Proprietary ASR API (Year 3+)
- Fine-tuned Whisper on ACE's verified dialect data
- Exposed via developer API
- Only voice engine that actually understands Nigerian Pidgin, Yoruba, Hausa, Igbo in commerce context

---

## Pricing Model

| Product | Price |
|---------|-------|
| Base access | $50K/month minimum commitment |
| Conversation transcripts | $0.08 per conversation (cleaned, anonymised) |
| Federated learning compute | $2,500 per GPU-hour on ACE infrastructure |
| Custom evaluation sets | $120K per vertical-specific benchmark |
| ASR API (Year 3+) | $0.004 per audio minute |

---

## Proprietary ASR API Pipeline (Year 3 Preview)

```
[Merchant's WhatsApp voice note]
    â†’ "Abeg I go pay you 2moro"
    â†’ PII Scrubber â†’ [REDACTED_COMMITMENT]
    â†’ Initial Whisper â†’ "I will pay you tomorrow" (WRONG dialect)
    â†’ HITL Human Reviewer corrects:
    â†’ "Please, I will pay you tomorrow" [dialect=pidgin, intent=payment_commitment]
    â†’ Training asset created
    â†’ Fine-tunes ACE ASR model
    â†’ ACE ASR outperforms generic Whisper on Nigerian speech
    â†’ Sold as API to every fintech/delivery app in Nigeria
```

**Moat**: Only voice engine that actually understands local dialects in commerce context.

## Status

`[ ] Not started â€” placeholder`



=== C:\Users\USER\Documents\Biblio\data-intelligence\fmcg-intelligence\README.md ===


# FMCG Market Intelligence

> **ACE Enterprise Product 2**  
> Target: Unilever Â· NestlÃ© Â· P&G Â· PZ Cussons Â· Chi Limited Â· Dangote Group  
> Year 2 ARR Projection: **$5.76M** (12 clients @ avg $40K/month)

---

## The Problem FMCG Brands Have

FMCG brands in Africa operate with **6â€“8 week lag time** on sales data. Their distribution chain:

```
Factory â†’ National Distributor â†’ Regional Wholesaler â†’ Local Kiosk â†’ Consumer
```

By the time data flows back up this chain, it is:
- **Aggregated** (no granular SKU-level insights)
- **Delayed** (trend has shifted by the time they see it)
- **Incomplete** (informal retailers don't report accurately)

ACE operates **at the last mile** â€” where the actual sale happens. We see it in real-time.

---

## ACE Market Pulse Dashboard

### Demand Velocity Heatmaps
- Live view: "In Surulere, Lagos â€” inquiries for 'Blue Band Margarine' up 340% this week"
- Competitor comparison: "Simas Margarine demand dropping 28% in same region"
- Predictive stockout alerts: "47 retailers in your zone will run out of Peak Milk 500ml in 3â€“5 days"

### Price Elasticity Intelligence
- "When Blue Band price rises above â‚¦850, 63% of customers switch to Simas"
- "Optimal price point in this market: â‚¦780â€“â‚¦820"
- Real-time price sensitivity curves by region

### Product Launch Readiness Scoring
- Sentiment analysis on customer conversations mentioning a product
- "312 customers in the past week complained about current detergent fragrance being 'too strong'"
- "Opportunity: mild-scented variant could capture 18% market share"

### Distribution Gap Identification
- "Your product has 89% availability in Ikeja, but only 34% in Ikorodu"
- "1,840 customer requests in underserved areas in the last 30 days"

---

## Pricing Model

| Offering | Price |
|----------|-------|
| Platform access | $25K/month per brand |
| Per additional city/region | +$8K/month |
| Custom research projects | $75Kâ€“$200K per project |
| Programmatic API access | $15K/month |

---

## Why This Data Is Unique

Nielsen, McKinsey, and every major research firm **cannot** access this data:
- They survey formal retailers (which don't cover informal commerce)
- They have no presence in market stalls, WhatsApp groups, or street trade
- Their lag time makes it historical, not actionable

ACE's data is **real-time, street-level, and SKU-specific**.

## Status

`[ ] Not started â€” placeholder`



=== C:\Users\USER\Documents\Biblio\data-intelligence\trust-score-api\README.md ===


# ACE TrustScore API

> **ACE Enterprise Product 3**  
> Target: Kuda Â· FairMoney Â· Carbon Â· GTBank Â· Access Bank Â· MFIs Â· BNPL providers  
> Year 2 ARR Projection: **$3.57M** (850K credit checks/month @ $0.35 avg)

---

## The Problem Banks Have

Traditional credit scoring relies on:
- Formal employment records â† informal merchants have none
- Bank statements showing regular salary deposits â† informal merchants have chaotic cash flow
- Credit bureau history â† 95% of informal merchants have **zero** formal credit history

Result: **180 million creditworthy but "unscorable" people** locked out of financial services in Nigeria alone.

---

## ACE TrustScore â€” The Alternative Credit Engine

ACE's platform captures the most accurate proxy for creditworthiness that exists: **actual business behaviour, at scale, over time**.

A 300â€“850 score derived from behavioural transaction signals â€” with **73% correlation to loan repayment behaviour** (internal validation showing 28% better than traditional bureau scores for informal merchants).

---

## Signal Categories

### 1. Order Fulfillment Consistency
- % of orders completed vs. cancelled
- Average time from order to delivery
- Customer complaint and dispute rate

### 2. Cash Flow Predictability
- Revenue stability coefficient
- Seasonality patterns
- Month-over-month growth trajectory
- Peak/trough ratio

### 3. Supplier Relationship Health
- Payment punctuality to suppliers
- Credit terms offered by suppliers (proxy: suppliers trust this merchant)
- Reorder frequency and reliability

### 4. Customer Retention Metrics
- Repeat customer rate
- LTV distribution
- Churn patterns and velocity

### 5. Conversational Integrity Signals
- Response time consistency
- Commitment follow-through rate ("I'll send it tomorrow" â†’ actually does)
- Conflict resolution approach and outcome

---

## Pricing Model

| Offering | Price |
|----------|-------|
| Per-query API | $0.45 per credit check |
| Batch processing | $0.22 per check (min 10K/month) |
| White-label embedded scoring | $180K/year + $0.15 per query |

---

## API Response Format (Draft)

```json
{
  "trust_score": 742,
  "score_band": "Good",
  "confidence": 0.89,
  "signals": {
    "fulfillment_consistency": 0.94,
    "cash_flow_predictability": 0.81,
    "supplier_relationship": 0.76,
    "customer_retention": 0.88,
    "conversational_integrity": 0.79
  },
  "data_vintage": "90_days",
  "recommended_credit_ceiling": "â‚¦500,000"
}
```

---

## Compliance Requirements

- [ ] Approved by CBN (Central Bank of Nigeria) for use in credit decisioning
- [ ] Compliant with NDPR data usage requirements
- [ ] Merchant consent for credit score generation at onboarding
- [ ] Score explanation / right-to-explanation for scored individuals
- [ ] Anti-discrimination audit (bias testing across gender, geography, ethnicity)

## Status

`[ ] Not started â€” placeholder`



=== C:\Users\USER\Documents\Biblio\docs\product\README.md ===


# Product Documentation

> **ACE â€” Product docs hub**

## Contents (Planned)

- `roadmap.md` â€” Phase 1 â†’ Phase 2 â†’ beyond
- `personas.md` â€” Merchant personas, customer personas, enterprise buyer personas
- `user-stories/` â€” Structured user stories per feature area
- `jtbd.md` â€” Jobs-to-be-done framework for core flows
- `metrics.md` â€” North star metrics and success criteria per phase

## Status

`[ ] Not started â€” placeholder`



=== C:\Users\USER\Documents\Biblio\infra\README.md ===


# Infrastructure â€” Database & Event Architecture

> All five persistence layers used by ACE, with design rationale.  
> Applies to both Phase 1 (ace-whatsapp/) and Phase 2 (ace-platform/).

---

## The Five-Layer Persistence Architecture

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚  PostgreSQL          Primary transactional database                 â”‚
â”‚  ACID Â· merchant-partitioned Â· financial ledger                     â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚  Qdrant              Vector database                                â”‚
â”‚  Conversation embeddings Â· visual product embeddings               â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚  Redis               Real-time state cache                          â”‚
â”‚  Active conversation state Â· service window Â· distributed locks     â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚  Apache Kafka        Immutable event log                            â”‚
â”‚  All domain events Â· training data pipeline Â· inter-service bus     â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚  ClickHouse          Data warehouse                                 â”‚
â”‚  FMCG dashboards Â· enterprise analytics Â· training signal store     â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

---

## PostgreSQL â€” Primary Transactional Database

**Why PostgreSQL:**  
ACID compliance is non-negotiable for financial operations. ACE manages escrow accounts, payment verification, and merchant settlements. A race condition or partial write in financial data is catastrophic. PostgreSQL's MVCC guarantees transactional integrity under concurrent load.

**Schema design:**

| Table | Primary Key | Key Columns |
|-------|------------|-------------|
| `merchants` | `merchant_id` (UUID) | phone, subscription_tier, voice_profile, autonomy_settings |
| `customers` | `global_buyer_id` (UUID) | phone_hash, verified_profile, tier, cross_merchant_history |
| `orders` | `order_id` (UUID) | merchant_id, customer_id, state, items, negotiated_price |
| `products` | `sku_id` (UUID) | merchant_id, name, base_price, stock, category |
| `transactions` | `tx_id` (UUID) | order_id, amount, virtual_account, bank_ref, status |
| `escrow_accounts` | `escrow_id` (UUID) | order_id, held_amount, release_trigger, status |
| `negotiation_traces` | `trace_id` (UUID) | order_id, anchor, close, tactics_used, outcome |
| `vendor_decisions` | `decision_id` (UUID) | merchant_id, decision_type, channel, response_time_s, choice |
| `supplier_orders` | `po_id` (UUID) | merchant_id, supplier_id, sku_id, quantity, unit_cost, status |

**Multi-tenancy isolation (Row-Level Security):**
```sql
-- Every table uses RLS â€” no application-layer mistake can cross tenant boundaries
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY merchant_isolation ON orders
    USING (merchant_id = current_setting('app.current_merchant_id')::uuid);

-- Applied at connection establishment â€” Rust services set this per request
SET LOCAL app.current_merchant_id = $merchant_id;
```

**Partitioning:** All large tables partitioned by `merchant_id` (hash partitioning, 64 buckets). Enables independent scaling per merchant cluster.

---

## Qdrant â€” Vector Database

**Why Qdrant:**  
Rust-native client, purpose-built for high-dimensional vector similarity search, and runs efficiently on commodity hardware. ACE needs vector search for two use cases with very different embedding models â€” Qdrant supports multiple collections with independent configurations.

**Collections:**

| Collection | Embedding Model | Dimension | Use Case |
|-----------|----------------|-----------|---------|
| `conversations` | Sentence-BERT (dialect-tuned) | 768 | Long-term customer context recall |
| `visual_products` | CLIP / ViT | 512 | "That dress in your reel" â†’ SKU resolution |

**Conversation memory:**  
Every customer-merchant exchange is embedded and stored. When a customer messages again (even months later), the AI retrieves the most semantically relevant past context before generating a response.

> "This customer mentioned they prefer Saturday deliveries â€” 6 months ago."  
> "She's bought Ankara fabric 7 times. She's never bought accessories."

**Visual product resolution:**  
Instagram/Facebook posts and video frames are embedded via CLIP. When a customer says "that blue dress in your last reel", the query "blue dress last reel" is embedded and similarity-searched against the merchant's visual index â†’ returns the matching SKU.

**Namespace isolation:** Each merchant's embeddings live in a Qdrant namespace. Cross-merchant search is architecturally prevented at the query level.

---

## Redis â€” Real-Time State Cache

**Why Redis:**  
Sub-millisecond latency for state lookups that happen on every message. PostgreSQL queries would add unacceptable latency to the conversation flow. Redis holds the hot state; PostgreSQL is the durable record.

**Key namespaces:**

| Namespace | TTL | Contents |
|-----------|-----|----------|
| `conv:{customer_id}:state` | 48 hours | Active conversation state machine position |
| `conv:{customer_id}:window` | 24 hours | WhatsApp service window expiry timestamp |
| `conv:{customer_id}:batch` | 15 seconds | Pending message intents (consolidation window) |
| `order:{order_id}:timer` | 15 minutes | Payment deadline countdown |
| `communique:{merchant_id}:active` | 4 hours | Active Vendor CommuniquÃ© session (SMS reply mapping) |
| `rate:{phone}:{endpoint}` | 60 seconds | Rate limiting counters per phone per endpoint |
| `lock:{resource_id}` | Variable | Distributed locks (prevents duplicate rider bookings, double-payment) |

**Service Window Optimizer:**  
Redis tracks the exact timestamp when the 24-hour free WhatsApp response window opens (triggered by customer message). The AI checks this before every outbound message â€” if < 2 hours remain, it triggers a window-refresh prompt to the customer before sending anything costly.

---

## Apache Kafka â€” Immutable Event Log

**Why Kafka:**  
ACE is event-driven by design. Kafka is the backbone that decouples every service from every other service, enables independent scaling, and provides an immutable audit trail of every business event â€” critical for financial disputes, training data lineage, and debugging.

**Every domain event is published to Kafka. No service calls another service directly for domain events.**

**Topic architecture:**

| Topic | Producers | Key Consumers |
|-------|----------|--------------|
| `messages.received` | Ingestion Service | Identity Resolution, Intent Parser |
| `intents.classified` | Intent Parser | State Machine, AI Negotiator |
| `orders.state_changed` | State Machine | Payment, Logistics, Comms Router |
| `payments.verified` | Payment Verification | State Machine, Logistics, Escrow |
| `riders.dispatched` | Logistics | State Machine, Ingestion (notification) |
| `orders.delivered` | Logistics | Payment (escrow release), CRM |
| `negotiations.traces` | AI Negotiator | Data Refinement, ClickHouse |
| `negotiations.escalations` | AI Negotiator | Comms Router (â†’ SMS communiquÃ©) |
| `vendor.decisions` | Comms Router | State Machine, AI Negotiator, Supplier Integration |
| `inventory.low_stock` | Inventory Oracle | Supplier Integration |
| `commerce.events.product_intel` | State Machine | ClickHouse, FMCG pipeline |
| `commerce.events.transactions` | Payment Verification | ClickHouse, TrustScore pipeline |
| `training.interactions.raw` | AI SDK Middleware | Data Refinement Pipeline |
| `training.interactions.clean` | Data Refinement | AI Training Jobs |
| `merchant.signals.behavioral` | Multiple | TrustScore Pipeline |

**Partition key:** Always `merchant_id` â€” ensures all events for a merchant are processed in order by the same consumer instance.

**Retention:** All topics: 30-day hot retention. Topics feeding the data intelligence pipeline: 365-day cold retention (S3-backed log compaction).

---

## ClickHouse â€” Data Warehouse

**Why ClickHouse:**  
Columnar storage enables sub-second aggregation queries over billions of rows. The FMCG Market Pulse dashboard needs real-time "demand for Blue Band in Surulere this week" â€” this would take minutes in PostgreSQL and seconds in most data warehouses. ClickHouse does it in milliseconds.

**Key tables:**

| Table | Purpose | Update Frequency |
|-------|---------|-----------------|
| `product_transactions` | Every completed sale: SKU, price, geo, tier, discount | Real-time (Kafka consumer) |
| `demand_signals` | Every product inquiry, even if not purchased | Real-time |
| `negotiation_analytics` | NegotiationTrace aggregates per SKU/geo/tier | Real-time |
| `merchant_performance` | Fulfillment rates, delivery times, complaint rates | Hourly rollup |
| `customer_segments` | Cohort analysis, LTV distributions | Daily rollup |
| `stockout_events` | When, where, which SKU, demand during gap | Real-time |
| `supplier_performance` | Delivery reliability, pricing trends | Daily rollup |

**Materialized views for FMCG dashboards:**
```sql
-- Pre-computed for sub-second response on the enterprise dashboard
CREATE MATERIALIZED VIEW demand_by_sku_geo_week AS
SELECT
    product_category,
    sku_name,
    geo_lga,
    toStartOfWeek(event_time) AS week,
    count() AS inquiry_count,
    countIf(purchased = true) AS purchase_count,
    avg(transaction_price) AS avg_actual_price,
    avg(listed_price) AS avg_listed_price,
    avg(transaction_price / listed_price) AS price_realisation_rate
FROM demand_signals
GROUP BY product_category, sku_name, geo_lga, week
ORDER BY week DESC, inquiry_count DESC;
```

---

## Infrastructure Directory

```
infra/
â”œâ”€â”€ postgres/
â”‚   â”œâ”€â”€ migrations/        # Versioned schema migrations (sqlx)
â”‚   â”œâ”€â”€ seeds/             # Dev/test seed data
â”‚   â””â”€â”€ rls-policies/      # Row-level security policy definitions
â”‚
â”œâ”€â”€ qdrant/
â”‚   â”œâ”€â”€ collections/       # Collection configuration (dimensions, distance metric)
â”‚   â””â”€â”€ namespaces/        # Namespace templates per merchant
â”‚
â”œâ”€â”€ redis/
â”‚   â”œâ”€â”€ config/            # Redis cluster configuration
â”‚   â””â”€â”€ keyspace/          # Key naming conventions and TTL reference
â”‚
â”œâ”€â”€ kafka/
â”‚   â”œâ”€â”€ topics/            # Topic definitions (retention, partitions, replication)
â”‚   â”œâ”€â”€ schemas/           # Event schemas (JSON Schema / Avro)
â”‚   â””â”€â”€ consumer-groups/   # Consumer group definitions per service
â”‚
â””â”€â”€ clickhouse/
    â”œâ”€â”€ tables/            # Table DDL definitions
    â”œâ”€â”€ materialized-views/ # Pre-computed FMCG/analytics views
    â””â”€â”€ retention/         # TTL policies and tiered storage config
```

## Status

`[ ] Infrastructure config not yet written â€” placeholder directory structure only`



=== C:\Users\USER\Documents\Biblio\MEMORY_DOCS\README.md ===


# MEMORY_DOCS â€” Persistent Engineering Memory for Biblio / ACE

> **Future engineer / agent: read this folder before doing anything.** It exists so
> work continues seamlessly across sessions. Source of product truth is `../BIBLO.docx`;
> these files distill and reconcile it with the actual code.

## Read in this order

1. **project-overview.md** â€” what ACE is, the two codebases, where things stand.
2. **architecture.md** â€” as-built service map, domain model, invariants, intended direction.
3. **build-plan.md** â€” the prioritized roadmap (start at Phase A).
4. **progress-tracker.md** â€” current status, what's done/pending/blocked, "start here next."
5. **specific-function-assignment.md** â€” per-module ownership + what remains.
6. **code-standards.md** â€” conventions in force (match them).
7. **library-docs.md** â€” dependencies and why.
8. **ui-overview** â€” **ui-rules.md** (principles), **ui-tokens.md** (palette/spacing),
   **ui-registry.md** (screen/component inventory).

## The rule (directive #8)

After **every** completed unit of work: update `progress-tracker.md`,
`build-plan.md`, and `specific-function-assignment.md` (and `architecture.md` if the
design changed) in the **same** change. No major implementation without a doc update.

## One-paragraph orientation

ACE/Biblio is an autonomous WhatsApp commerce engine for informal merchants. The active
codebase is `../ace-whatsapp/` (TypeScript, compiles clean, core order loop works
end-to-end). `../ace-platform/` and `../data-intelligence/` are design-only roadmap.
The highest-value next work is hardening the core loop: tests + delivering merchant
escalations (the `escalate_to_merchant` tool currently dead-ends). See build-plan Phase A.


=== C:\Users\USER\Documents\Biblio\shared\README.md ===


# Shared Libraries

> Cross-cutting code shared between `ace-whatsapp/` (Phase 1) and `ace-platform/` (Phase 2)

## Structure

```
shared/
â”œâ”€â”€ ai-sdk/            # Vercel AI SDK shared config, tools, schemas, middleware
â”œâ”€â”€ proto/             # gRPC Protocol Buffer definitions (all Rust inter-service calls)
â”œâ”€â”€ event-schemas/     # Kafka event schemas (Avro / JSON Schema)
â”œâ”€â”€ ai-models/         # Shared trained model artifacts and embeddings
â””â”€â”€ common/            # Shared types, utilities, validation helpers
```

## Principles

- Nothing in `shared/` has a runtime dependency on a specific application
- Versioned independently â€” changes must be backward-compatible or explicitly versioned
- All Kafka event schemas live here â€” they are the immutable contracts between services
- All gRPC protobuf definitions live here â€” services import, never define their own
- All Vercel AI SDK tool definitions, schemas, and middleware live in `ai-sdk/` â€” shared between phases

---

## `ai-sdk/` â€” [See README](./ai-sdk/README.md)

Vercel AI SDK shared configuration used by the intent parser (Phase 1) and the enhanced AI engine (Phase 2).

Key contents:
- **Tool definitions** â€” all `tool()` calls the AI agent can make (calls Rust services)
- **Training middleware** â€” `wrapLanguageModel()` that captures every AI interaction to Kafka
- **Model registry** â€” maps current phase to active model (easy swap for fine-tuned models)
- **Intent schema** â€” Zod schema for `generateObject` structured output
- **Provider config** â€” OpenAI / Anthropic / fine-tuned model routing

---

## `proto/` â€” gRPC Definitions

Rust microservice-to-microservice communication contracts.

Key proto files (planned):
- `intent.proto` â€” Intent Parser â†’ State Machine (proposes action)
- `pricing.proto` â€” State Machine â†’ Pricing Service (authorised price range)
- `inventory.proto` â€” State Machine / AI â†’ Inventory Service (stock check)
- `logistics.proto` â€” State Machine â†’ Logistics (dispatch request)
- `payment.proto` â€” State Machine â†’ Payment Verification (confirm payment)
- `identity.proto` â€” AI â†’ Identity Resolution (customer profile lookup)

---

## `event-schemas/` â€” Kafka Event Schemas

The canonical event definitions. All services publish and consume using these schemas.

Key events (planned):

| Event | Producer | Consumers |
|-------|----------|-----------|
| `MessageReceived` | Ingestion Service | Intent Parser, Identity Resolution |
| `IntentClassified` | Intent Parser | State Machine |
| `OrderCreated` | State Machine | Payment Verification, Logistics |
| `PaymentVerified` | Payment Verification | State Machine, Logistics |
| `RiderDispatched` | Logistics | Ingestion (notification send) |
| `OrderDelivered` | Logistics | Payment Verification (escrow release) |
| `StockLow` | Supplier Integration | Merchant App (notification) |
| `PurchaseOrderApproved` | Merchant App | Supplier Integration, Payment |
| `CustomerAtRisk` | CRM/Retention | Intent Parser (draft message) |
| `training.interactions.raw` | AI SDK Middleware | Data Refinement Pipeline |
| `commerce.events.demand` | State Machine | FMCG Intelligence Pipeline |
| `merchant.signals.behavioral` | Multiple | TrustScore Pipeline |

---

## `ai-models/` â€” Shared Model Artifacts

- Fine-tuned model weights (after Phase 2 training completes)
- Dialect BERT checkpoint (shared between intent parser and data refinement)
- Whisper fine-tuned checkpoint (shared between ingestion and intent parser)
- CLIP/ViT visual embeddings (used by visual context service)

---

## `common/` â€” Shared Types & Utilities

- TypeScript types (shared between PWA, merchant app, AI SDK layer)
- Rust crates (shared between all Rust microservices)
- Validation helpers, error types, logging utilities

## Status

`[ ] Not started â€” placeholder`



=== C:\Users\USER\Documents\Biblio\shared\ai-sdk\README.md ===


# Vercel AI SDK â€” Shared Configuration

> Shared Vercel AI SDK configuration, tool definitions, model registry, and middleware  
> Used by: `ace-whatsapp/ai/intent-parser/` and `ace-platform/ai/`

---

## What Lives Here

```
shared/ai-sdk/
â”œâ”€â”€ tools/                  # Shared tool definitions (called by AI agent)
â”‚   â”œâ”€â”€ commerce.tools.ts   # Inventory, pricing, order tools
â”‚   â”œâ”€â”€ identity.tools.ts   # Customer profile, Global Buyer ID tools
â”‚   â”œâ”€â”€ logistics.tools.ts  # Dispatch, tracking tools
â”‚   â””â”€â”€ training.tools.ts   # Internal data collection / logging tools
â”‚
â”œâ”€â”€ middleware/
â”‚   â”œâ”€â”€ training.middleware.ts     # Captures every AI interaction for training pipeline
â”‚   â”œâ”€â”€ cost-monitor.middleware.ts # Tracks token usage and Meta API message costs
â”‚   â””â”€â”€ injection-guard.middleware.ts # Prompt injection detection
â”‚
â”œâ”€â”€ models/
â”‚   â”œâ”€â”€ registry.ts         # Model version registry (maps phase â†’ model)
â”‚   â””â”€â”€ prompts/            # System prompt builders per merchant context
â”‚
â”œâ”€â”€ schemas/
â”‚   â”œâ”€â”€ intent.schema.ts    # Zod schema for generateObject intent extraction
â”‚   â”œâ”€â”€ order.schema.ts     # Zod schema for order proposals
â”‚   â””â”€â”€ correction.schema.ts # Zod schema for merchant correction logging
â”‚
â””â”€â”€ config/
    â””â”€â”€ providers.ts        # Provider configuration (OpenAI, Anthropic, fallbacks)
```

---

## Provider Configuration

```typescript
// shared/ai-sdk/config/providers.ts
import { openai } from '@ai-sdk/openai'
import { anthropic } from '@ai-sdk/anthropic'

export const MODEL_REGISTRY = {
  // Phase 1: hosted models
  intentExtraction: openai('gpt-4o'),
  intentExtractionFast: openai('gpt-4o-mini'),  // for low-stakes interactions
  responseGeneration: openai('gpt-4o'),
  fallback: anthropic('claude-sonnet-4-5'),

  // Phase 2+: ACE fine-tuned models (swap here, nothing else changes)
  // intentExtraction: openai('ft:gpt-4o:ace-technologies:intent-v2:xxxxx'),
  // responseGeneration: openai('ft:gpt-4o:ace-technologies:response-v1:xxxxx'),
}

// Cost-tier routing: use cheaper model for high-volume, low-stakes tasks
export function selectModel(orderValue: number, interactionType: string) {
  if (interactionType === 'cart_reminder' || orderValue < 5000) {
    return MODEL_REGISTRY.intentExtractionFast
  }
  return MODEL_REGISTRY.intentExtraction
}
```

---

## Training Middleware

The central mechanism for capturing every AI interaction into the training pipeline.

```typescript
// shared/ai-sdk/middleware/training.middleware.ts
import { wrapLanguageModel } from 'ai'

export function createTrainingMiddleware(kafkaProducer: KafkaProducer) {
  return wrapLanguageModel({
    model: /* passed in */,
    middleware: {
      wrapGenerate: async ({ doGenerate, params }) => {
        const start = Date.now()
        const result = await doGenerate()

        // Fire-and-forget to Kafka (non-blocking)
        kafkaProducer.send({
          topic: 'training.interactions.raw',
          messages: [{
            key: params.conversationId,
            value: JSON.stringify({
              ...params,
              ...result,
              latencyMs: Date.now() - start,
              capturedAt: new Date().toISOString(),
            })
          }]
        }).catch(console.error)  // never block the response for logging

        return result
      }
    }
  })
}
```

---

## Intent Schema (Zod)

The single source of truth for the structured intent object that `generateObject` returns.

```typescript
// shared/ai-sdk/schemas/intent.schema.ts
import { z } from 'zod'

export const IntentSchema = z.object({
  intent: z.enum([
    'purchase', 'payment_proof', 'delivery_enquiry',
    'stock_enquiry', 'complaint', 'negotiation',
    'reorder', 'greeting', 'unknown'
  ]),
  entities: z.object({
    productReference: z.string().optional(),
    productReferenceType: z.enum(['explicit', 'social_media_post', 'deictic']).optional(),
    quantity: z.number().int().positive().optional(),
    requestedPrice: z.number().positive().optional(),
    deliveryAddress: z.string().optional(),
  }),
  dialect: z.enum(['english', 'pidgin', 'yoruba', 'hausa', 'igbo', 'code_switch']),
  sentiment: z.enum(['positive', 'neutral', 'negative']),
  confidence: z.number().min(0).max(1),
  requiresVisualResolution: z.boolean(),
  escalateToMerchant: z.boolean(),
  injectionAttemptDetected: z.boolean().default(false),
})

export type Intent = z.infer<typeof IntentSchema>
```

---

## Tool Definitions (Commerce)

```typescript
// shared/ai-sdk/tools/commerce.tools.ts
import { tool } from 'ai'
import { z } from 'zod'

export const commerceTools = {
  checkInventory: tool({
    description: 'Check current stock level and price for a product SKU',
    parameters: z.object({
      sku: z.string(),
      merchantId: z.string(),
    }),
    execute: async ({ sku, merchantId }) =>
      inventoryClient.getStock({ sku, merchantId }),
  }),

  getAuthorizedPriceRange: tool({
    description: 'Get merchant-configured price floor and ceiling for negotiation. The AI must stay within these bounds.',
    parameters: z.object({
      sku: z.string(),
      customerTier: z.enum(['new', 'returning', 'vip']),
      merchantId: z.string(),
    }),
    execute: async (params) =>
      pricingClient.getAuthorizedRange(params),
    // Note: this calls the Rust PricingService â€” merchant sets the bounds, not the AI
  }),

  proposeOrderToStateMachine: tool({
    description: 'Submit a proposed order to the state machine for validation. The state machine may reject it.',
    parameters: z.object({
      customerId: z.string(),
      merchantId: z.string(),
      items: z.array(z.object({ sku: z.string(), quantity: z.number(), agreedPrice: z.number() })),
    }),
    execute: async (order) =>
      stateMachineClient.proposeOrder(order),
  }),
}
```

---

## Status

`[ ] Not started â€” placeholder`

