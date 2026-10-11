# UI Registry — ACE / Biblio

> Last updated: 2026-06-23. Inventory of every screen and reusable UI element that
> exists today, plus where it lives and its status. Update this in the same change
> whenever you add/rename a screen or component. See `ui-rules.md` + `ui-tokens.md`.

## Merchant App — React Native + Expo (`ace-whatsapp/apps/merchant-app/`)

Routing: `expo-router` (file-based). `MERCHANT_ID` is currently hard-coded in
`app/_layout.tsx` (no auth yet — Phase 2 = phone OTP via Firebase, per the doc).

| Screen / file | Route | Purpose | Status |
|---|---|---|---|
| `app/_layout.tsx` | root | Nav/tab setup; exports `MERCHANT_ID` constant. | ✅ foundation |
| `app/index.tsx` | `/` | **Command Center** (home). Order velocity, cash flow, daily briefing, exception queue. | 🟡 placeholder layout — needs real exception data |
| `app/catalog.tsx` | `/catalog` | **Inventory Oracle**: product list + WhatsApp catalog sync trigger. | 🟡 foundation, lists products |
| `app/settings.tsx` | `/settings` | **Seller Voice**: edit name, tone_guide, business_policies, delivery_info, dialect → PATCH merchant-api. | ✅ functional |
| `src/api/client.ts` | — | Typed HTTP client for merchant-api; exports `api`, `Dialect`, `Merchant`. | ✅ works |

**Not built (spec'd in BIBLO):** Conversation Hub (unified timeline, AI confidence per
chat), Financial Dashboard (reconciliation, receivables, margins), Autonomous Settings
(autonomy boundaries, connected accounts), exception-resolution one-tap cards.

## Admin Portal — Vite + React (`ace-whatsapp/apps/admin-portal/`)

Internal ACE-ops dashboard. Plain inline styles (object `S` in `App.tsx`).

| File | Purpose | Status |
|---|---|---|
| `src/main.tsx` | Vite entry, mounts `<App/>`. | ✅ |
| `src/App.tsx` | **Merchant Management**: load merchant by id, show seller context + catalog table, trigger catalog sync. | ✅ functional |
| `src/api.ts` | Typed client for merchant-api; exports `api`, `Merchant`, `Product`. | ✅ |
| `index.html` | Vite host page. | ✅ |

**Not built (spec'd):** AI Performance, System Health (queue depth), Billing, merchant
onboarding form (currently load-by-id only), enterprise data-product dashboards (Phase 3).

## Customer PWA (`ace-whatsapp/apps/customer-pwa/`)

🔲 **README only — not started.** Intended: Next.js PWA opened from a WhatsApp link;
catalog browse, size/variant select, address confirm, checkout (bank transfer / card /
POD), pre-filled from Global Buyer ID. Must load <2s on 3G.

## Reusable primitives (currently inlined, not yet extracted)

| Primitive | Defined in | Notes |
|---|---|---|
| `Field` (label + TextInput, multiline option) | merchant-app `settings.tsx` | Candidate to extract to a shared components dir. |
| `Row` (key/value line) | merchant-app `settings.tsx`, admin `App.tsx` | Duplicated — extract on next touch. |
| Chip (selectable, active state) | merchant-app `settings.tsx` (dialect picker) | Pill style from `ui-tokens.md`. |
| Card / Section | both apps (inline styles) | Standardize via tokens. |
| Primary / Ghost button | admin `App.tsx`, merchant-app | `--green-primary` solid vs outline. |

> **Tech-debt flag:** no shared component library or theme module yet. When the same
> primitive is needed a 3rd time, extract it (merchant-app → `src/components/`, web →
> a shared `ui/` package) and record it here.

## Phase-2 surface (`ace-platform/apps/web-app`)

🔲 Next.js "Commerce OS" (respond.io-style: Unified Inbox, Playbooks canvas, Contacts/CRM,
Command Center). Design only (`ace-platform/docs/COMMERCE_OS_DESIGN.md`). Not on the green
merchant palette — treat as a separate, later design system.