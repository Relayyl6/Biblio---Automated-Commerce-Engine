# Library & Dependency Reference — ACE / Biblio

> Last updated: 2026-06-23. What's installed, why, and how it's used. Backend root is
> `package.json` (name `ace-whatsapp`, `"type": "module"` → ESM). The two apps have
> their **own** `package.json` and are installed separately.

## Backend (root `package.json`)

### Runtime dependencies

| Package | Version | Why it's here / how used |
|---|---|---|
| `@anthropic-ai/sdk` | ^0.32.1 | The negotiation LLM. `agentLoop.ts` calls `anthropic.messages.create()` with tool definitions; multi-turn tool loop (≤8 iters). **Model:** use the latest Claude (e.g. `claude-opus-4-8` / current Sonnet) — verify model id against the Claude API skill before changing. Roadmap: migrate to **Vercel AI SDK** (per README/doc) for provider-agnostic tool-use + training middleware. |
| `fastify` | ^4.28.1 | HTTP for ingestion, payment-verification, catalog-sync, merchant-api. Lightweight, fast. |
| `fastify-raw-body` | ^4.3.0 | Raw body access for **HMAC signature verification** on webhooks (must hash the exact bytes). Used by ingestion + payment. |
| `ioredis` | ^5.4.1 | Redis client. Uses: debounce scratch buffers, idempotency `SETNX` dedup (24h TTL), distributed locks, service-window tracking, negotiation arc hot state. |
| `bullmq` | ^5.34.0 | Delayed-job queue for the **inbound debounce window** (per-customer sliding window → one negotiator turn). `turnQueue` + `turnWorker` in comms-router. |
| `postgres` | ^3.4.5 | `postgres.js` driver (Neon-friendly pooling). Tagged-template SQL. `jsonb()` helper in `shared/clients.ts` for JSONB casts. `OrderState` stored as one JSONB column. |

### Dev dependencies

| Package | Version | Use |
|---|---|---|
| `typescript` | ^5.7.2 | `tsc --noEmit` is the build/type gate. |
| `tsx` | ^4.19.2 | Run TS directly in dev (`npm run ingestion`, etc.). No compile step. |
| `@types/node` | ^22.10.2 | Node types. |

### Not yet a dependency but referenced in design (add when building that piece)

- **Vercel AI SDK** (`ai`, `@ai-sdk/anthropic`) — planned LLM abstraction.
- **A test runner** — none installed. Recommend `vitest` (ESM-native, fast) for the pure
  modules. **No tests exist today.**
- **Kafka client** (`kafkajs`) — when the event spine is introduced.
- **Qdrant client** (`@qdrant/js-client-rest`) — vector DB (visual context, recall).
- **SMS/voice**: Africa's Talking + Twilio SDKs — Vendor Communiqué / OOB router.
- **Zod** — schema validation (intent schemas, request validation) per shared/ai-sdk spec.

## Merchant App (`ace-whatsapp/apps/merchant-app/package.json`)

- **React Native + Expo** with `expo-router` (file-based routing). Installed separately
  (`cd ace-whatsapp/apps/merchant-app && npm install`). Has its own `tsconfig.json` and is
  **excluded from the backend tsconfig**. Path alias `@/*`. Not yet runtime-verified on a
  device/simulator.

## Admin Portal (`ace-whatsapp/apps/admin-portal/package.json`)

- **Vite + React + TypeScript.** Own `vite.config.ts`, `tsconfig.json`. Installed
  separately. Plain inline styles (no UI lib).

## External services / APIs (configured via `.env`, see `.env.example`)

- **WhatsApp Business Cloud API (Meta Graph API)** — inbound webhook + outbound send.
  Needs phone number id, access token, app secret (HMAC), webhook verify token.
- **Anthropic API** — negotiator LLM (`ANTHROPIC_API_KEY`).
- **Postgres** (Neon) + **Redis** connection strings.
- **Payment provider** (Paystack / Providus etc.) — webhook secret; VAN generation is
  currently a random stub (`tools.ts:issuePaymentLink`).
- Roadmap env: Kafka brokers, Qdrant, ClickHouse, Twilio, Africa's Talking, Kwik/Gokada,
  Instagram Graph API.

## Version-bump policy

- Pin via `^` (as-is). Before bumping `@anthropic-ai/sdk` or swapping to Vercel AI SDK,
  re-check the Claude API reference (model ids, tool-use shape) — don't rely on memory.
- Run `tsc --noEmit` after any dependency change.