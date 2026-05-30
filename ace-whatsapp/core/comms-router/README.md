# Out-of-Band Communication Router

> **ACE WhatsApp — Core Microservice #10**  
> Stack: **Rust**  
> Role: Message delivery watchdog and priority escalation for when WhatsApp is unavailable

## Responsibility

Monitors message delivery status across the system. When WhatsApp delivery fails, is unavailable, or when order value warrants a higher-touch channel, this service routes communication via SMS or AI voice calls using priority-based logic.

## Priority Routing Logic

| Order Value | Channel | Rationale |
|-------------|---------|-----------|
| > ₦50,000 | AI voice call | High-value transaction = premium UX, highest conversion |
| ₦20,000 – ₦50,000 | Premium SMS | Important, cost-justified |
| ₦5,000 – ₦20,000 | Standard SMS | Cost-effective fallback |
| < ₦5,000 | Wait for reconnection | Unit economics don't justify channel cost |

## Key Functions

- **Delivery watchdog**: monitors WhatsApp message delivery receipts; triggers fallback after configurable timeout
- **SMS gateway**: Twilio / Infobip integration for SMS fallback
- **AI voice orchestration**: for high-value orders, initiates outbound AI call to confirm/follow up
- **Priority queue**: high-value orders jump the queue
- **Retry logic**: configurable retry intervals and maximum attempts per channel

## Integrations
- **Twilio** — SMS + voice
- **Infobip** — SMS (alternative/Africa-optimised)
- **Africa's Talking** — Local SMS gateway (lower latency for NG/KE/GH)

## Status

`[ ] Not started — placeholder`
