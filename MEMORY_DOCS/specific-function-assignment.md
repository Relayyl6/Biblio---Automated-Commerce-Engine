# Specific Function Assignment — ACE / Biblio

> Last updated: 2026-10-05. Per-module map of **what each unit owns and what remains**.
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

- `src/types.ts` ✅ — single source of domain types. **Owns:** `Dialect`, `MerchantContext`, `Product`, `MessageContent`, `InboundMessage`, `ConversationTurn`, `OutboundMessage`, `OrderItem`, `OrderState` (union), `OrderEvent` (union). **Rule:** types-only, no runtime imports.
- `src/clients.ts` ✅ — **Owns:** postgres.js pool (`max:10, idle:30, connect:30`), ioredis client (exponential retry), `jsonb()` cast helper.
- `src/integrations/googleCalendar.ts` ✅ — **Owns:** `createCalendarEvent`, `deleteCalendarEvent`, `checkFreeBusy`, `refreshGoogleTokens`. Uses raw `fetch`, tokens from `merchant_integrations` table. Auto-refreshes 60s before expiry. **Remaining:** Google OAuth server-side handler (A0).
- `src/data-intelligence/engine.ts` ✅ — **Owns:** Centralized telemetry (`logNegotiationTrace`, `captureOrderStateChange`, `auditLog`).
- `src/state-engine/index.ts` ✅ — **Owns:** Wraps pure `transition()` with SQL persistence and data intelligence telemetry.
- `src/identity-resolution/index.ts` ✅ — **Owns:** Global Buyer ID provision and phone resolution.
- `src/auth/index.ts` ✅ — **Owns:** Multi-tenant JWT auth engine and Fastify route hooks.
- `src/background-jobs/index.ts` ✅ — **Owns:** BullMQ cross-cutting worker pool registry.

## core/ingestion-service/

- `src/index.ts` ✅ — **Owns:** Graph webhook verify/receive, HMAC verify, Redis SETNX dedup, `extractMessages()` normalization, fast 200 ack, enqueue to BullMQ `inbound-webhooks`. **Remaining:** audio→Whisper queue, Kafka publish.

## core/comms-router/

- `src/debounce.ts` ✅ — **Owns:** `enqueueInboundMessage`, `turnQueue`, `turnWorker`, per-customer scratch buffer drain. **Remaining:** multi-merchant resolution.
- `src/outbound.ts` ✅ — **Owns:** `sendCustomerMessage` (the one send chokepoint), `classifyWindow`, `consolidate`. **Remaining:** outbound batching to ≤2.3 msgs/order.
- `src/whatsapp.ts` ✅ — **Owns:** `sendWhatsAppMessage` (backoff), `buildTextPayload`, `buildInteractivePayload` (≤3 buttons). **Remaining:** SMS/voice fallback (Twilio, Africa's Talking).
- `src/vendorCommunique.ts` ✅ — **Owns:** Merchant notification for escalations; sends interactive WhatsApp to merchant contact_phone. **Remaining:** SMS reply-code fallback (A2b).

## core/ai-negotiator/

- `src/agentLoop.ts` (768 LOC) ✅ — **Owns:** `runNegotiatorTurn(turn)`, distributed lock (`lock:negotiation:{customerId}`), system-prompt builder (injects MerchantContext + arc + DIALECT_PROFILES), Groq tool loop (≤8 iters), arc load/persist (Redis 24h), terminal-arc → `buildNegotiationTrace` → DB insert, outbound via `sendCustomerMessage`. **Remaining:** Vercel AI SDK migration, dialect/sentiment signals.
- `src/biblioAgentLoop.ts` (150 LOC) ✅ — **Owns:** `runBiblioAgentTurn(turn)`, vendor command router. Two-stage: router LLM selects sub-agent route, sub-agent LLM executes tool handlers and replies to vendor's WhatsApp.
- `src/toolHandlers.ts` ✅ — **Owns:** Aggregates all 109 vendor tool handlers from `tools/` directory into single `toolHandlers` record.
- `src/routerConfig.ts` ✅ — **Owns:** Router tool schemas, sub-agent prompts and tool-sets per route.
- `src/pricingService.ts` ✅ (PURE) — **Owns:** `resolveCustomerTier`, `computeAuthorizedRange`, `validateProposedPrice` (circuit breaker), `validateBundlePivot`, `scanForInjection`. Maps to future Rust `POST /pricing/{authorize,validate,detect}`.
- `src/negotiationArc.ts` ✅ (PURE) — **Owns:** `advanceArc` reducer, `availableTactics` guards, `discountLocked`, `negotiationAttempts` (max 3). Stages: anchor→acknowledge→counter→close/pivot/escalate. 6 tactics.
- `src/tools.ts` (1,073 LOC) ✅ — **Owns:** `toolDefinitions` (12 customer tools) + `executeTool` dispatcher. Includes: `check_inventory`, `check_services`, `check_availability`, `book_appointment` (→ Google Calendar + BullMQ reminder + OAuth vendor alert), `get_customer_profile`, `propose_price`, `deploy_tactic`, `close_deal`, `escalate_to_merchant`, `issue_payment_link`, `search_visual_catalog`, `source_price`. **Remaining:** real VAN (A4).
- `src/negotiationTrace.ts` ✅ (PURE) — **Owns:** `outcomeForArc`, `buildNegotiationTrace`. Feeds Layer-3 data. **Remaining:** Kafka publish to `negotiations.traces`.

## core/ai-negotiator/src/tools/ (Biblio Vendor Tools — 109 tools)

- `analyticsTools.ts` ✅ — Sales analytics, revenue reports, order trends, product performance.
- `bookingTools.ts` ✅ — Appointment management, availability, calendar integration (Google).
- `crmTools.ts` ✅ — Customer profiles, segments, loyalty, churn risk, win-back campaigns.
- `financeTools.ts` ✅ — Revenue reports (real 30-day SQL), Paystack payment links, customer creation, subaccounts.
- `integrationTools.ts` ✅ — SMS fallback (AfricasTalking), message timeout detection, Google Calendar OAuth connect, Mailchimp connect.
- `inventoryTools.ts` ✅ — Add/update/search inventory, Shopify sync (real HTTP PUT), low stock alerts.
- `marketingTools.ts` ✅ — Instagram Graph API posts, WhatsApp status BullMQ scheduling, bulk WhatsApp (rate-limited).
- `negotiationTools.ts` ✅ — Price negotiation assist, deal scoring, competitor analysis.
- `orderTools.ts` ✅ — View/cancel/fulfill/track orders with state machine transitions, Paystack refunds, SMS notifications.
- `settingsTools.ts` ✅ — Business profile, dialect, pricing rules, integrations management.

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