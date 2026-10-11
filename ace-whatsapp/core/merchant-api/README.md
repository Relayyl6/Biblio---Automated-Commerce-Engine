# Merchant Management API & Control Plane

> **ACE WhatsApp — Core Microservice #3**  
> Stack: **TypeScript / Fastify + JWT Auth + PostgreSQL**  
> Role: Self-serve merchant control plane powering the Expo Merchant App and Admin Ops Portal

---

## What This Does

The configuration and control plane for the autonomous engine. It owns everything the AI Negotiator and State Machine read as "seller context":

- **Merchant Identity & Voice**: `name`, `tone_guide`, `business_policies`, `delivery_info`, and regional `dialect` (Pidgin, Yoruba, Hausa, Igbo, Nigerian English).
- **Autonomous Pricing Rules**: Maximum floor discount, customer loyalty tiers, margin targets.
- **Product Catalog Management**: Products, rich descriptions, tags, and automated Meta Commerce catalog syncing.
- **Vendor Line Provisioning**: Baileys WhatsApp Web QR pairing, status rotation configs, and approval queues.
- **Analytics & Telemetry**: Token consumption, gross merchandise value (GMV), price elasticity metrics, and exception logs.

---

## Key Route Definitions (Port 3003)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/auth/token` | Issue dev/test JWT token |
| `POST` | `/auth/otp/send` | Dispatch Twilio Verify OTP to merchant phone |
| `POST` | `/auth/otp/verify` | Verify OTP code and issue JWT |
| `POST` | `/merchants` | Register or update merchant profile & voice guide |
| `GET`  | `/merchants/:id` | Fetch full merchant profile |
| `POST` | `/pricing-rules` | Set floor price and customer tier discounts |
| `GET`  | `/pricing-rules/:merchantId` | Read merchant autonomous pricing rules |
| `POST` | `/products` | Upsert SKU with rich metadata |
| `GET`  | `/products/:merchantId` | List active inventory |
| `POST` | `/merchants/:id/sync-catalog` | Trigger Meta Commerce Manager catalog pull |
| `POST` | `/vendors` | Provision Baileys business line |
| `POST` | `/vendors/:id/pair` | Request WhatsApp 8-digit pairing code |
| `GET`  | `/vendors/:id/status` | Read Baileys socket connection state |
| `GET`  | `/analytics/summary` | Global engine KPI summary |

---

## Status

`[x] Implemented & Active`

- **Full REST Control Plane**: 20+ validated routes covering auth, pricing rules, catalog, vendor lines, and analytics.
- **Fastify & CORS**: Built with fast schema validation and CORS enabled for mobile/web apps.
- **Data Intelligence Wired**: All analytics routes connected directly to `DataIntelligenceEngine`.
