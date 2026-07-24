# ACE WhatsApp — Master Architecture Reference
> Internal context file. Updated as implementation progresses.
> Reconciles all service READMEs with actual code on disk.

---

## Service Inventory

| # | Service | README Stack | Our MVP Stack | Status |
|---|---------|-------------|---------------|--------|
| 1 | ingestion-service | Rust + Actix-web | TypeScript + Fastify | ✅ Built (TS) |
| 4 | state-machine | Rust | TypeScript pure functions | ✅ Built (TS) |
| 10 | comms-router | Rust | TypeScript + BullMQ | ✅ Partial (debounce + outbound) |
| 11 | ai-negotiator | Rust (rules) + TS (agent) | TypeScript (both layers) | ✅ Built (TS) |
| — | infra | 5-layer persistence | Postgres + Redis (MVP) | ⚠️ Partial |
| — | shared | Cross-cutting TS + Rust crates | TypeScript only | ⚠️ Partial |
| 2 | identity-resolution | (implied) Rust | Stub (phone = customerId) | 🔲 Phase 2 |
| 3 | intent-parser | Python/FastAPI | Inline in agentLoop | 🔲 Phase 2 |
| 5 | payment-verification | (implied) Rust | Stub virtual account | 🔲 Phase 2 |
| 6 | logistics-coordination | (implied) Rust | Not started | 🔲 Phase 2 |
| 7 | supplier-integration | (implied) Rust | Not started | 🔲 Phase 3 |
| 8 | visual-context | Python + CLIP | Not started | 🔲 Phase 3 |
| 9 | crm-retention | Not specified | Not started | 🔲 Phase 3 |

---

## The Full Data Flow (Message → Delivered)

```
Customer WhatsApp message
        │
        ▼
[1] ingestion-service         Fastify webhook, HMAC verify, idempotency dedup (Redis SETNX)
        │                     Publishes: MessageReceived → Kafka [PHASE 2]
        │                     MVP: calls enqueueInboundMessage() directly
        ▼
[10a] comms-router/debounce   BullMQ delayed job, sliding 10s window per customerId
        │                     Drains scratch buffer when customer goes quiet
        │                     Loads OrderState from Postgres
        ▼
[11] ai-negotiator             Loads NegotiationArc from Redis
        │                     Computes AuthorizedPriceRange (pricingService.ts)
        │                     Builds arc-aware system prompt
        │                     Claude tool-use loop (MAX 8 iterations)
        │                       → check_inventory
        │                       → get_customer_profile
        │                       → propose_price → pricingService.validateProposedPrice()
        │                       → deploy_tactic → negotiationArc.availableTactics() guard
        │                       → close_deal → orderStateMachine.transition()
        │                       → escalate_to_merchant → (escalations table + Kafka [P2])
        │                       → issue_payment_link
        ▼
[4] state-machine              Pure TS reducer. transition(state, event) → state | Error
        │                     Guards: QUOTE_CREATED, PAYMENT_LINK_ISSUED, PAYMENT_CONFIRMED
        │                     amount-match guard on PAYMENT_CONFIRMED
        ▼
[10b] comms-router/whatsapp    sendWhatsAppMessage() → Graph API with exponential backoff retry
        │
        ▼
Customer receives reply on WhatsApp
```

---

## The Two Parallel State Machines

This is the most important architectural concept in the codebase. Two machines run in parallel, tracking different dimensions of the same conversation.

### OrderStateMachine (`core/state-machine/src/orderStateMachine.ts`)
**What it tracks:** What has HAPPENED to the order (financial/logistics facts)
```
no_order → draft → awaiting_payment → payment_verified → out_for_delivery → delivered
                                    ↘ cancelled (from draft, awaiting_payment)
```
Persisted in: **Postgres** `orders.state` (JSONB)
Key guard: `PAYMENT_CONFIRMED.amount === state.total` — rejects mismatched payments

### NegotiationArc (`core/ai-negotiator/src/negotiationArc.ts`)
**What it tracks:** Where we are STRATEGICALLY in the negotiation
```
anchor → acknowledge → counter → close
                     ↘ pivot (bundle/credit) → escalate
                                             → abandoned
```
Persisted in: **Redis** `arc:{merchantId}:{customerId}` — 24h TTL
Key guards: bundlePivotAttempted, futureCreditAttempted, scarcitySignalDeployed, stock ≤ 3

---

## The Security Boundary

**The LLM can ONLY affect the world through tools in `tools.ts`.**

Every state-changing tool has a validation layer it cannot bypass:
- `propose_price` → `pricingService.validateProposedPrice()` (floor check + injection detection)
- `deploy_tactic` → `negotiationArc.availableTactics()` guard re-runs (not just prompted)
- `close_deal` → `orderStateMachine.transition(QUOTE_CREATED)` + floor check
- `escalate_to_merchant` → hard gate: `bundlePivotAttempted && futureCreditAttempted`

The model has no direct DB access, no ability to set prices in text, no way to mark payment confirmed.

---

## Stack Divergences from READMEs

These are deliberate Phase 1 simplifications, not bugs. Each has an extraction path.

| README Spec | MVP Implementation | Why | Extraction Trigger |
|---|---|---|---|
| Rust (ingestion-service) | TypeScript + Fastify | Faster iteration, same webhook semantics | >5k msgs/sec sustained |
| Rust (state-machine) | TS pure functions (`transition()`) | Pure functions = identical contract, extractable | When Rust pricing service is written |
| Rust (comms-router) | TypeScript + BullMQ | BullMQ is production-grade, queue API is stable | When multi-region delivery SLA matters |
| Rust (ai-negotiator rules) | TypeScript (`pricingService.ts`) | Pure functions, zero async, same interface as planned Rust HTTP API | First — write this service in Rust as a `POST /pricing/*` HTTP service |
| Kafka (event bus) | Direct function calls | No Kafka infra needed for single-process MVP | When adding second service that needs to react to `orders.state_changed` |
| Qdrant (conversation memory) | Not implemented | Requires embedding pipeline | When "remember customer context across weeks" becomes a user complaint |
| ClickHouse (analytics) | Not implemented | No data volume to warehouse | When FMCG dashboard is sold to first enterprise buyer |

---

## Files Written vs. READMEs

### ingestion-service ✅
- `core/ingestion-service/src/index.ts` — webhook receiver, HMAC verify, dedup, message extraction
- Missing from README: Media processing queue (voice→Whisper, image→OCR), Service Window Optimizer, Kafka publish

### comms-router ✅ partial
- `core/comms-router/src/debounce.ts` — BullMQ sliding debounce, scratch buffer, turn assembly
- `core/comms-router/src/whatsapp.ts` — outbound send, retry, EscalationPriority enum
- Missing from README: Customer-facing fallback (SMS/voice via Twilio/Africa's Talking), Vendor Communiqué engine, SMS reply-code processor, Service Window Optimizer, Message Consolidation Engine, Quiet Hours logic, Digest Builder

### state-machine ✅
- `core/state-machine/src/orderStateMachine.ts` — pure transition reducer, assertNever exhaustiveness, TransitionError
- Missing from README: Confidence-based escalation (AI confidence < 0.80), DISPUTED state, escrow release trigger, 30-45s debounce (handled in comms-router instead)

### ai-negotiator ✅
- `core/ai-negotiator/src/pricingService.ts` — AuthorizedPriceRange, validateProposedPrice, injection detection, BundleValidation
- `core/ai-negotiator/src/negotiationArc.ts` — ArcStage, NegotiationTactic, advanceArc, availableTactics guards
- `core/ai-negotiator/src/tools.ts` — 7 tools with guards, pricing validation, arc advancement
- `core/ai-negotiator/src/agentLoop.ts` — arc-aware loop, arc Redis persistence, finalizeTurn
- Missing: NegotiationTrace persistence to `negotiation_traces` table on arc terminal state, priceElasticitySignal computation, dialect field

### shared ✅ partial
- `shared/src/types.ts` — InboundMessage, ConversationTurn, OrderState, OrderEvent, OutboundMessage
- `shared/src/clients.ts` — postgres.js client, ioredis client
- Missing from README: event-schemas/ (Kafka), proto/ (gRPC), ai-sdk/ (Vercel AI SDK config), common/ Rust crates

### infra ✅ partial
- `infra/schema.sql` — merchants, customer_merchant_links, products, orders, escalations, merchant_pricing_rules, negotiation_traces
- Missing from README: RLS policies, hash partitioning (64 buckets), Qdrant collections, Kafka topic definitions, ClickHouse tables + materialized views, migrations directory

---

## Open Design Questions

1. ~~**productSku = "TBD"**~~ ✅ FIXED (v3) — `deploy_tactic` schema now requires `productSku` explicitly. `rangeUpdate` from `check_inventory` updates `arc.productSku` in the tool loop.

2. ~~**authorizedRange with basePrice=0**~~ ✅ FIXED (v3) — Range starts as sentinel (`floor=Infinity`). Reactively recomputed after `check_inventory` returns real price via `rangeUpdate`. Circuit breaker now correctly blocks all proposals until real data arrives.

3. ~~**Arc tier bootstrap**~~ ✅ FIXED (v3) — `rangeUpdate` from `get_customer_profile` sets `currentTier`. Arc tier and anchor/floor updated inside tool loop before next tool call.

4. ~~**Distributed lock gap**~~ ✅ FIXED (v3) — `lock:negotiation:{customerId}` Redis SETNX at turn start, released in `finally`. Contending turns are dropped with a log warning.

5. ~~**NegotiationTrace not flushed**~~ ✅ FIXED (v3) — `finalizeTurn()` calls `flushNegotiationTrace()` when `arc.outcome` is set (terminal stages). Writes to `negotiation_traces` table with `ON CONFLICT DO NOTHING` (idempotent).

6. ~~**Service Window not checked**~~ ✅ FIXED (v3) — `ingestion-service` sets `conv:{customerId}:window = timestamp+24h` on every inbound. `agentLoop.checkServiceWindow()` reads it before every send.

## Remaining Phase 2 Gaps (not bugs, genuine new features)
- `tactics_succeeded` field in NegotiationTrace is empty — requires post-hoc analysis of whether a deployed tactic preceded deal close
- `dialect` field on NegotiationTrace — needs intent-parser classification
- Vendor Communiqué SMS delivery (escalations currently go to Postgres only)
- WhatsApp template message fallback when service window is closed