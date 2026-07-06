# Code Standards — ACE / Biblio

> Last updated: 2026-06-23. These are the conventions **already in force** in the
> codebase (derived by reading the source), not aspirational rules. Match them so the
> code stays uniform. When in doubt, copy the nearest existing module.

## Language & tooling

- **TypeScript, strict.** `tsconfig.json`: ES2022, ESNext modules, `strict: true`.
  Path alias `@ace/shared/*` → `shared/src/*`. Always run `npx tsc --noEmit` before
  considering work done — the repo's contract is "compiles clean."
- **Run with `tsx`** (no build step in dev): `npm run ingestion | payment | catalog-sync | merchant-api`.
- **No `any`.** Use discriminated unions and `unknown` + narrowing. `assertNever()` for
  exhaustiveness on union switches (see `orderStateMachine.ts`).
- **ESM imports** with explicit extensions where required; import shared types from
  `@ace/shared/types`.

## Module shape (the dominant pattern — keep it)

1. **Every file opens with a header comment**: `// path/to/file — one-line role`, then a
   short paragraph explaining the *why* and any non-obvious design constraint. This is a
   strong house style — see `pricingService.ts`, `types.ts`, `settings.tsx`. Preserve it.
2. **Pure core vs impure edge.** Business logic = pure functions (no async, no I/O, inputs
   passed explicitly). I/O lives in thin Fastify/DB/Redis adapters. The caller fetches
   data and passes plain objects into pure functions. This is what makes modules
   Rust-extractable later. Do **not** put a DB call inside `pricingService`, `negotiationArc`,
   `orderStateMachine`, `paymentService`, or `catalogMapper`.
3. **Library-or-service files**: a service file exports its core function(s) AND only boots
   its HTTP server when run directly (so it's importable). See `catalog-sync/index.ts`.

## Types

- **Discriminated unions** for anything with states/variants (`OrderState` on `status`,
  `MessageContent` on `type`, `OrderEvent` on `type`). Narrow, don't cast.
- **`shared/src/types.ts` is types-only** — zero runtime imports, zero side effects.
  Add a domain shape here before any consumer uses it; the consumer is the spec.
- Numbers for money are **NGN integers** (kobo-free in MVP). Currency symbol `₦` only at
  the display layer, formatted with `toLocaleString()`.

## Naming

- **camelCase** for TS identifiers, **PascalCase** for types/interfaces/React components.
- **snake_case** for DB columns AND the JSON API surface that mirrors them
  (`tone_guide`, `phone_number_id`, `whatsapp_catalog_id`). The merchant-api speaks
  snake_case; internal TS domain objects use camelCase. Map at the boundary.
- Tools exposed to the LLM use snake_case names (`check_inventory`, `propose_price`).

## Safety invariants (non-negotiable — these are the product)

- **LLM never writes financial state.** It calls tools; pure rules validate. Below-floor
  price = circuit breaker, not a swallowed error.
- **Payment only from verified webhook** + amount-match guard. Never trust AI/screenshot.
- **Idempotency** on every external event (Redis `SETNX`, 24h TTL) keyed by the provider's
  id (`waMessageId`, `providerRef`). **Distributed locks** (Redis `SETNX`) around any
  per-customer or per-order critical section.
- **Constant-time HMAC** verification for all inbound webhooks (`timingSafeEqual`).
- **Ack fast, process async.** Webhooks return 200 immediately, then do work (prevents
  provider retries / duplicate delivery).

## Error handling

- Custom typed errors for domain failures (`TransitionError` carries `fromStatus` +
  `eventType`). Don't throw bare strings.
- Outbound send failures are logged and contained — they must **not** throw back into the
  agent loop (see `whatsapp.ts` best-effort + bounded backoff).

## Comments

- Explain **why**, not what. Reference the BIBLO source where a rule comes from
  ("tier boundaries from the README", "BIBLO Risk 2"). Mark roadmap seams with the Rust
  HTTP contract they'll become (see `pricingService.ts` header).

## Testing (current gap — adopt going forward)

- There are **no automated tests yet.** When adding tests, target the pure modules first
  (they're trivially unit-testable: pass input, assert output). Suggested: `vitest`.
  Critical paths to cover: `orderStateMachine.transition` (every state×event), pricing
  circuit breaker, `normalizePaymentEvent`, `parsePrice`, `advanceArc`.

## Git

- Branch off `dev` (current working branch) or `main`. Commit messages: imperative,
  describe the behavioral change. Don't commit `.audit_tmp/` or secrets. Update the
  relevant MEMORY_DOCS in the same change (see directive #8).