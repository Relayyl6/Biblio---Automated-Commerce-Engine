# Shared Libraries

> Cross-cutting code shared between `ace-whatsapp/` (Phase 1) and `ace-platform/` (Phase 2)

## Structure

```
shared/
├── proto/             # gRPC Protocol Buffer definitions (shared across all Rust services)
├── event-schemas/     # Kafka event schemas (Avro / JSON Schema)
├── ai-models/         # Shared trained models, embeddings, classifiers
└── common/            # Shared types, utilities, validation helpers
```

## Principles

- Nothing in `shared/` has a runtime dependency on a specific application
- Versioned independently — changes must be backward-compatible or versioned with migration
- All Kafka event schemas are defined here and used as the contract between services
- All gRPC protobuf definitions live here — services import, never define their own

## proto/
gRPC service definitions for all Rust microservice-to-microservice communication. Services communicate via gRPC for synchronous calls, Kafka for domain events.

Key proto files (planned):
- `intent.proto` — Intent Parser → State Machine
- `pricing.proto` — State Machine → Pricing Service
- `logistics.proto` — State Machine → Logistics Coordination
- `payment.proto` — State Machine → Payment Verification

## event-schemas/
Kafka event schemas. These are the immutable contracts of the event log.

Key events (planned):
- `MessageReceived` · `VoiceNoteReceived` · `PaymentScreenshotReceived`
- `IntentClassified` · `OrderCreated` · `PaymentVerified`
- `RiderDispatched` · `OrderDelivered` · `DisputeRaised`
- `StockLow` · `PurchaseOrderDrafted` · `PurchaseOrderApproved`
- `CustomerAtRisk` · `RetentionMessageSent`

## Status

`[ ] Not started — placeholder`
