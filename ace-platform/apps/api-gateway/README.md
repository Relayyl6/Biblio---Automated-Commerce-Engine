# API Gateway

> **ACE Platform — Phase 2**  
> Unified entry point for all external and internal traffic.

## Responsibility

Single entry point for all API traffic. Handles authentication, tenant isolation, rate limiting, and routing to downstream services. Also serves the public API for merchant integrations and enterprise buyers.

## Key Responsibilities

- JWT and API key authentication
- Merchant (tenant) isolation enforcement
- Rate limiting and quota management
- Request routing to microservices
- Webhook registration and delivery
- Public API documentation (OpenAPI/Swagger)
- Internal service mesh routing

## API Surface (Planned)

- `POST /v1/messages` — Send messages across channels
- `GET /v1/orders` — Order management
- `GET/POST /v1/inventory` — Inventory management
- `GET /v1/customers` — Customer data
- `GET /v1/analytics` — Business metrics
- `GET /v1/intelligence/*` — Enterprise data product (for approved buyers)

## Status

`[ ] Not started — placeholder`
