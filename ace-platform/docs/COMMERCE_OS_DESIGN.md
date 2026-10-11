# ACE Platform — Commerce OS Design (respond.io-inspired)

> **Status:** Phase 2 foundation started 2026-06-19. Per `ace-platform/README.md`,
> full development begins post-Series A and builds on the Phase-1 WhatsApp engine.
> This document sets the UX/architecture direction; `apps/web-app/` is the seed.

---

## Why respond.io as the reference

respond.io is the best-in-class **multi-channel business-messaging OS**. Its
proven primitives map almost 1:1 onto what ACE Platform needs — except ACE
flips the core assumption: respond.io routes conversations **to human agents**;
ACE's AI **executes autonomously** and routes only the ~6% exceptions to humans.
We borrow respond.io's *surfaces*, not its *human-in-the-loop default*.

| respond.io primitive | What it is | ACE Platform adaptation |
|---|---|---|
| **Omnichannel Inbox** | One inbox across WhatsApp/IG/Messenger/SMS | Same — but threads show the **AI's autonomous actions + confidence**, not an empty queue for a human to answer |
| **Workflows** (visual builder) | Drag-drop automation: triggers → branches → actions | ACE **Playbooks**: merchant-authored guardrails on top of the AI (e.g. "orders > ₦500K → human", "auto-restock < ₦50K") |
| **Contacts + Lifecycle** | Contact records with stages (Lead → Customer) | **Global Buyer ID** profiles with tier (new/returning/loyal/VIP) + cross-merchant history |
| **Broadcasts** | Bulk templated campaigns | **AI-drafted campaigns**: ACE writes, merchant approves, ACE schedules/sends within the service window |
| **AI Agent / AI Assist** | Bolt-on AI replies | ACE **is** the agent — the negotiator from Phase 1, now omnichannel |
| **Reports / Analytics** | Conversation + agent metrics | **Commerce metrics**: GMV, margin vs floor, negotiation success, demand curves (ClickHouse) |

---

## The four surfaces of ACE Platform

### 1. Unified Inbox (`/inbox`)
A respond.io-style three-pane layout — conversation list · thread · context panel —
with ACE's twist: the thread is a **timeline of autonomous actions**, not a reply box.

```
┌── Conversations ──┬── Thread: Amaka ────────────────┬── Context ──────────────┐
│ ● Amaka   ₦28.5k  │ Cust: "₦25k last price?"        │ Global Buyer ID        │
│ ○ Chidi   ₦12k    │ 🤖 deploy_tactic: bundle_pivot  │ Tier: Loyal (8 ord)    │
│ ○ Bisi    ₦40k⚠  │ 🤖 propose_price ₦27,000 ✓      │ LTV: ₦214,000          │
│                   │ Cust: "ok send account"         │ AI confidence 0.94     │
│                   │ 🤖 close_deal ₦27,000           │ Channel: WhatsApp      │
│                   │ 🤖 issue_payment_link           │ ── Actions taken ──    │
│                   │ [ Only ⚠ threads need you ]     │ 6 autonomous · 0 you   │
└───────────────────┴─────────────────────────────────┴────────────────────────┘
```

The list is **sorted by exceptions first** (low AI confidence, below-floor
escalations, payment anomalies). A merchant on a good day sees an empty ⚠ filter.

### 2. Playbooks (`/playbooks`) — the visual automation builder
respond.io's Workflows canvas, repurposed as **autonomy guardrails**. Nodes:

- **Triggers** — `order.created`, `negotiation.below_floor`, `payment.verified`,
  `inventory.low_stock`, `customer.inactive(14d)`
- **Conditions** — order value, customer tier, stock level, time/quiet-hours
- **Actions** — `auto_approve`, `escalate_to_merchant(channel)`, `apply_discount(max%)`,
  `book_rider`, `send_campaign`, `ping_supplier`

These compile to the same rule checks the Phase-1 engine already enforces
(`pricingService`, `orderStateMachine`, the arc tactic guards) — the canvas is a
UI over existing guardrails, so a node can never authorize something the rules
engine forbids.

### 3. Contacts / CRM (`/contacts`)
Global Buyer ID profiles: cross-merchant history, tier, LTV, dialect, churn-risk,
saved preferences ("prefers Saturday delivery"). Powers respond.io-style
**segments** ("VIP, LTV > ₦100K, silent 14d") that feed AI-drafted re-engagement.

### 4. Command Center (`/`)
Live revenue waterfall, orders/hour, AI performance (confidence distribution,
escalation rate, deals-in-range %), logistics SLA. ClickHouse-backed, sub-second.

---

## Architecture (how it reuses Phase 1)

```
            ┌─────────────────────────── ace-platform/apps/web-app (Next.js) ──┐
            │  Inbox · Playbooks · Contacts · Command Center                    │
            └───────────────┬───────────────────────────────────────────────────┘
                            │ REST + WebSocket (live thread updates)
            ┌───────────────▼───────────── services/api-gateway ───────────────┐
            │  Auth · RBAC (teams/roles) · merchant-scoped queries (RLS)        │
            └───────┬───────────────┬───────────────┬───────────────────────────┘
                    │               │               │
        ┌───────────▼──┐   ┌────────▼─────┐   ┌──────▼─────────┐
        │ channels/    │   │ ai-engine    │   │ analytics      │
        │ wa·ig·sms·   │   │ = Phase-1    │   │ ClickHouse +   │
        │ voice·web    │   │ negotiator,  │   │ dbt            │
        │ (normalise)  │   │ unchanged    │   │                │
        └──────┬───────┘   └──────┬───────┘   └────────────────┘
               │ normalised events │
               └─────► Kafka ◄──────┘   (orders.state_changed, payments.verified, …)
```

Key reuse principles:
- **The negotiator is imported, not rewritten** (`ace-platform/README.md`: "same
  negotiation logic, any channel"). Channels normalise to the Phase-1
  `InboundMessage`/`ConversationTurn` shape; the AI engine is channel-agnostic.
- **Kafka is the spine** (see `infra/README.md`) — the web-app never calls
  services directly for domain events; it subscribes to projections.
- **RLS everywhere** — every query is merchant-scoped at the DB, not the app.

---

## Build order (Phase 2)
1. `services/api-gateway` — auth, RBAC, REST/WebSocket over the Phase-1 data.
2. `apps/web-app` Inbox (read-only timeline of autonomous actions) ← **seeded now**.
3. `services/channels/*` adapters (Instagram first — closest to WhatsApp).
4. Playbooks canvas → compile to existing guardrails.
5. `services/analytics` (ClickHouse) → Command Center.
6. Contacts/CRM + Broadcasts.

## Seeded now
`apps/web-app/` — Next.js App Router skeleton with the Command Center shell and a
static Inbox mock that demonstrates the "timeline of autonomous actions" layout.
It is a **foundation** (needs its own `npm install`), kept out of the backend
`tsconfig`.
