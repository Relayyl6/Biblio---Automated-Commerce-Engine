# Progress Tracker — ACE / Biblio

> Last updated: 2026-06-23. The living "where are we" log. **Update this file every time
> work completes** (directive #8). Newest entries at top of the log.

## Current status: Omni-Channel Convergence Layer Complete

- **Omni-Channel Engine:** `ace-platform/services/channels` implemented with ingress/egress routers and stubs for TikTok, IG, FB, Telegram, Email, and WhatsApp.
- **Identity Resolution:** Contact Merge deployed in `ace-whatsapp/core/identity-resolution` (hashes platform IDs to `Global_Buyer_ID`).
- **Autonomous Routing:** Intent Parser stub and State Machine Orchestrator active, properly delegating visual/purchases/complaints instead of just dumping everything into the Negotiator.
- **Compiles:** ✅ `npx tsc --noEmit` verified with 0 errors across the entire codebase.

## Done ✅

- **Omni-Channel Normalization Core:** `shared/src/types.ts` upgraded with `UnifiedMessage` and platform enum. Core Ingress Router and Egress Router implemented in `ace-platform/services/channels/core/`.
- **Identity Resolution:** Built `Global_Buyer_ID` deterministic mapper.
- **Intent Parsing & Orchestration:** Built the `orchestrator.ts` to parse intent (purchase vs visual vs complaint) and delegate to the correct autonomous state engine modules.
- **Ingestion Adapters:** Created endpoints for WhatsApp, Instagram, Telegram, TikTok, Facebook, and Email in `ace-platform`.
- **Bulletproofing:** Resolved deep TypeScript collisions in `orderStateMachine`, `background-jobs`, `vendorCommunique`, `whatsapp.ts`, and `agentLoop.ts`.
- **Documentation:** Upgraded `ace-whatsapp/README.md`, `core/identity-resolution/README.md`, and `core/comms-router/README.md` to embed Contact Merge mechanics.

- Shared domain types (`shared/src/types.ts`, 169 LOC) + DB/Redis clients (`clients.ts`).
- Postgres schema (`infra/schema.sql`): merchants, customer_merchant_links, products
  (pg_trgm), orders (JSONB state + VAN index), transactions, escalations,
  merchant_pricing_rules, negotiation_traces. Seed data (`infra/seed.sql`).
- **ingestion-service** — webhook verify (HMAC), dedup, normalize, ack-fast, enqueue.
- **comms-router** — debounce (BullMQ sliding window), outbound chokepoint + window
  classification + consolidation, WhatsApp Graph sender (backoff, interactive buttons).
- **ai-negotiator** — agentLoop (Claude tool loop, distributed lock, arc persistence),
  pricingService (tier/range/circuit-breaker/injection), negotiationArc (stage + tactics +
  3-offer rate limit), tools (7 tools), negotiationTrace (enterprise row builder).
- **state-machine** — pure `transition()`, 7 states, amount-match guard.
- **payment-verification** — webhook verify, dedup, VAN→order match, lock, transition,
  ledger write, underpayment/unmatched handling.
- **catalog-sync** — Meta catalog pull → map → upsert (preserves manual enrichment).
- **merchant-api** — merchants/products/pricing-rules CRUD, catalog-sync trigger, customer link.
- **merchant-app** (foundation) — settings (functional), catalog + command-center (placeholder).
- **admin-portal** (foundation) — Merchant Management (load, view catalog, sync).
- **MEMORY_DOCS** created (this folder) — 2026-06-23.

## In progress 🟡

- (none active yet — next up is Phase A in `build-plan.md`)

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