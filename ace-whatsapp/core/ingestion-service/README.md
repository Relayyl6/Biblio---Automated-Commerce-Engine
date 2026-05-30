# Ingestion Service

> **ACE WhatsApp — Core Microservice #1**  
> Stack: **Rust + Actix-web**  
> Role: Entry point for all inbound WhatsApp traffic

## Responsibility

Owns the WhatsApp Business Cloud API connection. Ingests all inbound messages from merchants and customers, normalises them, and publishes to the Kafka event stream.

## Key Functions

- Webhook endpoint with Meta HMAC signature verification
- Rate limiting and deduplication (prevents duplicate processing of same message)
- Message ordering guarantees per conversation thread
- Media processing queue:
  - Voice notes → Whisper transcription queue
  - Images → OCR queue (bank transfer screenshots)
  - Documents → extraction queue
- **Message Consolidation Engine**: 15-second batching window, compresses multiple AI intents into single outbound WhatsApp message (targets 2.3 messages/order)
- **Service Window Optimizer**: tracks 24hr free-reply window per conversation, strategically prompts customer to reply before window expires (₦0 vs $0.01/message)
- Outbound message delivery via WhatsApp Business Cloud API
- Template message auto-selection (₦0.003 vs ₦0.01 for conversational — 70% savings)

## Publishes (Kafka Events)

- `MessageReceived` — text message ingested
- `VoiceNoteReceived` — audio file queued for transcription
- `PaymentScreenshotReceived` — image queued for OCR
- `OutboundMessageDelivered` — confirms delivery status

## Consumes (Kafka Events)

- `OutboundMessageCommand` — from State Machine / other services

## Critical Metrics to Track

- Messages per completed order (target: ≤ 2.3)
- % conversations in free service window (target: ≥ 78%)
- Meta API cost per merchant per month (target: < $2.50)

## Status

`[ ] Not started — placeholder`
