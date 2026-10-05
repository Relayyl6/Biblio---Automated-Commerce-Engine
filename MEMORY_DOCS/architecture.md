# Architecture — ACE WhatsApp (Phase 1.5, as-built) + intended direction

> Last updated: 2026-10-05. Reconciles `BIBLO.docx`, `ace-whatsapp/ARCHITECTURE.md`,
> and the actual code on disk. Where the doc and code disagree, the **code is the
> current truth** and the divergence is flagged as a roadmap item.

## Architectural philosophy (from the doc, honored by the code)

1. **Event-driven, not request-response.** Continuous message stream → AI interprets
   intent → deterministic state machine validates → autonomous execution.
2. **AI suggests, rules decide.** The LLM never writes financial state directly. It
   *requests* actions via tools; pure rule modules (pricing, state machine) approve or
   reject. This is the moat and the safety model.
3. **Pure core, impure edges.** Business logic lives in pure, side-effect-free,
   unit-testable functions (`pricingService`, `negotiationArc`, `orderStateMachine`,
   `paymentService`, `catalogMapper`). I/O (HTTP, DB, Redis, Graph API) lives in thin
   adapters. The pure modules are written to be **ported to Rust** later (the doc's
   target stack).
4. **Idempotency everywhere.** Redis `SETNX` dedup on WhatsApp `wamid` and payment
   `providerRef`; distributed locks per customer/order to prevent concurrent-turn races.

## As-built service map (`ace-whatsapp/core/*`)

```
WhatsApp ──webhook──▶ ingestion-service ──enqueue──▶ comms-router/debounce (BullMQ)
                                                              │  (window closes ~10s)
                                                              ▼
                                                       ai-negotiator/agentLoop
                                          ┌───────────────────┼───────────────────┐
                                          ▼                   ▼                   ▼
                                   pricingService       negotiationArc          tools
                                  (authorized range)  (stage + tactics)   (check_inventory,
                                   circuit breaker      pure reducer       propose_price, …)
                                          │                   │                   │
                                          └──────────┬────────┴───────────────────┘
                                                     ▼
                                            state-machine.transition()   ← validates order events
                                                     │
                                   ┌─────────────────┼─────────────────┐
                                   ▼                 ▼                 ▼
                            comms-router/outbound  Postgres        escalations table
                            → whatsapp.ts (Graph)  (orders,        (⚠ no delivery channel yet)
                                                    traces, txns)

Bank/PSP ──webhook──▶ payment-verification ──▶ state-machine.transition(PAYMENT_CONFIRMED)
                                                     │
                                                     ▼  persist state + ledger row (1 tx)
                                              notify customer (comms-router)
                                                     │
                                                     ▼
                                       shared/data-intelligence/engine (Layer 3)

merchant-app / admin-portal ──HTTP──▶ merchant-api (CRUD merchants, products, rules,
                                                     catalog-sync trigger)
catalog-sync: Meta Catalog API ──pull──▶ map ──upsert──▶ products table
```

### Service responsibilities (as-built, Phase 1.5)

| Service | Role | Key exports | Status |
|---|---|---|---|
| `ingestion-service` | Fastify webhook; verify HMAC; dedup; normalize → `InboundMessage`; ack 200 fast; enqueue to BullMQ `inbound-webhooks`. | webhook handlers, `extractMessages()` | ✅ works |
| `comms-router/debounce` | Per-customer sliding-window batch (Redis + delayed BullMQ job); on close, load merchant+order, call negotiator. | `enqueueInboundMessage`, `turnQueue`, `turnWorker` | ✅ works |
| `comms-router/outbound` | Single send chokepoint; classify service window (free vs billable); consolidate fragments. | `sendCustomerMessage`, `classifyWindow`, `consolidate` | ✅ works |
| `comms-router/whatsapp` | Graph API sender; exponential backoff; interactive buttons (≤3, 20-char titles). | `sendWhatsAppMessage`, `priorityForOrderValue` | ✅ works |
| `ai-negotiator/agentLoop` | Per-turn orchestrator; distributed lock; Groq tool loop (≤8 iters); arc persistence (Redis 24h); flush trace on terminal arc. | `runNegotiatorTurn` | ✅ works |
| `ai-negotiator/biblioAgentLoop` | Vendor command router (two-stage: router LLM → sub-agent LLM); sends reply to vendor's WhatsApp. | `runBiblioAgentTurn` | ✅ works |
| `ai-negotiator/tools` | 1,073-line customer-facing tool dispatcher (12 tools). `bookAppointment` now wires Google Calendar + WhatsApp confirmation + BullMQ reminder + OAuth alert to vendor. | `executeTool`, `toolDefinitions` | ✅ works |
| `ai-negotiator/tools/` | 109 vendor-facing tools across 10 files: analytics, booking, crm, finance, integration, inventory, marketing, negotiation, order, settings. All handlers have real SQL + external API logic. | `*Tools`, `*Handlers` per file | ✅ works |
| `ai-negotiator/pricingService` | Pure rules: tier resolution, authorized range, circuit-breaker. | `resolveCustomerTier`, `computeAuthorizedRange`, `validateProposedPrice` | ✅ works |
| `ai-negotiator/negotiationArc` | Pure reducer for negotiation stage + tactic legality + rate-limit (max 3 offers). | `advanceArc`, `availableTactics`, `discountLocked` | ✅ works |
| `ai-negotiator/negotiationTrace` | Pure builder for the enterprise `negotiation_traces` row. | `buildNegotiationTrace` | ✅ works |
| `state-machine/orderStateMachine` | Pure `transition(state,event)`; 7 states; amount-match guard on PAYMENT_CONFIRMED. | `transition`, `TransitionError` | ✅ works |
| `payment-verification/index` | Fastify webhook; verify sig; dedup; match VAN→order; lock; transition; persist state+ledger; idempotency guard (`WHERE status != 'paid'`). | Fastify app | ✅ works |
| `payment-verification/paymentService` | Pure: HMAC verify, normalize Paystack/ACE shapes, classify amount. | `verifyWebhookSignature`, `normalizePaymentEvent`, `classifyAmount` | ✅ works |
| `catalog-sync` | Pull Meta catalog (paginated) → map → upsert products. | `syncMerchantCatalog`, `mapCatalogProduct` | ✅ works |
| `merchant-api` | Fastify REST: merchants/products/pricing-rules CRUD, catalog-sync trigger, customer link. | Fastify app | ✅ works |
| `event-orchestrator` | Graceful-shutdown BullMQ worker host for: abandonedCart, postPayment, postServiceReview, inventoryRestock, loyaltyMilestone. | 5 flow workers | ✅ works |
| `baileys-gateway` | Baileys v7 edge service for vendor personal numbers. Session management, inventory parser, status poster, message classifier. | — | ✅ works |
| `shared/src/integrations/googleCalendar.ts` | Raw-fetch Google Calendar API: create/delete events, check freebusy, auto-refresh tokens from `merchant_integrations` table. | `createCalendarEvent`, `checkFreeBusy`, `refreshGoogleTokens` | ✅ works |
| `identity-resolution` | Global Buyer ID clustering (fuzzy phone/name match). | — | ✅ works |
| `logistics-coordination` | Auto-book riders (Kwik/Gokada/MAX) on payment_verified. | — | 🔲 README only |
| `supplier-integration` | Demand spike → ping supplier WhatsApp → draft PO. | — | 🔲 README only |
| `visual-context` | Social scrape + CLIP embeddings → SKU resolution. | — | 🔲 README only |

## Domain model (the contracts — `shared/src/types.ts`)

- `Dialect` = pidgin | yoruba | igbo | hausa | english
- `MerchantContext` — the AI's "voice" + catalog owner.
- `Product` — sku, name, stock, price, currency, tags, attributes, imageUrl, …
- `MessageContent` — discriminated union: text | audio | image | interactive.
- `InboundMessage` — normalized WhatsApp message; `waMessageId` is the idempotency key.
- `ConversationTurn` — debounced batch + the order state it's evaluated against.
- `OrderState` — **discriminated union on `status`**, stored as one JSONB column:
  `no_order → draft → awaiting_payment → payment_verified → out_for_delivery → delivered`
  (+ `cancelled`). Terminal: delivered, cancelled.
- `OrderEvent` — QUOTE_CREATED, PAYMENT_LINK_ISSUED, PAYMENT_CONFIRMED, DISPATCHED,
  DELIVERED, CANCELLED.

**Narrowing rule:** switch on `OrderState.status` / `MessageContent.type` and let the
compiler enforce exhaustiveness (`assertNever`). Never add an order field without adding
it to the union here first — every consumer reads off these shapes.

## Data layer (`infra/schema.sql`)

Tables (real): `merchants`, `customer_merchant_links`, `products` (pg_trgm trigram index
for fuzzy `check_inventory`), `orders` (`state` JSONB + expression index on
`state->>'virtualAccountNumber'` for payment lookup), `transactions` (ledger;
`provider_ref` idempotency), `escalations`, `merchant_pricing_rules`, `negotiation_traces`.

Missing from schema (roadmap): `escrow_accounts`, `vendor_decisions`, `supplier_orders`,
RLS policies on every table, hash partitioning by `merchant_id`, sqlx-style `migrations/`.

## Intended-but-not-built infrastructure (the doc's full vision)

- **Kafka** event spine (15 topics; partition key always `merchant_id`). Today services
  call each other directly / via BullMQ. The state machine should publish
  `orders.state_changed`; payment should publish `payments.verified` (logistics consumes).
- **Qdrant** vector DB — `conversations` (768-dim, long-term recall) + `visual_products`
  (512-dim CLIP). Per-merchant namespaces.
- **ClickHouse** warehouse — FMCG demand dashboards, negotiation analytics.
- **Rust** services (Actix-web, Tokio, SQLx, Tonic) — the doc's mission-critical target;
  TS pure modules are the spec for the eventual port.
- **Python/FastAPI** `intent-parser` (Whisper → dialect BERT → GPT-4o). Today intent is
  handled inline inside the Claude call in `agentLoop`.

## Key design decisions & invariants (do not violate)

1. **The LLM cannot set a price below the merchant floor.** `validateProposedPrice`
   enforces the circuit breaker; below-floor → pivot/alternative/escalate. (BIBLO Risk 2.)
2. **Payment confirmation comes ONLY from a verified bank/PSP webhook**, never from AI
   reading a screenshot or the customer's word. Amount-match guard in the state machine.
3. **Every inbound message is deduped** (`wamid`) and **every turn is debounced** so the
   customer gets one coherent reply, not three.
4. **Outbound goes through one chokepoint** (`sendCustomerMessage`) so service-window
   cost classification and consolidation always apply (target ≤ 2.3 msgs/order).
5. **Negotiation is rate-limited** (max 3 agent offers) to prevent infinite haggling.
6. **Pure modules have zero runtime imports** beyond `shared/src/types.ts` (types-only).

## Open architectural questions (decide before Phase 2)

- When to introduce Kafka (decouples services; needed before multi-channel `ace-platform`).
- Whether `ace-platform` supersedes `ace-whatsapp` or wraps it (the platform docs say it
  *imports* the Phase-1 negotiator wholesale — treat ace-whatsapp as the engine).
- Rust extraction trigger (throughput? team? — defer until TS proves the model).