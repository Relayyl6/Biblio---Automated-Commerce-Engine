# State Machine Orchestrator

> **ACE WhatsApp — Core Microservice #4**  
> Stack: **Rust**  
> Role: Deterministic control plane — the AI suggests, Rust approves

## Responsibility

The most critical service in the system. Validates all state transitions against hard business rules. The LLM (Intent Parser) proposes transitions; this service either approves them or rejects them based on deterministic logic. **No LLM output can modify merchant financial data without passing through this service.**

## Key Functions

- **Deterministic state chart engine**: validates all proposed state transitions
- **30–45 second debounce window**: clusters rapid successive messages from same customer into single intent (prevents duplicate orders)
- **Hard rule enforcement**: merchant-configured boundaries cannot be overridden by LLM
- **Confidence-based escalation**: routes to merchant exception queue when AI confidence < threshold
- **Audit log**: every state transition is logged with timestamp, actor, and reason

## Order State Machine

```
AWAITING_INTENT
    │ (customer message parsed)
    ▼
INTENT_CONFIRMED
    │ (product found, price negotiated within bounds)
    ▼
AWAITING_PAYMENT
    │ (virtual account issued, 15min timer started)
    ├─→ PAYMENT_TIMEOUT (15min elapsed, reminder sent)
    │
    ▼
PAYMENT_VERIFIED
    │ (bank API confirms transfer)
    ├─→ inventory decremented
    ├─→ logistics dispatch triggered
    ▼
OUT_FOR_DELIVERY
    │ (rider assigned, ETA sent to customer)
    ▼
DELIVERED
    │ (GPS drop-off confirmed OR 24hr auto-release)
    ├─→ escrow released to merchant
    └─→ DISPUTED (customer raises claim within 24hr)
```

## The AI/Determinism Split

```
Intent Parser (Python/LLM):          State Machine (Rust):
  - What does the customer want?        - Is this transition valid?
  - What's the best response?           - Does it violate any rule?
  - What discount should we offer?      - Is the confidence high enough?
  
  Suggests → → → → → → → → → → → → → Approves or Rejects
```

## Exception Routing

Escalates to merchant when:
- AI confidence < 0.80 on intent classification
- Requested action exceeds merchant's configured autonomy boundaries
- Payment amount mismatch > ₦500
- New customer, high-value order (> ₦100K), no prior history

## Status

`[ ] Not started — placeholder`
