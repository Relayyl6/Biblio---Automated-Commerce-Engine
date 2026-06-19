# ACE WhatsApp — Service Gap Tracker
> What each README specified. What's built. What's next.
> Update this file as each gap is closed.
>
> **Status legend:** ✅ Built = code exists on disk and is non-empty.
> 🟡 Specified-not-written = file exists but is a 0-byte stub. 🔲 = not started.
> _Last reconciled against disk: 2026-06-19._

> ### ✅ Build status: COMPILES CLEAN (`tsc --noEmit` → 0 errors)
> The entire Phase-1 critical path is built and typechecks. `package.json` +
> `tsconfig.json` exist. The negotiation → order → **payment** loop runs
> end-to-end against the seeded catalog (`infra/seed.sql`).
>
> **Audit fixes applied (2026-06-19):**
> - `agentLoop.ts` — removed a ~510-line commented-out duplicate; fixed 6 compile
>   errors (phantom `arc.outcome`/`arc.finalPrice` reads → wired in the pure
>   `negotiationTrace.ts`; `sql.json` casts → `jsonb()` helper). The
>   `negotiation_traces` table is now actually written (the old `if (arc.outcome)`
>   gate was always false → silent data loss). Outbound now routes through the
>   `sendCustomerMessage` chokepoint instead of a duplicate window check.
> - `tools.ts` — fixed two runtime SQL bugs `tsc` can't see: `checkInventory`
>   selected a non-existent `products.floor_price`; `getCustomerProfile` selected
>   columns off the wrong table and read `o.total` instead of `o.state->>'total'`.
>
> **Runnable now:** `npm run ingestion` (webhook + queue + worker + negotiator)
> and `npm run payment` (bank/PSP webhook → state machine). See `.env.example`.

---

## ingestion-service (README: Rust + Actix-web → MVP: TypeScript + Fastify)

### 🟡 Specified, not yet written
`core/ingestion-service/src/index.ts` is a **0-byte stub** — none of the
below is implemented in code yet. This is the design intent for that file:
- Fastify webhook receiver on `/webhook` GET (verification) + POST (messages)
- HMAC-SHA256 signature verification with `timingSafeEqual`
- Redis SETNX idempotency dedup (24h TTL, key: `idempotency:wa_msg:{waMessageId}`)
- Message normalization: text, audio, image, interactive → `InboundMessage`
- Immediate 200 ack before processing (prevents Meta retries)
- Direct call to `enqueueInboundMessage()` (BullMQ)

### 🔲 Phase 2 Gaps (from README)
- **Kafka publish** — `MessageReceived` event. Currently calls BullMQ directly. When Kafka is added, ingestion-service publishes to `messages.received` topic and comms-router subscribes.
- **Voice note → Whisper queue** — audio messages currently pass through as `[voice note]` placeholder in agentLoop. Need: media download from Graph API, upload to Whisper job queue.
- **Image → OCR queue** — payment screenshots (bank transfer confirmation images). Customer sends photo of Interac/bank transfer. OCR extracts amount + reference for payment-verification service.
- **Service Window Optimizer** — on every inbound message, set/refresh `conv:{customerId}:window = timestamp + 24h` in Redis. Outbound sender reads this to decide template vs. session message (₦0.003 vs ₦0.01).
- **Message Consolidation Engine** — README target: ≤ 2.3 messages per order. This is the outbound batching complement to the inbound debounce. Multiple outbound commands within a short window are coalesced into one WhatsApp message. Currently each `sendWhatsAppMessage()` call sends immediately.
- **Template auto-selection** — WhatsApp charges differently for template vs. conversational messages. Ingestion-service (or comms-router) should check service window before every outbound send.

### Key Metrics (from README, not yet tracked)
- Messages per completed order (target: ≤ 2.3)
- % conversations in free service window (target: ≥ 78%)
- Meta API cost per merchant per month (target: < $2.50)

---

## comms-router (README: Rust → MVP: TypeScript + BullMQ)

### ✅ Built
- **Inbound debounce** (`debounce.ts`) — BullMQ sliding window, scratch buffer, `resolveMerchantForCustomer()`, `loadOrderState()`

### 🟡 Specified, not yet written
- **Outbound send** (`whatsapp.ts`) — **0-byte stub.** `debounce.ts` and
  `agentLoop.ts` both import `sendWhatsAppMessage` from this file, so the
  build is broken until it exists. Design intent: Graph API caller,
  interactive button builder, exponential backoff retry (3 attempts),
  `EscalationPriority` enum.

### 🔲 Phase 2 Gaps — Part A: Customer-Facing Fallback
Full Vendor Communiqué engine not started. Trigger conditions:
- WhatsApp delivery receipt not received within 5 minutes → SMS fallback
- Customer unresponsive > 2 hours on active order → priority-based escalation
- Payment timeout approaching (< 3 min on 15-min window) → SMS/voice

Priority routing table (from README):
```
> ₦50,000   → AI voice call (Twilio programmable voice)
₦20k-₦50k  → Premium SMS (Africa's Talking preferred)
₦5k-₦20k   → Standard SMS
< ₦5k       → Wait for WhatsApp reconnection
```
Integrations needed: Twilio (SMS + voice), Africa's Talking (Nigeria-optimised), Infobip (fallback)

### 🔲 Phase 2 Gaps — Part B: Vendor Communiqué Engine
This is the SMS reply-code system for merchant decisions.

**Redis key needed:** `communique:{merchantId}:active` (4h TTL) — stores active communiqué session

**Communiqué types:**
| Type | Default Channel |
|---|---|
| Negotiation exception (below-floor) | SMS reply-code |
| Restock approval | SMS reply-code |
| High-value new customer | SMS reply-code |
| Payment anomaly | SMS (emergency, overrides quiet hours) |
| Order completion | WhatsApp |
| Daily morning digest | WhatsApp |
| Weekly performance summary | App push |
| AI voice call (> ₦50K exceptions) | Voice |

**SMS reply processor:** Inbound SMS (from merchant's phone) → resolve merchant by phone → look up active communiqué session in Redis → parse reply (handles "1", "Yes", "Y", "Approve") → publish `vendor.decisions` to Kafka → send confirmation SMS → return `VendorDecision`.

**Digest Builder:** Morning briefing: revenue yesterday, orders completed, orders pending, awaiting payment, stock alerts, VIP alerts, actions needed.

**Quiet Hours:** Merchant-configured. Emergency types bypass. Non-emergency respects merchant timezone.

### 🔲 Phase 2 Gaps — Infrastructure
- Africa's Talking SDK integration
- Twilio SDK integration
- Separate sender IDs for customer vs. merchant SMS
- Push notification service (for merchant app)

---

## state-machine (README: Rust → MVP: TypeScript pure functions)

### 🟡 Specified, not yet written
`core/state-machine/src/orderStateMachine.ts` is a **0-byte stub.** Design intent:
- Pure `transition(state, event): OrderState | throws TransitionError` reducer
- All 7 states: no_order, draft, awaiting_payment, payment_verified, out_for_delivery, delivered, cancelled
- `assertNever` exhaustiveness check (compile-time safety)
- `TransitionError` with fromStatus + eventType for debugging
- Amount-match guard on `PAYMENT_CONFIRMED`

### 🔲 Phase 2 Gaps
- **DISPUTED state** — README shows `DELIVERED → DISPUTED` (customer raises claim within 24h). Add state + `DISPUTE_RAISED` event to the union.
- **Escrow release trigger** — `DELIVERED` should emit an event that triggers payment-verification to release escrow to merchant. Currently `DELIVERED` is a terminal state with no downstream effect.
- **Confidence-based escalation** — README: escalate when AI confidence < 0.80. The current arc has no confidence score. Phase 2: intent-parser (Python) emits a confidence score alongside the classified intent; state machine checks it before approving the transition.
- **Rust extraction** — when payment-verification service is written in Rust, the state machine moves to Rust. The TS `transition()` function is the spec — each case maps directly to a Rust `match` arm.
- **Kafka publish** — every approved transition should publish `orders.state_changed` to Kafka. All downstream services (payment, logistics, comms-router) consume this event rather than being called directly.

---

## ai-negotiator (README: Rust rules + TS agent → MVP: TypeScript both)

### ✅ Built
- `pricingService.ts` — pure functions: `resolveCustomerTier`, `computeAuthorizedRange`, `validateProposedPrice`, `validateBundlePivot`, injection detection
- `agentLoop.ts` v2 — arc-aware loop, arc Redis persistence (24h TTL), `loadOrCreateArc`, `finalizeTurn`

### 🟡 Specified, not yet written (imported by `agentLoop.ts` — build is broken until these exist)
- `negotiationArc.ts` — **0-byte stub.** Design intent: `ArcStage`, `NegotiationTactic`, `advanceArc` reducer, `availableTactics` guards. `agentLoop.ts` imports `availableTactics` and `NegotiationArc` from here.
- `tools.ts` v2 — **0-byte stub.** Design intent: 7 tools (check_inventory, get_customer_profile, propose_price, deploy_tactic, close_deal, escalate_to_merchant, issue_payment_link) plus `executeTool`, `toolDefinitions`, `ToolContext`. `agentLoop.ts` imports all three from here.

### 🔲 Known Issues (Open Design Questions from ARCHITECTURE.md)
1. **productSku = "TBD"** — arc needs real SKU before `deploy_tactic` can call `getCurrentStock()`. Fix: add `sku` to `deploy_tactic` tool schema OR update arc in agent loop when `check_inventory` returns.
2. **authorizedRange with basePrice=0** — `computeAuthorizedRange()` runs before product is known. Fix: defer to after `check_inventory` tool result; update `ctx.authorizedRange` inside the tool loop.
3. **Arc tier bootstrap** — arc starts as `tier: "new"`. Fix: update `ctx.arc.tier` inside the tool loop when `get_customer_profile` returns.
4. **Distributed lock gap** — two concurrent `runNegotiatorTurn()` calls possible. Fix: `lock:negotiation:{customerId}` Redis SETNX before turn start.
5. **NegotiationTrace not flushed** — `negotiation_traces` table exists but nothing writes to it. Fix: `finalizeTurn()` should detect terminal arc stage and write trace.
6. **Service Window not checked** — outbound messages sent without checking 24h window remaining.

### 🔲 Phase 2 Gaps
- **Rust PricingService extraction** — `pricingService.ts` → Rust HTTP service at `POST /pricing/authorize`, `POST /pricing/validate`, `POST /pricing/detect`. The TS functions are the spec.
- **Kafka publish** — `negotiations.traces` topic (for ClickHouse + training pipeline), `negotiations.escalations` topic (for Vendor Communiqué trigger).
- **Dialect field** on NegotiationTrace — intent-parser will classify dialect (Yoruba-inflected, Igbo-inflected, Pidgin, etc.). Threading this through from ingestion → negotiation → trace is Phase 2 work.
- **Sentiment scoring** — Tactic 6 (Soft Close) is "reads sentiment score". Currently the model decides this from conversation text. Phase 2: dedicated sentiment signal from intent-parser.
- **Vercel AI SDK migration** — README specifies Vercel AI SDK. Current implementation uses Anthropic SDK directly. Migration path: Vercel AI SDK wraps Anthropic, provides `streamText`, `generateObject`, training middleware. Switch when: (a) you want provider-agnostic tool-use, or (b) you need the training middleware to capture interactions to Kafka automatically.
- **`ai/intent-parser`** — currently intent classification is done inside the Claude call in `agentLoop.ts`. Phase 2 separates this into a Python/FastAPI service with a fine-tuned model for dialect normalization and cheaper triage.

---

## payment-verification (README: Rust → MVP: TypeScript + Fastify)

### ✅ Built (2026-06-19)
- `paymentService.ts` — pure: `verifyWebhookSignature` (HMAC-SHA256, constant-time),
  `normalizePaymentEvent` (ACE-canonical + Paystack-shaped → `NormalizedPayment`),
  `classifyAmount`.
- `index.ts` — Fastify webhook `POST /payment/webhook`: signature verify →
  immediate 200 ack → Redis SETNX dedupe → match VAN to `awaiting_payment` order →
  per-order lock → `transition(PAYMENT_CONFIRMED)` (amount-match guard reused from
  the state machine) → persist state + ledger row in one tx → notify customer.
  Handles underpayment (records + asks for balance, stays awaiting_payment) and
  unmatched funds (logs for manual recon).
- `transactions` table + `orders_virtual_account_idx` added to `infra/schema.sql`.

### 🔲 Phase 2 Gaps
- **Virtual account generation** — currently the VAN is minted in
  `ai-negotiator/tools.ts:issuePaymentLink` as a random number. Replace with real
  Providus/Wema/Sterling provisioning via the partner FinTech API.
- **`payments.verified` Kafka publish** — logistics consumes it to auto-book a
  rider (`payment_verified → out_for_delivery`); escrow opens the 24h hold.
- **Micro-escrow engine** — `escrow_accounts` table + release triggers
  (delivery GPS / customer confirm / 24h timeout). Table not yet created.
- **Screenshot OCR fallback** — Vision AI path for legacy bank-transfer images
  (< 95% confidence → merchant review).
- **15-min payment timer** — `order:{orderId}:timer` is cleared on confirm here,
  but nothing yet SETS it / fires the auto-reminder on expiry.

---

## infra (README: 5-layer persistence → MVP: Postgres + Redis)

### ✅ Built (Postgres schema)
Tables: merchants, customer_merchant_links, products (with pg_trgm), orders, escalations, merchant_pricing_rules, negotiation_traces

### 🔲 Missing from schema
- ~~`transactions` table (payment ledger)~~ — ✅ added 2026-06-19 (+ `orders_virtual_account_idx`)
- `escrow_accounts` table
- `vendor_decisions` table
- `supplier_orders` table
- RLS policies (all tables need `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` + policy per README spec)
- Hash partitioning (64 buckets by merchant_id) on large tables
- `migrations/` directory structure (README: sqlx migrations)

### 🔲 Phase 2: Qdrant
Collections needed:
- `conversations` — sentence-BERT (dialect-tuned), dim 768 — long-term customer recall
- `visual_products` — CLIP/ViT, dim 512 — "that dress in your reel" → SKU resolution
Each merchant isolated in a Qdrant namespace.

### 🔲 Phase 2: Kafka
Topics needed (from infra README):
`messages.received`, `intents.classified`, `orders.state_changed`, `payments.verified`, `riders.dispatched`, `orders.delivered`, `negotiations.traces`, `negotiations.escalations`, `vendor.decisions`, `inventory.low_stock`, `commerce.events.product_intel`, `commerce.events.transactions`, `training.interactions.raw`, `training.interactions.clean`, `merchant.signals.behavioral`

Partition key: always `merchant_id`.
Event schemas live in `shared/event-schemas/`.

### 🔲 Phase 3: ClickHouse
Tables: product_transactions, demand_signals, negotiation_analytics, merchant_performance, customer_segments, stockout_events, supplier_performance
Key view: `demand_by_sku_geo_week` (materialized, pre-computed for FMCG dashboard)

---

## shared (README: TS + Rust crates → MVP: TypeScript only)

### ✅ Built
- `shared/src/clients.ts` — postgres.js (Neon-optimised pool), ioredis

### 🟡 Specified, not yet written (the foundational type module — nearly every other file imports from it)
- `shared/src/types.ts` — **0-byte stub.** Design intent: InboundMessage, ConversationTurn, OrderState/Event discriminated unions, OutboundMessage. `agentLoop.ts`, `debounce.ts`, and `whatsapp.ts` all import types from here, so this is the single highest-leverage file to write first.

### 🔲 Phase 2 Gaps
- `shared/ai-sdk/` — Vercel AI SDK config, shared tool definitions, training middleware (captures every AI interaction to Kafka `training.interactions.raw`), model registry, intent schema (Zod), provider config
- `shared/proto/` — gRPC proto files: intent.proto, pricing.proto, inventory.proto, logistics.proto, payment.proto, identity.proto
- `shared/event-schemas/` — Avro/JSON Schema for all 15 Kafka topics (the immutable contracts between services)
- `shared/ai-models/` — model artifact registry (dialect BERT, Whisper fine-tune, CLIP/ViT)
- `shared/common/` Rust crates — shared error types, logging, validation helpers for Rust services