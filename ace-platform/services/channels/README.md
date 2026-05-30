# Channels Service

> **ACE Platform — Phase 2 Microservice**

## Responsibility

Multi-channel message ingestion and normalisation. Each supported channel has its own adapter that translates inbound messages into ACE's unified internal event format.

## Supported Channels

| Channel | Adapter | Status |
|---------|---------|--------|
| WhatsApp | Evolved from Phase 1 Gateway | `[ ] Placeholder` |
| Instagram DM | Instagram Business API | `[ ] Placeholder` |
| SMS | Africa's Talking / Twilio | `[ ] Placeholder` |
| Voice | IVR provider (TBD) | `[ ] Placeholder` |
| Web Widget | ACE-built embed | `[ ] Placeholder` |
| Email | TBD | `[ ] Placeholder` |

## Folder Structure

```
channels/
├── whatsapp/
├── instagram/
├── sms/
├── voice/
└── web/
```

## Status

`[ ] Not started — placeholder`
