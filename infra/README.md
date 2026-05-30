# Infrastructure — Database & Event Architecture

> All five persistence layers used by ACE, with design rationale.  
> Applies to both Phase 1 (ace-whatsapp/) and Phase 2 (ace-platform/).

---

## The Five-Layer Persistence Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│  PostgreSQL          Primary transactional database                 │
│  ACID · merchant-partitioned · financial ledger                     │
├─────────────────────────────────────────────────────────────────────┤
│  Qdrant              Vector database                                │
│  Conversation embeddings · visual product embeddings               │
├─────────────────────────────────────────────────────────────────────┤
│  Redis               Real-time state cache                          │
│  Active conversation state · service window · distributed locks     │
├─────────────────────────────────────────────────────────────────────┤
│  Apache Kafka        Immutable event log                            │
│  All domain events · training data pipeline · inter-service bus     │
├─────────────────────────────────────────────────────────────────────┤
│  ClickHouse          Data warehouse                                 │
│  FMCG dashboards · enterprise analytics · training signal store     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## PostgreSQL — Primary Transactional Database

**Why PostgreSQL:**  
ACID compliance is non-negotiable for financial operations. ACE manages escrow accounts, payment verification, and merchant settlements. A race condition or partial write in financial data is catastrophic. PostgreSQL's MVCC guarantees transactional integrity under concurrent load.

**Schema design:**

| Table | Primary Key | Key Columns |
|-------|------------|-------------|
| `merchants` | `merchant_id` (UUID) | phone, subscription_tier, voice_profile, autonomy_settings |
| `customers` | `global_buyer_id` (UUID) | phone_hash, verified_profile, tier, cross_merchant_history |
| `orders` | `order_id` (UUID) | merchant_id, customer_id, state, items, negotiated_price |
| `products` | `sku_id` (UUID) | merchant_id, name, base_price, stock, category |
| `transactions` | `tx_id` (UUID) | order_id, amount, virtual_account, bank_ref, status |
| `escrow_accounts` | `escrow_id` (UUID) | order_id, held_amount, release_trigger, status |
| `negotiation_traces` | `trace_id` (UUID) | order_id, anchor, close, tactics_used, outcome |
| `vendor_decisions` | `decision_id` (UUID) | merchant_id, decision_type, channel, response_time_s, choice |
| `supplier_orders` | `po_id` (UUID) | merchant_id, supplier_id, sku_id, quantity, unit_cost, status |

**Multi-tenancy isolation (Row-Level Security):**
```sql
-- Every table uses RLS — no application-layer mistake can cross tenant boundaries
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY merchant_isolation ON orders
    USING (merchant_id = current_setting('app.current_merchant_id')::uuid);

-- Applied at connection establishment — Rust services set this per request
SET LOCAL app.current_merchant_id = $merchant_id;
```

**Partitioning:** All large tables partitioned by `merchant_id` (hash partitioning, 64 buckets). Enables independent scaling per merchant cluster.

---

## Qdrant — Vector Database

**Why Qdrant:**  
Rust-native client, purpose-built for high-dimensional vector similarity search, and runs efficiently on commodity hardware. ACE needs vector search for two use cases with very different embedding models — Qdrant supports multiple collections with independent configurations.

**Collections:**

| Collection | Embedding Model | Dimension | Use Case |
|-----------|----------------|-----------|---------|
| `conversations` | Sentence-BERT (dialect-tuned) | 768 | Long-term customer context recall |
| `visual_products` | CLIP / ViT | 512 | "That dress in your reel" → SKU resolution |

**Conversation memory:**  
Every customer-merchant exchange is embedded and stored. When a customer messages again (even months later), the AI retrieves the most semantically relevant past context before generating a response.

> "This customer mentioned they prefer Saturday deliveries — 6 months ago."  
> "She's bought Ankara fabric 7 times. She's never bought accessories."

**Visual product resolution:**  
Instagram/Facebook posts and video frames are embedded via CLIP. When a customer says "that blue dress in your last reel", the query "blue dress last reel" is embedded and similarity-searched against the merchant's visual index → returns the matching SKU.

**Namespace isolation:** Each merchant's embeddings live in a Qdrant namespace. Cross-merchant search is architecturally prevented at the query level.

---

## Redis — Real-Time State Cache

**Why Redis:**  
Sub-millisecond latency for state lookups that happen on every message. PostgreSQL queries would add unacceptable latency to the conversation flow. Redis holds the hot state; PostgreSQL is the durable record.

**Key namespaces:**

| Namespace | TTL | Contents |
|-----------|-----|----------|
| `conv:{customer_id}:state` | 48 hours | Active conversation state machine position |
| `conv:{customer_id}:window` | 24 hours | WhatsApp service window expiry timestamp |
| `conv:{customer_id}:batch` | 15 seconds | Pending message intents (consolidation window) |
| `order:{order_id}:timer` | 15 minutes | Payment deadline countdown |
| `communique:{merchant_id}:active` | 4 hours | Active Vendor Communiqué session (SMS reply mapping) |
| `rate:{phone}:{endpoint}` | 60 seconds | Rate limiting counters per phone per endpoint |
| `lock:{resource_id}` | Variable | Distributed locks (prevents duplicate rider bookings, double-payment) |

**Service Window Optimizer:**  
Redis tracks the exact timestamp when the 24-hour free WhatsApp response window opens (triggered by customer message). The AI checks this before every outbound message — if < 2 hours remain, it triggers a window-refresh prompt to the customer before sending anything costly.

---

## Apache Kafka — Immutable Event Log

**Why Kafka:**  
ACE is event-driven by design. Kafka is the backbone that decouples every service from every other service, enables independent scaling, and provides an immutable audit trail of every business event — critical for financial disputes, training data lineage, and debugging.

**Every domain event is published to Kafka. No service calls another service directly for domain events.**

**Topic architecture:**

| Topic | Producers | Key Consumers |
|-------|----------|--------------|
| `messages.received` | Ingestion Service | Identity Resolution, Intent Parser |
| `intents.classified` | Intent Parser | State Machine, AI Negotiator |
| `orders.state_changed` | State Machine | Payment, Logistics, Comms Router |
| `payments.verified` | Payment Verification | State Machine, Logistics, Escrow |
| `riders.dispatched` | Logistics | State Machine, Ingestion (notification) |
| `orders.delivered` | Logistics | Payment (escrow release), CRM |
| `negotiations.traces` | AI Negotiator | Data Refinement, ClickHouse |
| `negotiations.escalations` | AI Negotiator | Comms Router (→ SMS communiqué) |
| `vendor.decisions` | Comms Router | State Machine, AI Negotiator, Supplier Integration |
| `inventory.low_stock` | Inventory Oracle | Supplier Integration |
| `commerce.events.product_intel` | State Machine | ClickHouse, FMCG pipeline |
| `commerce.events.transactions` | Payment Verification | ClickHouse, TrustScore pipeline |
| `training.interactions.raw` | AI SDK Middleware | Data Refinement Pipeline |
| `training.interactions.clean` | Data Refinement | AI Training Jobs |
| `merchant.signals.behavioral` | Multiple | TrustScore Pipeline |

**Partition key:** Always `merchant_id` — ensures all events for a merchant are processed in order by the same consumer instance.

**Retention:** All topics: 30-day hot retention. Topics feeding the data intelligence pipeline: 365-day cold retention (S3-backed log compaction).

---

## ClickHouse — Data Warehouse

**Why ClickHouse:**  
Columnar storage enables sub-second aggregation queries over billions of rows. The FMCG Market Pulse dashboard needs real-time "demand for Blue Band in Surulere this week" — this would take minutes in PostgreSQL and seconds in most data warehouses. ClickHouse does it in milliseconds.

**Key tables:**

| Table | Purpose | Update Frequency |
|-------|---------|-----------------|
| `product_transactions` | Every completed sale: SKU, price, geo, tier, discount | Real-time (Kafka consumer) |
| `demand_signals` | Every product inquiry, even if not purchased | Real-time |
| `negotiation_analytics` | NegotiationTrace aggregates per SKU/geo/tier | Real-time |
| `merchant_performance` | Fulfillment rates, delivery times, complaint rates | Hourly rollup |
| `customer_segments` | Cohort analysis, LTV distributions | Daily rollup |
| `stockout_events` | When, where, which SKU, demand during gap | Real-time |
| `supplier_performance` | Delivery reliability, pricing trends | Daily rollup |

**Materialized views for FMCG dashboards:**
```sql
-- Pre-computed for sub-second response on the enterprise dashboard
CREATE MATERIALIZED VIEW demand_by_sku_geo_week AS
SELECT
    product_category,
    sku_name,
    geo_lga,
    toStartOfWeek(event_time) AS week,
    count() AS inquiry_count,
    countIf(purchased = true) AS purchase_count,
    avg(transaction_price) AS avg_actual_price,
    avg(listed_price) AS avg_listed_price,
    avg(transaction_price / listed_price) AS price_realisation_rate
FROM demand_signals
GROUP BY product_category, sku_name, geo_lga, week
ORDER BY week DESC, inquiry_count DESC;
```

---

## Infrastructure Directory

```
infra/
├── postgres/
│   ├── migrations/        # Versioned schema migrations (sqlx)
│   ├── seeds/             # Dev/test seed data
│   └── rls-policies/      # Row-level security policy definitions
│
├── qdrant/
│   ├── collections/       # Collection configuration (dimensions, distance metric)
│   └── namespaces/        # Namespace templates per merchant
│
├── redis/
│   ├── config/            # Redis cluster configuration
│   └── keyspace/          # Key naming conventions and TTL reference
│
├── kafka/
│   ├── topics/            # Topic definitions (retention, partitions, replication)
│   ├── schemas/           # Event schemas (JSON Schema / Avro)
│   └── consumer-groups/   # Consumer group definitions per service
│
└── clickhouse/
    ├── tables/            # Table DDL definitions
    ├── materialized-views/ # Pre-computed FMCG/analytics views
    └── retention/         # TTL policies and tiered storage config
```

## Status

`[ ] Infrastructure config not yet written — placeholder directory structure only`
