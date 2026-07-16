# `baileys-gateway` — Baileys v7 Vendor Business Line Service

A dedicated Node.js microservice that manages WhatsApp WebSocket sessions for vendor business lines using [`@whiskeysockets/baileys`](https://github.com/WhiskeySockets/Baileys) v7.

---

## Architecture Overview

Each vendor operates **one dedicated WhatsApp number** (a new SIM, never the vendor's personal line). This service maintains a persistent Baileys WebSocket connection per vendor. All inbound messages on that socket are classified as either:

- **Vendor product submission** — vendor sends a photo to their own business number → Claude Vision parses it → product upserted to DB → confirmation sent back.
- **Customer query** — everything else → routed to the existing `comms-router` negotiator pipeline via the same BullMQ queue used by Meta webhooks.

```
Baileys WebSocket (per-vendor)
  └─ messages.upsert event
       ├─ sender == vendor's personal number?
       │    YES → inventoryParser.ts → Claude Vision → products table → Status post
       │    NO  → messageClassifier.ts → enqueueInboundMessage() → BullMQ → negotiator
       └─ fromMe? → skip
```

This service is transport-only. The negotiator, pricing engine, and state machine are **not modified** — they receive the same `InboundMessage` shape they always did.

---

## Modules

| File | Role |
|------|------|
| `index.ts` | Entry point. Bootstraps all vendor sessions, starts Status cron, runs HTTP management API on port 3005. |
| `sessionManager.ts` | Creates and manages one Baileys socket per vendor. Auth state stored in Redis (not files — survives restarts). |
| `messageClassifier.ts` | Routes inbound messages: vendor push vs. customer query. Handles v7 LID JIDs via `remoteJidAlt`. |
| `inventoryParser.ts` | Claude Vision pipeline: download image → upload to storage → parse → upsert product → confirm to vendor. |
| `statusPoster.ts` | Reactive (post immediately on vendor push) and cron-driven (round-robin inventory, every 30 min) Status posting. |
| `outboundAdapter.ts` | Provides `canSendViaBaileys()` and `sendViaBaileys()` for `comms-router/outbound.ts` to use instead of the Meta Graph API. |

---

## HTTP Management API (port 3005)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Session count and active vendor IDs |
| `POST` | `/pair` | Start pairing flow — returns 8-char code for `{ vendorId, phoneNumber }` |
| `GET` | `/sessions/:vendorId` | Session status (DB + in-memory) |
| `POST` | `/sessions/:vendorId/connect` | Manually reconnect a vendor session |
| `POST` | `/status/cron` | Manually trigger the Status cron run |

These endpoints are called internally by `merchant-api` — they are not exposed to the public internet.

---

## Startup

```bash
# Install dependencies
npm install

# Run the gateway (reads .env from project root)
npm run baileys-gateway
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `BAILEYS_GATEWAY_PORT` | `3005` | HTTP management server port |
| `REDIS_URL` | — | Redis connection string (auth state storage) |
| `DATABASE_URL` | — | Postgres connection string |
| `ANTHROPIC_API_KEY` | — | For Claude Vision product parsing |

---

## Onboarding a Vendor (one-time)

1. **Create vendor record** via `merchant-api`:
   ```
   POST /vendors
   { merchantId, personalNumber, autoStatusEnabled, postingFrequencyHours, approveBeforePost }
   ```
2. **Get pairing code**:
   ```
   POST /vendors/:id/pair
   { phoneNumber: "2348012345678" }
   → { code: "ABCD-1234" }
   ```
3. **Vendor enters the code** in WhatsApp → Settings → Linked Devices → Link with phone number.
4. Session goes `connected`. Monitor at `GET /vendors/:id/status`.

---

## Ban Risk Mitigation

- Each vendor uses a **fresh SIM** (₦100–200, never their personal number).
- All data is keyed by `vendor_id` (UUID), not the phone number. If a number gets banned, re-provisioning = new SIM + new pairing code + zero data loss.
- `markOnlineOnConnect: false` — the business line never appears "online" (reduces ban signal).
- `syncFullHistory: false` — we don't pull history on connect.

---

## v7.0.0 LID System

WhatsApp now uses LIDs (`@lid` suffix) alongside phone JIDs in group contexts. The message classifier handles this:

```typescript
const effectiveSenderJid = senderJid.endsWith('@lid')
  ? (senderJidAlt ?? senderJid)
  : senderJid;
```

`remoteJidAlt` is the phone-number JID fallback provided by Baileys when the primary JID is a LID.

---

## Database Tables

See [`infra/schema.sql`](../../../../infra/schema.sql) for full DDL.

| Table | Purpose |
|-------|---------|
| `vendors` | One row per business line — config, session status, personal number |
| `status_log` | Immutable audit log of every Status/Story post |
| `status_post_queue` | Pending posts awaiting merchant approval (when `approve_before_post = true`) |
| `products.last_posted_at` | Tracks when each product was last posted to Status (for the cron rotation) |
