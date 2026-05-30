# Shared Libraries

> Cross-cutting code shared between `ace-whatsapp/` (Phase 1) and `ace-platform/` (Phase 2)

## Structure

```
shared/
├── ai-sdk/            # Vercel AI SDK shared config, tools, schemas, middleware
├── proto/             # gRPC Protocol Buffer definitions (all Rust inter-service calls)
├── event-schemas/     # Kafka event schemas (Avro / JSON Schema)
├── ai-models/         # Shared trained model artifacts and embeddings
└── common/            # Shared types, utilities, validation helpers
```

## Principles

- Nothing in `shared/` has a runtime dependency on a specific application
- Versioned independently — changes must be backward-compatible or explicitly versioned
- All Kafka event schemas live here — they are the immutable contracts between services
- All gRPC protobuf definitions live here — services import, never define their own
- All Vercel AI SDK tool definitions, schemas, and middleware live in `ai-sdk/` — shared between phases

---

## `ai-sdk/` — [See README](./ai-sdk/README.md)

Vercel AI SDK shared configuration used by the intent parser (Phase 1) and the enhanced AI engine (Phase 2).

Key contents:
- **Tool definitions** — all `tool()` calls the AI agent can make (calls Rust services)
- **Training middleware** — `wrapLanguageModel()` that captures every AI interaction to Kafka
- **Model registry** — maps current phase to active model (easy swap for fine-tuned models)
- **Intent schema** — Zod schema for `generateObject` structured output
- **Provider config** — OpenAI / Anthropic / fine-tuned model routing

---

## `proto/` — gRPC Definitions

Rust microservice-to-microservice communication contracts.

Key proto files (planned):
- `intent.proto` — Intent Parser → State Machine (proposes action)
- `pricing.proto` — State Machine → Pricing Service (authorised price range)
- `inventory.proto` — State Machine / AI → Inventory Service (stock check)
- `logistics.proto` — State Machine → Logistics (dispatch request)
- `payment.proto` — State Machine → Payment Verification (confirm payment)
- `identity.proto` — AI → Identity Resolution (customer profile lookup)

---

## `event-schemas/` — Kafka Event Schemas

The canonical event definitions. All services publish and consume using these schemas.

Key events (planned):

| Event | Producer | Consumers |
|-------|----------|-----------|
| `MessageReceived` | Ingestion Service | Intent Parser, Identity Resolution |
| `IntentClassified` | Intent Parser | State Machine |
| `OrderCreated` | State Machine | Payment Verification, Logistics |
| `PaymentVerified` | Payment Verification | State Machine, Logistics |
| `RiderDispatched` | Logistics | Ingestion (notification send) |
| `OrderDelivered` | Logistics | Payment Verification (escrow release) |
| `StockLow` | Supplier Integration | Merchant App (notification) |
| `PurchaseOrderApproved` | Merchant App | Supplier Integration, Payment |
| `CustomerAtRisk` | CRM/Retention | Intent Parser (draft message) |
| `training.interactions.raw` | AI SDK Middleware | Data Refinement Pipeline |
| `commerce.events.demand` | State Machine | FMCG Intelligence Pipeline |
| `merchant.signals.behavioral` | Multiple | TrustScore Pipeline |

---

## `ai-models/` — Shared Model Artifacts

- Fine-tuned model weights (after Phase 2 training completes)
- Dialect BERT checkpoint (shared between intent parser and data refinement)
- Whisper fine-tuned checkpoint (shared between ingestion and intent parser)
- CLIP/ViT visual embeddings (used by visual context service)

---

## `common/` — Shared Types & Utilities

- TypeScript types (shared between PWA, merchant app, AI SDK layer)
- Rust crates (shared between all Rust microservices)
- Validation helpers, error types, logging utilities

## Status

`[ ] Not started — placeholder`
