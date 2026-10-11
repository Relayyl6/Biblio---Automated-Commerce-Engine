# Admin Portal

> **ACE WhatsApp — Phase 1**  
> Internal operations and monitoring dashboard for the ACE team.

## Responsibility

Used exclusively by ACE staff for merchant onboarding, system health monitoring, and operational oversight.

## Key Views

- **Merchant Management** — Onboarding, health scores, subscription status
- **AI Performance** — Intent accuracy, confidence distributions, error rates, escalation rates
- **System Health** — Service uptime, message queue depth, API integration status
- **Manual Interventions** — Log of cases where human support stepped in
- **Billing** — Subscription management, usage metrics, revenue dashboards

## Status

`[~] Foundation started (2026-06-19)` — Vite + React app wired to
`core/merchant-api`. Implemented: **Merchant Management** (look up a merchant,
view seller context + catalog, onboard, trigger WhatsApp catalog sync).

### Run
```bash
cd ace-whatsapp/apps/admin-portal
npm install
MERCHANT_API_URL=http://localhost:3004 npm run dev   # http://localhost:5173
```

> ⚠️ Foundation, not yet runtime-verified (needs its own `npm install`). Kept out
> of the backend `tsconfig`. Remaining per the spec above: AI Performance, System
> Health, Manual Interventions, Billing — these read from the Phase-2 analytics
> service + queue metrics.
