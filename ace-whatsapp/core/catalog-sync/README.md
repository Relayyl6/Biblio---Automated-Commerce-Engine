# Meta Commerce Catalog Sync

> **ACE WhatsApp — Core Microservice #6**  
> Stack: **TypeScript / Node.js + Meta Graph API v21.0**  
> Role: Autonomous synchronization between Meta Commerce Manager / WhatsApp Catalogs and the local ACE product database

---

## What This Does

Pulls a merchant's Meta Commerce Catalog directly into ACE's `products` table so the AI Negotiator operates on the exact live catalog the merchant maintains on WhatsApp and Instagram — eliminating double data entry.

```
Meta Commerce Manager / WhatsApp Catalog
         │  (Graph API v21.0)
         ▼
catalogMapper.ts (minor-unit conversion, availability mapping, slug fallback)
         │
         ▼
PostgreSQL `products` table (active SKUs, prices, stock, image URLs)
```

---

## Route Definitions (Port 3004)

| Method | Route | Description |
|--------|-------|-------------|
| `POST` | `/sync/:merchantId` | Triggers immediate full catalog sync from Meta Commerce for the specified merchant |
| `GET`  | `/health` | Healthcheck and service readiness probe |

---

## Key Functions

- `syncMerchantCatalog(merchantId)`: Programmatic entrypoint to fetch and map catalog pages into PostgreSQL.
- `mapCatalogProduct(product, options)`: Pure transformation function converting Meta products into ACE schema (handles minor units/kobo, out-of-stock tags, and SKU generation).
- `fetchAllCatalogProducts(catalogId)`: Recursive cursor-based Graph API fetcher traversing paginated catalog collections.

---

## Status

`[x] Implemented & Active`

- **Meta Graph API Client**: Integrated with Graph API `v21.0` pulling catalog products with minor-unit normalization.
- **Fastify Service & Library**: Callable both as an HTTP microservice on `:3004` and as a TypeScript library imported across the monorepo.
