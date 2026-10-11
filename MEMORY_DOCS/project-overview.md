# Project Overview — Biblio / ACE (Autonomous Commerce Engine)

> Persistent engineering memory. Read this first. Last updated: 2026-06-23.
> Source of truth for product/business intent: `BIBLO.docx` (root). This file
> distills the engineering-relevant parts so you don't have to re-read 4,600 lines.

## What ACE is

ACE ("Autonomous Commerce Engine"; product/repo also called **Biblio**) is an
**invisible back-office for informal WhatsApp commerce** in emerging markets
(Nigeria first). Merchants keep selling on WhatsApp; ACE's AI autonomously handles
inventory, price negotiation, payment verification, logistics, and customer
retention in the background. The merchant's job shrinks to **exception management**.

Tagline: *"Your business runs itself while you sleep."*

### The three-layer product (from BIBLO.docx, PART 2)

```
LAYER 3: ENTERPRISE INTELLIGENCE PLATFORM (B2B)   ← sells refined data to AI labs, FMCGs, banks
              ▲ (refined data)
LAYER 2: AUTONOMOUS STATE ENGINE (core IP)        ← event-driven services, state machine, ML
              ▲ (raw events)
LAYER 1: CONVERSATION INTERFACE LAYER             ← merchant app + customer WhatsApp→PWA→app
```

- **Layer 1 — Interface:** Merchant = React Native (Expo) app. Customer = WhatsApp
  first, then a PWA "trojan horse" opened from a WhatsApp link, eventually a native app.
- **Layer 2 — Autonomous State Engine:** the moat. Event-driven microservices that
  *execute* business logic (negotiate, verify payment, dispatch riders, reorder stock).
  AI suggests; a deterministic **state machine** approves/rejects against hard rules.
- **Layer 3 — Enterprise Intelligence:** the "Scale AI of informal commerce." Three
  B2B data products (see below). Year-2 ARR target in the doc: ~$16.5M B2B + B2C.

### The four canonical autonomous workflows (BIBLO.docx, Layer 2)

1. **Autonomous Order Fulfillment** — customer message → intent → inventory lookup →
   priced quote → PWA checkout → virtual-account transfer → bank webhook verifies →
   inventory decremented → rider auto-dispatched → customer notified. Merchant does nothing.
2. **Demand-Driven Restocking** — inventory oracle predicts stockout → pings supplier
   on WhatsApp → negotiates → drafts PO → merchant taps "Approve."
3. **Customer Retention Engine** — nightly analyzer finds high-LTV at-risk customers →
   drafts culturally-nuanced re-engagement message → merchant approves or auto-sends.
4. **Multimodal Visual Resolution** — "the blue dress in your last reel" → CLIP embeddings
   over scraped social posts → resolves to a SKU → priced response.

### The three enterprise data products (Layer 3 — all spec-only today)

- **AI Training Data Marketplace** (`data-intelligence/ai-training-marketplace`) —
  dialect-rich conversation transcripts, RLHF eval sets, federated-learning compute rental.
- **FMCG Market Intelligence** (`data-intelligence/fmcg-intelligence`) — real-time demand
  heatmaps, price-elasticity, distribution-gap analytics for Unilever/Nestlé/P&G-type buyers.
- **TrustScore credit API** (`data-intelligence/trust-score-api`) — 300–850 alt-credit score
  for the unbanked from behavioral transaction signals.

The `negotiation_traces` table is the **seed of Layer 3** — every closed negotiation
records final price, margin, tactics used, and a price-elasticity signal.

## Repository layout (two generations — READ THIS)

There are **two parallel codebases**. Do not confuse them.

| Path | What it is | Status |
|---|---|---|
| `ace-whatsapp/` | **Phase 1 MVP — THE ACTIVE CODEBASE.** WhatsApp-only autonomous engine. | ~4,100 lines real TS, compiles clean, core loop works end-to-end. |
| `ace-platform/` | **Phase 2 vision** — multi-channel "Commerce OS" (Next.js web, gateway, channel adapters). | **Design only — READMEs, zero implementation.** Excluded from tsconfig. |
| `data-intelligence/` | Layer 3 enterprise products. | README/business spec only, no code. |
| `shared/` | Shared domain types + DB clients (`src/types.ts`, `src/clients.ts`). | Real, used by ace-whatsapp. |
| `infra/` | `schema.sql` (real DDL, ~9 tables), `seed.sql`. | Postgres schema real; Kafka/Qdrant/ClickHouse not provisioned. |
| `docs/` | Business + product + engineering prose. | Reference. |

**Rule of thumb:** all current engineering happens in `ace-whatsapp/` + `shared/` +
`infra/`. `ace-platform/` and `data-intelligence/` are roadmap, not running code.
`tsconfig.json` confirms this: it includes `shared/**` and `ace-whatsapp/**` and
**excludes** `ace-platform`, `data-intelligence`, and `ace-whatsapp/apps`.

## Stack at a glance (as-built, Phase 1)

- **Language/runtime:** Node.js + TypeScript (`tsx` for running, `tsc --noEmit` to check).
  *The doc specifies Rust; the MVP is TS, with pure-function modules written to be
  Rust-extraction-ready.*
- **HTTP:** Fastify (ingestion, payment, catalog-sync, merchant-api).
- **LLM:** Anthropic Claude via `@anthropic-ai/sdk` (doc/README target = Vercel AI SDK).
- **DB:** PostgreSQL via `postgres.js` (Neon-friendly). `OrderState` stored as JSONB.
- **Cache/queue:** Redis (`ioredis`) for debounce buffers, idempotency, distributed locks;
  **BullMQ** for the debounced conversation-turn queue.
- **Messaging:** WhatsApp Business Cloud API (Graph API).
- **Apps:** merchant-app = React Native + Expo; admin-portal = Vite + React (each has its
  own `package.json`, installed separately from the backend).

## Where things stand (2026-06-23)

**Works today (compiles + runs):** ingestion → debounce → AI negotiation (with hardened
pricing, circuit breaker, injection defense, tactics arc) → order state machine →
payment webhook verification → customer messaging. Merchant self-serve API (CRUD merchants,
products, pricing rules) + WhatsApp catalog import.

**Biggest gaps in the core loop:** the `escalate_to_merchant` tool writes an `escalations`
row but **no channel delivers it to the merchant** (Vendor Communiqué / SMS unbuilt);
logistics auto-dispatch, identity resolution (Global Buyer ID), intent-parser, visual
context, supplier integration are README-only. Zero automated tests. See
`progress-tracker.md` and `build-plan.md`.

See also: `architecture.md`, `build-plan.md`, `progress-tracker.md`,
`specific-function-assignment.md`, `code-standards.md`.