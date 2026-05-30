# Global Infrastructure

> Database and messaging infrastructure shared across both product phases.

## Stack

| Service | Technology | Role |
|---------|-----------|------|
| `postgres/` | PostgreSQL | Primary transactional database — financial ledger, orders, merchants |
| `qdrant/` | Qdrant (Rust-native) | Vector database — conversation embeddings, visual product embeddings |
| `redis/` | Redis | Real-time state cache, rate limiting, distributed locks |
| `kafka/` | Apache Kafka | Immutable event queue — all inter-service domain events |
| `clickhouse/` | ClickHouse | Analytics data warehouse — FMCG dashboards, enterprise data |

## Database Design Notes

### PostgreSQL — Primary Transactional DB
- ACID compliance is non-negotiable for financial ledger integrity
- Partitioned by `merchant_id` for horizontal scalability
- Key tables:
  - `merchants` — subscription, settings, autonomy boundaries
  - `customers` — `global_buyer_id` as PK, phone hash, verified profile
  - `orders` — full order lifecycle, state machine history
  - `products` — SKU catalogue, pricing rules per customer tier
  - `transactions` — all financial events, immutable
  - `payment_verifications` — bank API responses, OCR results, escrow status
  - `escrow_accounts` — per-order escrow lifecycle
  - `suppliers` — merchant's supplier directory, pricing history

### Qdrant — Vector DB (Rust-native)
- Conversation embeddings: enables AI to recall context from months-old chats
  - "Customer mentioned Saturday deliveries 6 months ago" → still available
- Visual product embeddings (for Visual Context Resolution Service)
  - Instagram/Facebook post frames → CLIP embeddings → SKU search
- Indexed by: `merchant_id`, `customer_id`, `timestamp`, `embedding_type`

### Redis — Real-Time State Cache
- Active conversation state per customer (debounce window contents)
- Service Window tracking: 24hr free WhatsApp reply window per conversation
- Rate limiting counters (per merchant, per customer, per API endpoint)
- Distributed locks: prevents race conditions in concurrent payment processing
- Temporary order state during payment flow (TTL: 15 minutes)

### Apache Kafka — Immutable Event Log
- All inter-service communication uses events (no direct API calls for domain events)
- Immutable append-only log enables event replay for debugging
- Topics (planned):
  - `messages.inbound` · `messages.outbound`
  - `orders.lifecycle` · `payments.lifecycle`
  - `inventory.events` · `logistics.events`
  - `data.refinement` (feeds enterprise pipeline)
- Retention: 90 days hot, then archive to cold storage (feeds data intelligence product)

### ClickHouse — Analytics Data Warehouse
- Columnar storage for fast analytical queries at scale
- Powers the FMCG Market Intelligence real-time dashboards
- Aggregate merchant performance metrics
- Feeds enterprise buyer API endpoints
- ETL from Kafka via Kafka Connect → ClickHouse sink

## Hosting Considerations

> ⚠️ Placeholder — to be confirmed during infrastructure design phase

- Primary region: AWS `af-south-1` (Cape Town) — nearest current region to Nigeria
- Evaluate: GCP Lagos (if available by build date)
- Data residency: Nigerian merchant and customer data must not leave Africa
- Disaster recovery: multi-AZ within region minimum; cross-region for critical data

## Status

`[ ] Not started — placeholder`
