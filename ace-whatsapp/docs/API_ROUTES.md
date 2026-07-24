# ACE WhatsApp — API Route Reference

> Auto-generated from source audit. All services use **Fastify**. All request/response bodies are JSON unless noted.
> Three core modules (`comms-router`, `ai-negotiator`, `state-machine`) are **pure library modules** with no HTTP server — they are imported by the services that do.

---

## Port Map

| Service | Port | Env Var | Has HTTP Server |
|---------|------|---------|-----------------|
| `ingestion-service` | **3001** | `PORT` | ✅ |
| `payment-verification` | **3002** | `PAYMENT_PORT` | ✅ |
| `catalog-sync` | **3003** | `CATALOG_SYNC_PORT` | ✅ (standalone only) |
| `merchant-api` | **3004** | `MERCHANT_API_PORT` | ✅ |
| `baileys-gateway` | **3005** | `BAILEYS_GATEWAY_PORT` | ✅ |
| `comms-router` | — | — | ❌ library |
| `ai-negotiator` | — | — | ❌ library |
| `state-machine` | — | — | ❌ library |

---

## 1. Baileys Gateway — Port 3005

The gateway owns one persistent Baileys WebSocket per vendor. It handles pairing, reconnects, and routes inbound messages to the classifier.

**File:** `core/baileys-gateway/src/index.ts`

---

### `GET /health`

Health check. Reports the count and IDs of all currently live Baileys sessions in memory.

**Request:** none

**Response `200`:**
```json
{
  "ok": true,
  "activeSessions": 2,
  "sessions": ["vendorId-1", "vendorId-2"]
}
```

---

### `POST /pair`

Pairs a new vendor business line to their WhatsApp number. Wipes any stale Redis auth state for the vendor, creates a fresh socket, and returns an 8-character code the vendor types into **WhatsApp → Settings → Linked Devices → Link with phone number**.

**Request body:**
```json
{
  "vendorId": "11111111-1111-1111-1111-111111111111",
  "phoneNumber": "2349064982841"
}
```

> `phoneNumber` must be in **E.164 format without the `+`** (e.g. `2349064982841` not `+2349064982841`).

**Response `200`:**
```json
{
  "ok": true,
  "code": "ABCD1234"
}
```

**Response `500`** if the socket fails to connect in time:
```json
{
  "ok": false,
  "error": "Socket did not reach pairing state in time"
}
```

---

### `GET /sessions/:vendorId`

Returns the live session status for a single vendor — both the in-memory socket state and the last-known DB status.

**Path param:** `vendorId` — UUID of the vendor

**Response `200`:**
```json
{
  "vendorId": "11111111-1111-1111-1111-111111111111",
  "inMemory": true,
  "dbStatus": "connected"
}
```

---

### `POST /sessions/:vendorId/connect`

Manually bootstraps a Baileys WebSocket session for a vendor. Useful for ops/recovery — normally sessions auto-reconnect on restart.

**Path param:** `vendorId`

**Request body:** none

**Response `200`:**
```json
{
  "ok": true,
  "message": "Session creation initiated"
}
```

---

### `POST /status/cron`

Manually fires the WhatsApp Status posting cron for all vendors. Normally runs on a 30-minute schedule. Use for testing status posts without waiting.

**Request body:** none

**Response `200`:**
```json
{
  "ok": true,
  "message": "Status cron triggered"
}
```

---

## 2. Ingestion Service — Port 3001

Receives all inbound WhatsApp messages from Meta's Cloud API webhook. Verifies HMAC-SHA256 signatures, deduplicates via Redis, and enqueues messages onto BullMQ for async processing by the AI negotiator.

**File:** `core/ingestion-service/src/index.ts`

---

### `GET /webhook`

Meta webhook subscription handshake — called once by Meta when you register the webhook URL in the Meta App dashboard.

**Query params:**
| Param | Description |
|-------|-------------|
| `hub.mode` | Must be `subscribe` |
| `hub.verify_token` | Must match `WHATSAPP_VERIFY_TOKEN` env var |
| `hub.challenge` | Random string from Meta |

**Response `200`:** echoes the `hub.challenge` string (plain text)

**Response `403`:** if token doesn't match

---

### `POST /webhook`

Receives live inbound WhatsApp messages (text, audio, image, interactive). Verifies the `x-hub-signature-256` HMAC header using `WHATSAPP_APP_SECRET`. Deduplicates by `waMessageId` in Redis. Enqueues to BullMQ.

**Headers:**
| Header | Description |
|--------|-------------|
| `x-hub-signature-256` | `sha256=<HMAC-SHA256 of raw body>` — required |

**Body:** Raw Meta webhook payload (JSON). Shape:
```json
{
  "entry": [{
    "changes": [{
      "value": {
        "messages": [{
          "id": "wamid.xxx",
          "from": "2349064982841",
          "type": "text",
          "text": { "body": "Hello" }
        }],
        "contacts": [{ "profile": { "name": "Chidi" }, "wa_id": "2349064982841" }],
        "metadata": { "phone_number_id": "1174371249097383" }
      }
    }]
  }]
}
```

Supported `type` values: `text`, `audio`, `image`, `interactive`

**Response `200`:** always immediate (ack pattern — processing is async)

---

## 3. Merchant API — Port 3004

Self-serve merchant and vendor management. All routes (except `/health` and `/auth/*`) require authentication via `x-api-key` header (if `ADMIN_API_KEY` env var is set) or a JWT Bearer token.

**File:** `core/merchant-api/src/index.ts`

---

### `GET /health`

**Response `200`:** `{ "ok": true }`

---

### Auth Routes

#### `POST /auth/token`
Dev/test only. Issues a signed JWT without OTP verification.

**Body:**
```json
{ "merchantId": "uuid", "role": "merchant" }
```
`role` is optional, defaults to `"merchant"`. Can also be `"admin"`.

**Response:** `{ "token": "eyJ..." }`

---

#### `POST /auth/otp/send`
Sends a Twilio SMS OTP to the merchant's phone.

**Body:** `{ "phone": "+2349064982841" }`

**Response:** `{ "ok": true }`

---

#### `POST /auth/otp/verify`
Verifies the OTP and returns a JWT.

**Body:**
```json
{
  "phone": "+2349064982841",
  "code": "123456",
  "merchantId": "uuid"
}
```

**Response:**
```json
{
  "ok": true,
  "globalBuyerId": "uuid",
  "token": "eyJ..."
}
```

---

### Telemetry Routes

#### `POST /telemetry`
Logs a frontend audit event to the database.

**Body:**
```json
{
  "action": "product_viewed",
  "service": "merchant-dashboard",
  "metadata": { "sku": "ANK-BLU-001" }
}
```

**Response:** `{ "ok": true }`

---

#### `GET /telemetry/dashboard`
Returns aggregated metrics for the admin Recharts dashboard.

**Response:**
```json
{
  "elasticity": [{ "session": "uuid", "rounds": 3, "discount": 0.15 }],
  "outcomes": [{ "label": "Accepted", "value": 42 }]
}
```

---

### Merchant Routes

#### `POST /merchants`
Creates a new merchant.

**Body:**
```json
{
  "name": "Amaka Fashion House",
  "phoneNumberId": "1174371249097383",
  "toneGuide": "Warm, Lagos market trader...",
  "businessPolicies": "Min order ₦5,000...",
  "deliveryInfo": "Lagos Mainland ₦2,000...",
  "dialect": "pidgin",
  "whatsappCatalogId": "1234567890"
}
```
Required: `name`, `phoneNumberId`. All others optional.

**Response `201`:** `{ "id": "uuid" }`

---

#### `GET /merchants/:id`
Gets a merchant by ID.

**Response:** Full merchant row from `merchants` table.

---

#### `PATCH /merchants/:id`
Updates merchant seller-context fields (used to tune the AI negotiator's persona).

**Body** (all fields optional):
```json
{
  "name": "...",
  "toneGuide": "...",
  "businessPolicies": "...",
  "deliveryInfo": "...",
  "dialect": "pidgin",
  "whatsappCatalogId": "..."
}
```

**Response:** `{ "ok": true }`

---

#### `PUT /merchants/:id/pricing-rules`
Upserts the negotiation pricing rules for a merchant. These cap how much the AI can discount by customer tier.

**Body:**
```json
{
  "absoluteFloor": 10000,
  "basePrice": 0,
  "maxDiscountByTier": { "new": 0.05, "returning": 0.15, "loyal": 0.22, "vip": 0.30 },
  "maxBundleValueAddByTier": { "new": 0, "returning": 0.10, "loyal": 0.20, "vip": 0.30 },
  "futureCreditCapByTier": { "new": 0, "returning": 1000, "loyal": 2500, "vip": 5000 }
}
```
Required: `absoluteFloor`. All others optional.

**Response:** `{ "ok": true }`

---

#### `GET /merchants/:id/products`
Lists all active products for a merchant, ordered by `updated_at` desc.

**Response:** Array of product rows.

---

#### `POST /merchants/:id/products`
Creates or upserts a product (insert with ON CONFLICT UPDATE).

**Body:**
```json
{
  "sku": "ANK-BLU-001",
  "name": "Blue Ankara Gown",
  "price": 28500,
  "stock": 3,
  "description": "Floor-length blue Ankara...",
  "category": "Ankara",
  "tags": ["wedding-guest", "ankara"],
  "attributes": { "sizes": ["S","M","L"], "color": "royal blue" },
  "imageUrl": "https://cdn.example.com/...",
  "currency": "NGN"
}
```
Required: `sku`, `name`, `price`.

**Response `201`:** `{ "ok": true, "sku": "ANK-BLU-001" }`

---

#### `PATCH /merchants/:id/products/:sku`
Partially updates a product. All body fields optional.

**Body:** any subset of product fields (same shape as POST, minus `sku`).

**Response:** `{ "ok": true }`

---

#### `DELETE /merchants/:id/products/:sku`
Soft-deletes a product by setting `active = false`. Product stays in DB for order history.

**Response:** `{ "ok": true }`

---

#### `POST /merchants/:id/catalog-sync`
Triggers a WhatsApp Commerce Catalog import from Meta's Graph API into the local `products` table. Paginated — handles large catalogs.

**Response:**
```json
{
  "ok": true,
  "merchantId": "uuid",
  "catalogId": "1234567890",
  "fetched": 47,
  "upserted": 47
}
```

---

#### `POST /merchants/:id/customers`
Links a customer phone number to this merchant (Phase-1 identity resolution). Required before the customer can send messages that route to the AI negotiator.

**Body:** `{ "customerId": "2349064982841" }` (E.164 without `+`)

**Response `201`:** `{ "ok": true }`

---

### Vendor Routes

#### `POST /vendors`
Creates a new vendor record (a "business line" — one WhatsApp number per vendor). Must be linked to a merchant.

**Body:**
```json
{
  "merchantId": "uuid",
  "personalNumber": "2349064982841",
  "autoStatusEnabled": true,
  "postingFrequencyHours": 8,
  "approveBeforePost": false
}
```
Required: `merchantId`, `personalNumber`.

**Response `201`:**
```json
{
  "ok": true,
  "vendorId": "uuid"
}
```

---

#### `POST /vendors/:vendorId/pair`
Proxies to `baileys-gateway /pair`. Gets a WhatsApp pairing code for the vendor's business line number. The vendor types this code in WhatsApp.

**Path param:** `vendorId`

**Body:**
```json
{
  "phoneNumber": "2349064982841"
}
```

**Response:**
```json
{
  "ok": true,
  "code": "ABCD1234"
}
```

---

#### `GET /vendors/:vendorId/status`
Returns the vendor's session status from both the DB and live from the baileys-gateway.

**Response:**
```json
{
  "vendorId": "uuid",
  "businessLineNumber": "2349064982841",
  "dbStatus": "connected",
  "inMemory": true
}
```

---

#### `PATCH /vendors/:vendorId/settings`
Updates vendor auto-status posting settings.

**Body** (all optional):
```json
{
  "autoStatusEnabled": true,
  "postingFrequencyHours": 6,
  "approveBeforePost": true
}
```

**Response:** `{ "ok": true }`

---

#### `GET /vendors/:vendorId/status-log`
Returns the WhatsApp Status posting history for this vendor.

**Query params:**
| Param | Default | Description |
|-------|---------|-------------|
| `limit` | `20` | Max rows to return |

**Response:** Array of:
```json
{
  "sku": "ANK-BLU-001",
  "product_name": "Blue Ankara Gown",
  "image_url": "https://...",
  "caption": "...",
  "posted_at": "2026-07-20T12:00:00Z"
}
```

---

#### `GET /vendors/:vendorId/queue`
Returns Status posts awaiting approval (only relevant when `approveBeforePost = true`).

**Response:** Array of:
```json
{
  "id": "uuid",
  "sku": "ANK-BLU-001",
  "product_name": "Blue Ankara Gown",
  "image_url": "https://...",
  "caption": "...",
  "queued_at": "2026-07-20T11:00:00Z",
  "approved_at": null
}
```

---

#### `POST /vendors/:vendorId/queue/:queueId/approve`
Approves a queued Status post for immediate publishing.

**Path params:** `vendorId`, `queueId`

**Response:** `{ "ok": true }`

---

## 4. Catalog Sync — Port 3003

Standalone service that pulls a merchant's Meta Commerce Catalog into the local `products` table. Also importable as a library (used by `merchant-api`'s `/catalog-sync` route).

**File:** `core/catalog-sync/src/index.ts`

---

### `POST /sync/:merchantId`

Fetches the merchant's WhatsApp catalog from the Meta Graph API (paginated) and upserts all items into `products`.

**Path param:** `merchantId`

**Response:**
```json
{
  "ok": true,
  "merchantId": "uuid",
  "catalogId": "1234567890",
  "fetched": 47,
  "upserted": 47
}
```

---

## 5. Payment Verification — Port 3002

Receives payment webhooks from banks/PSPs. Verifies HMAC signatures, matches the virtual account to an order, triggers the `PAYMENT_CONFIRMED` state transition, and notifies the customer via WhatsApp.

**File:** `core/payment-verification/src/index.ts`

---

### `POST /payment/webhook`

Receives and processes inbound payment confirmation webhooks. Supports multiple providers:

| Header | Provider |
|--------|----------|
| `x-ace-signature` | ACE internal / bank adapter |
| `x-paystack-signature` | Paystack |
| `verif-hash` | Flutterwave / others |

**Body:** Provider-specific JSON, normalised internally. Minimum expected fields after normalisation:
```json
{
  "providerRef": "TXN_12345",
  "amount": 28500,
  "virtualAccountNumber": "0123456789"
}
```

**Response `200`:** always immediate (ack pattern — all logic is async)

**Internal side-effects:**
- Deduplicates by `providerRef`
- Matches VAN → order
- Calls `orderStateMachine.transition(orderId, "PAYMENT_CONFIRMED")`
- Writes a ledger row
- Handles overpayment, underpayment, unmatched VAN with appropriate fallback messages to the customer

---

## 6–8. Library Modules (No HTTP Server)

These three modules have **no HTTP server**. They export functions that are imported by the services above.

| Module | File(s) | Key Exports |
|--------|---------|-------------|
| `comms-router` | `debounce.ts`, `outbound.ts`, `vendorCommunique.ts`, `whatsapp.ts` | `enqueueInboundMessage()`, `sendCustomerMessage()` |
| `ai-negotiator` | `agentLoop.ts`, `negotiationArc.ts`, `pricingService.ts`, `tools.ts` | `runNegotiationLoop()`, `buildSystemPrompt()` |
| `state-machine` | `orderStateMachine.ts` | `transition(orderId, event)` |
