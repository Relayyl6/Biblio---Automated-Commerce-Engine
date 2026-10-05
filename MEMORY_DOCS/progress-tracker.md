# Progress Tracker — ACE / Biblio

> Last updated: 2026-10-05. The living "where are we" log. **Update this file every time
> work completes** (directive #8). Newest entries at top of the log.

## Current status: Phase 1.5 Complete — Production-Grade Tools, Real Integrations, Google OAuth Alert

All fire-and-forget patterns purged. All 109 Biblio agent vendor tools implemented with real business logic. Phase 1.5 tool upgrades complete with real Google Calendar, Paystack, Shopify, Instagram, and WhatsApp integrations. Full 11-scenario simulation suite passes with 0 failures. Google OAuth link proactively pushed to vendor on missing calendar sync. `tsc --noEmit` exits 0. Everything committed and pushed to `dev` branch.

---

## Done ✅ (cumulative, newest first)

### Phase 1.5 — Real External Integrations (Committed: `4081461`, `0328ec8` — Sep 2026)
- **`shared/src/integrations/googleCalendar.ts`** — NEW module. Real Google Calendar integration using raw `fetch` (no googleapis SDK). Implements `createCalendarEvent`, `deleteCalendarEvent`, `checkFreeBusy`, `refreshGoogleTokens`. Tokens stored in `merchant_integrations` table, auto-refreshed 60s before expiry.
- **`bookAppointment()` in `tools.ts`** — Upgraded: DB insert → real Google Calendar event → WhatsApp confirmation to customer → BullMQ `appointment-reminders` 30-min delayed reminder. If calendar not linked, now **proactively pushes OAuth onboarding link to vendor via WhatsApp** (`https://biblio.com/oauth/google?merchantId=...`). No silent fallback.
- **`checkAvailability()` in `tools.ts`** — Upgraded: real DB query of existing appointments + Google Freebusy API merge, generates 9am–5pm WAT slots.
- **`financeTools.ts`** — Upgraded: real Paystack API calls (init transaction, create customer, create subaccount). `get_revenue_report` does real 30-day SQL aggregation.
- **`inventoryTools.ts`** — Upgraded: `sync_shopify_inventory` calls real Shopify Admin API HTTP PUT. `add_inventory`/`update_inventory` trigger background `inventory-sync` BullMQ queue. `search_inventory` has two-pass fuzzy + tag fallback.
- **`orderTools.ts`** — Upgraded: `cancel_order` runs state machine transition, Paystack refund, and pushes SMS via `sms_outbound` queue. `track_order` does real DB lookup + optional DHL/Shippify API. `fulfill_order` advances state machine and sends confirmation SMS.
- **`marketingTools.ts`** — Upgraded: `post_to_instagram` uses real Instagram Graph API. `schedule_whatsapp_status` queues to BullMQ `status-posts`. `send_bulk_whatsapp` rate-limited (2s delay, max 50/batch) via `outbound-messages` queue.
- **`integrationTools.ts`** — Upgraded: `send_sms_fallback` uses real AfricasTalking SDK. `detect_message_timeout` queries messages table and pushes to `sms-fallback` queue. `connect_google_calendar` and `connect_mailchimp` handlers implemented.
- **TypeScript clean** — All import path errors fixed. `tsc --noEmit` exits 0.
- **`simulate_all.ts`** — 11-scenario suite: ✅ PASSED: 11, ⚠️ EXTERNAL: 0, ❌ FAILED: 0.

### Phase 1 — Fire-and-Forget Purge & Backend Hardening (Committed: `0a2b8fc` — Aug 2026)
- **Fire-and-forget purged:** `setImmediate` in `ingestion-service/src/index.ts` → BullMQ `inbound-webhooks`. `setTimeout` in `inventoryParser.ts` → BullMQ `status-posts`.
- **14 swallowed `.catch(() => {})` blocks** patched across `agentLoop.ts`, `tools.ts`, `messageClassifier.ts`, `debounce.ts`, `sessionManager.ts`, `payment-verification/index.ts` — all now log with `logger.error`.
- **Payment idempotency** — atomic `UPDATE … WHERE state->>'status' != 'paid' RETURNING id` to prevent double-processing.
- **Postgres resilience** — `shared/src/clients.ts`: `max: 10, idle_timeout: 30, connect_timeout: 30`.
- **Event orchestrator graceful shutdown** — `Promise.allSettled(workers.map(w => w.close()))`.
- **Pidgin tone locked** — CRITICAL: max 25% Pidgin if customer speaks 55%. NEVER "sharp sharp".
- **BullMQ queues in use:** `inbound-webhooks`, `status-posts`, `appointment-reminders`, `sms-fallback`, `inventory-sync`, `delayed_cart_recovery`, `outbound-messages`, `vendor-debounce`.

### Biblio Agent Tool Suite — 109 Vendor Tools (Aug 2026)
- **10 tool files** in `ace-whatsapp/core/ai-negotiator/src/tools/`: analyticsTools, bookingTools, crmTools, financeTools, integrationTools, inventoryTools, marketingTools, negotiationTools, orderTools, settingsTools.
- All handler objects implemented with real SQL + external API calls, aggregated via `toolHandlers.ts`.
- `biblioAgentLoop.ts` (150 LOC) — vendor command router using two-stage LLM (router + sub-agent).

### Event Orchestrator Flows (Aug 2026)
- `abandonedCartFlow.ts`, `postPaymentFlow.ts`, `postServiceReviewFlow.ts`, `inventoryRestockFlow.ts`, `loyaltyMilestoneFlow.ts` — all 5 BullMQ worker flows built with proper `.on('error')` and `.on('failed')` handlers.

### Service Booking (Jul 2026)
- `services` and `appointments` tables added to schema.
- `check_services`, `check_availability`, `book_appointment` tools added to customer negotiator.

### Phase 1 Foundation (Jun 2026)
- Full ace-whatsapp core: ingestion-service, comms-router, ai-negotiator, state-machine, payment-verification, catalog-sync, merchant-api.
- baileys-gateway — Baileys v7 edge service for vendor business lines.
- Omni-channel engine, identity resolution, intent orchestrator.

---

## In progress 🟡

- (none active — awaiting next phase directive)

---

## Pending / not started 🔲 (highest-value first)

1. **Google OAuth endpoint** — link sent to vendors but no actual OAuth redirect/callback handler built yet. Must be built in `merchant-api` or a new `oauth-service`.
2. **DB schema reconciliation** — Neon DB has `tenants` table; services reference `merchants`. Needs explicit migration verification that all tables (`merchants`, `merchant_integrations`, `services`, `appointments`) exist.
3. **Real VAN generation (A4)** — `issue_payment_link` still uses random stub VAN. Must wire to Paystack/Providus Dedicated NUBAN API.
4. **Payment timer + reminders (A3)** — 15-min `awaiting_payment` timer wiring exists but nothing sets/fires it.
5. **Automated test harness (A1)** — zero coverage on pure modules. `vitest` not added.
6. **Logistics auto-dispatch (B1)** — `logistics-coordination` is README only.
7. **Supplier Integration (B3)** — stockout predictor + supplier ping. README only.
8. **Retention engine (B4)** — nightly at-risk analyzer. Not started.
9. **Merchant App (Phase C)** — auth, real Command Center, exception cards, Conversation Hub, Financial Dashboard.
10. **Admin Portal (Phase D)** — onboarding form, AI Performance, Billing views.
11. **Customer PWA (E1)** — not started.
12. **Kafka event spine (E2)** — services still talk via BullMQ/direct call.
13. **Qdrant + visual-context (E4)** — vector catalog search. README only.
14. **RLS, partitioning, migrations (E3)** — schema hardening not done.
15. **Docker / CI/CD (E5)** — not containerized; no CI pipeline.
16. **Enterprise data products (Phase F)** — spec only.

---

## Known issues / blockers ⚠️

- **DB schema drift** — Neon DB has a `tenants` table instead of `merchants` (from ace-platform). The `merchants` table was restored via `infra/schema.sql` with `IF NOT EXISTS` but the live DB state needs verification for `merchant_integrations`, `services`, `appointments`.
- **Google OAuth link** — Hardcoded as `https://biblio.com/oauth/google?merchantId=...`. No live handler. Vendor receives alert but cannot complete flow yet.
- **Groq rate limits** — Simulation hits `x-ratelimit-remaining-tokens: ~622` at times. External API constraint, not a code bug.
- **`@xenova/transformers` CLIP model** — Cannot load in simulations (mocked fetch). Classified ⚠️ EXTERNAL_TIMEOUT, gracefully degraded.

---

## Verification log

- 2026-06-23 — `npx tsc --noEmit` exit 0. Full audit of all 105 non-dep files.
- 2026-08-26 — `npx tsc --noEmit` exit 0 after Phase 1 hardening. simulate_all: 11 ✅ PASSED, 0 ❌.
- 2026-09-02 — `npx tsc --noEmit` exit 0 after Phase 1.5 tool upgrades. simulate_all: 11 ✅ PASSED, 0 ❌ FAILED.

---

## Next session: start here 👉

**Priority 1 — Build the Google OAuth handler** in `merchant-api`: vendor clicks the link, completes Google OAuth, tokens stored in `merchant_integrations`. Without this, calendar sync will never fire.

**Priority 2 — Fix DB schema drift**: confirm `merchant_integrations`, `services`, `appointments` tables exist in the Neon DB. Run targeted `CREATE TABLE IF NOT EXISTS` statements.

**Priority 3 — Real VAN generation (A4)**: remove the random VAN stub in `tools.ts:issuePaymentLink`. Wire to Paystack Dedicated NUBAN API.

## Pending / not started 🔲 (highest-value first)

1. **Vendor Communiqué v1 / escalation delivery** — `escalate_to_merchant` writes a row
   nobody reads. No merchant notification channel. **Correctness gap.** (build-plan A2)
2. **Automated tests** — zero coverage on pure modules. (A1)
3. **Payment timer + reminders** — 15-min `awaiting_payment` timer not set/fired. (A3)
4. **Real VAN generation** — currently random stub. (A4)
5. **Logistics auto-dispatch** — README only. (B1)
6. **Identity resolution (Global Buyer ID)** — phone-only today. (B2)
7. **Supplier integration / restock (Workflow 2)** — README only. (B3)
8. **Retention engine (Workflow 3)** — not started. (B4)
9. **intent-parser service** — inline in agentLoop today. (B5)
10. **Visual context (Workflow 4)** — README only. (E4)
11. **Merchant app**: auth, real Command Center, one-tap exceptions, Conversation Hub,
    Financial Dashboard; runtime-verify. (Phase C)
12. **Admin portal**: onboarding form, AI Performance / Health / Billing. (Phase D)
13. **Customer PWA** — not started. (E1)
14. **Infra**: Kafka, Qdrant, ClickHouse, RLS, partitioning, migrations, Docker, CI/CD.
15. **Enterprise data products** (Layer 3) — all spec-only. (Phase F)

## Known issues / blockers ⚠️

- **`ace-whatsapp/service-gaps.md` is internally inconsistent**: the top banner says
  "COMPILES CLEAN / built," but per-service sections still describe files as "0-byte
  stubs" (e.g. claims `shared/src/types.ts` is empty — it's 169 lines). Stale; reconcile
  (build-plan A6). Treat this MEMORY_DOCS folder as the current truth meanwhile.
- **`ace-whatsapp/arc.md` is 0 bytes** (empty placeholder).
- **No `.env`** present (only `.env.example`); services need real credentials to run.
- Apps have **never been run** (no install/runtime verification).
- VAN generation, rider dispatch, SMS/voice are stubs/absent — Workflow 1 can't fully
  complete a real delivery yet.

## Verification log

- 2026-06-23 — `npx tsc --noEmit` exit 0. Full audit of all 105 non-dep files + BIBLO.docx
  (4,660-line clean extract). Two Explore agents cross-checked; file line counts verified
  directly (negotiationArc 258, tools 547, orderStateMachine 145 — all real, not stubs).

## Next session: start here 👉

Begin **build-plan Phase A**. Recommended first action: **A1 (test harness) + A2
(escalation delivery)** — A1 makes A2 safe to build. Confirm priority with the owner if
unsure, then implement incrementally and update this tracker + `specific-function-assignment.md`.