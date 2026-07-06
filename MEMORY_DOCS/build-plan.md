# Build Plan — ACE / Biblio

> Last updated: 2026-06-23. The prioritized roadmap. Priority order follows the
> directive: **(1) ace-whatsapp → (2) merchant app → (3) admin portal → (4) supporting
> services.** Aligns with `BIBLO.docx` PART 4 (Demo-Ready MVP, May 18 → Oct 31 2026).
> Update `progress-tracker.md` as items move; update this plan if priorities shift.

## Guiding goal

Make the **autonomous order loop production-grade and observable**, then extend autonomy
(restock, retention, logistics), then layer the enterprise data products. Don't rewrite
working code; close the gaps between the 4 canonical workflows and what's built.

## Status snapshot

- ✅ **Workflow 1 (Order Fulfillment)** — built end-to-end **except** real rider dispatch
  and real VAN generation. The human-escalation branch has no delivery channel.
- 🟡 **Workflow 2 (Restocking)** — supplier-integration is README-only.
- 🟡 **Workflow 3 (Retention)** — no nightly analyzer / re-engagement job.
- 🟡 **Workflow 4 (Visual Resolution)** — visual-context is README-only.

## Phase A — Harden & close the core loop (PRIORITY 1, ace-whatsapp)

Goal: the autonomous loop is correct, observable, and testable.

- [ ] **A1. Test harness + pure-module unit tests.** Add `vitest`. Cover
  `orderStateMachine.transition` (all state×event incl. guards), pricing circuit breaker &
  injection scan, `advanceArc`/`availableTactics`, `normalizePaymentEvent`/`classifyAmount`,
  `parsePrice`. *(Biggest risk reducer; nothing is tested today.)*
- [ ] **A2. Close the escalation loop (Vendor Communiqué v1).** Today
  `escalate_to_merchant` writes an `escalations` row that no one delivers. Build the
  merchant notification channel: at minimum WhatsApp-to-merchant interactive message
  (Approve / Counter / Decline) + a reply handler that resolves the escalation and
  resumes the negotiation. (SMS reply-code fallback is A2b.)
- [ ] **A3. Payment timer + reminders.** `awaiting_payment` sets a 15-min timer
  (`order:{id}:timer`); on expiry send reminder, then expire/cancel. (Wiring exists to
  clear it; nothing sets/fires it.)
- [ ] **A4. Real virtual-account generation.** Replace the random VAN in
  `tools.ts:issuePaymentLink` with the partner FinTech (Paystack/Providus) provisioning
  call; map VAN→order for the payment webhook.
- [ ] **A5. Structured logging + metrics.** Per-turn trace ids; track the README KPIs
  (messages/order ≤2.3, % in free service window ≥78%, Meta cost/merchant).
- [ ] **A6. Reconcile docs with reality.** Fix `service-gaps.md` stale "0-byte stub"
  language (files are built). (Quick win — can do alongside A1.)

## Phase B — Extend autonomy (PRIORITY 1 cont., ace-whatsapp)

- [ ] **B1. Logistics Coordination.** On `payment_verified`, auto-book a rider (Kwik
  first), store tracking link, `transition(DISPATCHED)`, notify customer. (Workflow 1 tail.)
- [x] **B2. Identity Resolution v1.** Global Buyer ID deterministic mapping implemented for Omni-Channel platforms.
- [ ] **B3. Supplier Integration (Workflow 2).** Inventory oracle (sales-velocity
  stockout prediction) → supplier WhatsApp ping → margin calc → PO draft → merchant approve.
- [ ] **B4. Retention engine (Workflow 3).** Nightly at-risk analyzer → drafted
  re-engagement message → merchant approve/auto-send.
- [x] **B5. intent-parser separation.** Moved intent classification to `orchestrator.ts` stub with visual/complaint/purchase multi-routing.

## Phase C — Merchant App (PRIORITY 2)

- [ ] **C1. Auth** (phone OTP) replacing hard-coded `MERCHANT_ID`.
- [ ] **C2. Command Center** wired to real data: exception queue, order velocity, cash flow.
- [ ] **C3. One-tap exception cards** (resolve escalations from A2 in-app).
- [ ] **C4. Conversation Hub** + **Financial Dashboard** + **Autonomous Settings**.
- [ ] **C5. Runtime-verify on simulator/device** (never been run).

## Phase D — Admin Portal (PRIORITY 3)

- [ ] **D1. Merchant onboarding form** (currently load-by-id only).
- [ ] **D2. AI Performance, System Health (queue depth), Billing** views.

## Phase E — Supporting services & infra (PRIORITY 4)

- [ ] **E1. Customer PWA** (checkout, Global Buyer ID pre-fill).
- [ ] **E2. Kafka event spine** (decouple services; 15 topics, key=merchant_id).
- [ ] **E3. Schema hardening**: `escrow_accounts`, `vendor_decisions`, `supplier_orders`,
  RLS policies, hash partitioning, `migrations/`.
- [ ] **E4. Qdrant** (conversation recall + visual_products) and **visual-context** service.
- [ ] **E5. Containerization + CI/CD** (Dockerfiles, GitHub Actions, typecheck+test gate).

## Phase F — Enterprise intelligence (LATER, Layer 3)

- [ ] Data refinement pipeline (PII scrub, anonymize) → feed `negotiation_traces` + events.
- [ ] ClickHouse warehouse + FMCG dashboards; AI training data API; TrustScore API.

## Sequencing rationale

A before B: you can't trust extended autonomy without tests + observability + a working
human-escalation fallback. The escalation loop (A2) is the single most important
correctness gap — without it, "escalate to merchant" silently dead-ends, breaking the
human-in-the-loop safety promise that the whole pricing model depends on.