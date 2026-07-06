# Specific Function Assignment — ACE / Biblio

> Last updated: 2026-06-23. Per-module map of **what each unit owns and what remains**.
> This is the "who does what" reference so future work lands in the right module and
> respects the pure/impure split. Update when you add/move a function. Paths are under
> `ace-whatsapp/` unless noted.

## Legend
✅ implemented · 🟡 partial/stub-behavior · 🔲 not built

---

## ace-platform/services/channels/ (Omni-Channel Engine)
- `core/router.ts` ✅ — **Owns:** Central webhook chokepoint, passes payloads to channel adapters, triggers Identity Resolution, and hands off to Orchestrator.
- `core/egress.ts` ✅ — **Owns:** Omni-channel dispatch to correct platform adapter.
- `core/orchestrator.ts` ✅ — **Owns:** Intent parsing (stub) and delegation to AI Negotiator, Exceptions, or Visual Engine.
- `adapters/` & `senders/` 🟡 — **Owns:** Translation of WhatsApp, Instagram, Telegram, TikTok, Facebook, and Email into `UnifiedMessage`.

## shared/ (domain contracts)

- `src/types.ts` ✅ — single source of domain types. **Owns:** `Dialect`,
  `MerchantContext`, `Product`, `MessageContent`, `InboundMessage`, `ConversationTurn`,
  `OutboundMessage`, `OrderItem`, `OrderState` (union), `OrderEvent` (union). **Rule:**
  types-only, no runtime imports. Add new domain shapes here first.
- `src/clients.ts` ✅ — **Owns:** postgres.js pool, ioredis client, `jsonb()` cast helper.
- `ai-sdk/` 🔲 — planned Vercel AI SDK config, shared tools, training middleware, model
  registry, Zod intent schemas.
- `src/data-intelligence/engine.ts` ✅ — **Owns:** Centralized telemetry (`logNegotiationTrace`, `captureOrderStateChange`, `auditLog`). Feeds Layer 3 products.
- `src/state-engine/index.ts` ✅ — **Owns:** Wraps pure `transition()` with SQL persistence and data intelligence telemetry. Single source of OrderState mutation.
- `src/identity-resolution/index.ts` ✅ — **Owns:** Global Buyer ID provision and phone resolution.
- `src/auth/index.ts` ✅ — **Owns:** Multi-tenant JWT auth engine and Fastify route hooks.
- `src/background-jobs/index.ts` ✅ — **Owns:** BullMQ cross-cutting worker pool registry.

## core/ingestion-service/

- `src/index.ts` ✅ — **Owns:** Graph webhook (`GET` verify / `POST` receive), HMAC
  verify, Redis SETNX dedup, `extractMessages()` normalization, fast 200 ack,
  `enqueueInboundMessage()` call. **Remaining:** audio→Whisper queue, image→OCR queue,
  Kafka publish, template auto-select, service-window refresh on inbound.

## core/comms-router/

- `src/debounce.ts` ✅ — **Owns:** `enqueueInboundMessage`, `turnQueue`, `turnWorker`,
  per-customer scratch buffer drain, `resolveMerchantForCustomer()` (assumes 1:1 today),
  `loadOrderState()`. **Remaining:** multi-merchant resolution (needs identity-resolution).
- `src/outbound.ts` ✅ — **Owns:** `sendCustomerMessage` (the one send chokepoint),
  `classifyWindow`, `consolidate`. **Remaining:** outbound batching to ≤2.3 msgs/order.
- `src/whatsapp.ts` ✅ — **Owns:** `sendWhatsAppMessage` (backoff), `buildTextPayload`,
  `buildInteractivePayload` (≤3 buttons), `EscalationPriority`, `priorityForOrderValue`.
  **Remaining:** SMS/voice fallback senders (Twilio, Africa's Talking).
- **Vendor Communiqué engine** 🔲 — merchant SMS reply-code system, digest builder, quiet
  hours, `communique:{merchantId}:active` Redis session. **Not built — top priority (A2).**

## core/ai-negotiator/

- `src/agentLoop.ts` ✅ — **Owns:** `runNegotiatorTurn(turn)`, distributed lock
  (`lock:negotiation:{customerId}`), system-prompt builder (injects MerchantContext +
  arc), Claude tool loop (≤8 iters), arc load/persist (Redis 24h), terminal-arc →
  `buildNegotiationTrace` → DB insert, outbound via `sendCustomerMessage`.
  **Remaining:** Vercel AI SDK migration, dialect/sentiment signals, confidence score.
- `src/pricingService.ts` ✅ (PURE) — **Owns:** `resolveCustomerTier`,
  `computeAuthorizedRange`, `validateProposedPrice` (circuit breaker), `validateBundlePivot`,
  `scanForInjection`. Maps to future Rust `POST /pricing/{authorize,validate,detect}`.
- `src/negotiationArc.ts` ✅ (PURE) — **Owns:** `advanceArc` reducer, `availableTactics`
  guards, `projectRangeOntoArc`, `discountLocked`, `negotiationAttempts` (max 3).
  Stages: anchor→acknowledge→counter→close/pivot/escalate. 6 tactics.
- `src/tools.ts` ✅ — **Owns:** `toolDefinitions` + `executeTool` for: `check_inventory`
  (pg_trgm fuzzy), `get_customer_profile` (sums delivered orders via `state->>'total'`),
  `propose_price`, `deploy_tactic`, `close_deal` (→ QUOTE_CREATED), `escalate_to_merchant`
  (writes `escalations`), `issue_payment_link` (→ awaiting_payment; **VAN is random stub**).
  **Remaining:** real VAN (A4); escalation needs a delivery channel (A2).
- `src/negotiationTrace.ts` ✅ (PURE) — **Owns:** `outcomeForArc`, `buildNegotiationTrace`
  (final price/margin, `priceElasticitySignal`). Feeds Layer-3 data.
  **Remaining:** dialect field; Kafka publish to `negotiations.traces`.

## core/state-machine/

- `src/orderStateMachine.ts` ✅ (PURE) — **Owns:** `transition(state, event)`,
  `TransitionError`, `assertNever`. Enforces legal transitions + amount-match guard on
  PAYMENT_CONFIRMED. **Remaining:** `DISPUTED` state + `DISPUTE_RAISED`; escrow-release
  event on DELIVERED; confidence-based escalation; Kafka publish `orders.state_changed`.

## core/payment-verification/

- `src/index.ts` ✅ — **Owns:** `POST /payment/webhook`, sig verify, fast ack, SETNX
  dedup on `providerRef`, VAN→`awaiting_payment` order match, per-order lock,
  `transition(PAYMENT_CONFIRMED)`, single-tx state+ledger write, underpayment + unmatched
  handling, customer notify. **Remaining:** Kafka `payments.verified` (logistics consumes),
  micro-escrow, screenshot OCR fallback, the 15-min timer firing (A3).
- `src/paymentService.ts` ✅ (PURE) — **Owns:** `verifyWebhookSignature` (constant-time),
  `normalizePaymentEvent` (Paystack + ACE shapes), `classifyAmount`.

## core/catalog-sync/

- `src/index.ts` ✅ — **Owns:** `syncMerchantCatalog(merchantId)` (paginated Graph pull →
  upsert, preserves manual enrichment), HTTP `POST /sync/:merchantId`. **Remaining:**
  webhook-driven real-time sync.
- `src/catalogMapper.ts` ✅ (PURE) — **Owns:** `mapCatalogProduct`, `mapCatalogPage`,
  `parsePrice` (handles ₦/kobo/codes), `resolveStock`.

## core/merchant-api/

- `src/index.ts` ✅ — **Owns:** REST CRUD for merchants, products, pricing-rules; catalog-
  sync trigger; customer link; optional `x-api-key`. **Remaining:** per-merchant JWT auth,
  RLS enforcement.

## core/{identity-resolution, logistics-coordination, supplier-integration, visual-context}/

- `identity-resolution` ✅ — **Owns:** `resolveGlobalBuyerId(channel, platformId)` deterministic mapping. (B2)
- logistics-coordination 🔲 — `bookRider(order)` (Kwik/Gokada/MAX) on payment_verified → DISPATCHED. (B1)
- supplier-integration 🔲 — stockout predictor + supplier ping + PO draft. (B3)
- visual-context 🔲 — social scrape + CLIP embeddings → SKU resolve. (E4)

## ai/{intent-parser, data-refinement, training-pipeline}/

🔲 README only (Python/FastAPI + Airflow per doc). intent classification currently inline
in agentLoop. (B5 / Phase F)

## apps/ (see ui-registry.md for the screen-level map)

- merchant-app — settings ✅; catalog/command-center 🟡; auth/hub/financials 🔲.
- admin-portal — Merchant Management ✅; onboarding/AI-perf/health/billing 🔲.
- customer-pwa 🔲.

## infra/

- `schema.sql` ✅ (9 tables). 🔲 escrow_accounts, vendor_decisions, supplier_orders, RLS,
  partitioning, migrations/. `seed.sql` ✅.
- Kafka / Qdrant / ClickHouse 🔲 (config dirs are placeholders).