# Omni-Channel Communication Router

> **ACE WhatsApp — Core Microservice #10**  
> Stack: **Rust**  
> Role: Omni-Channel Shared Inbox router, message delivery watchdog, and the Vendor Communiqué engine

---

## Two Responsibilities

This service does two distinct things:

1. **Omni-Channel Customer Routing (Shared Inbox)** — routes inbound and outbound interactions across WhatsApp, Instagram, FB Messenger, Email, and VoIP. If a primary channel fails, it handles priority fallback via SMS or AI voice.
2. **Vendor Communiqué engine** — routes merchant decision requests via the appropriate channel (SMS reply-code, WhatsApp, app push, or AI voice call).

---

## Part A: Customer-Facing Fallback

### Priority Routing (Customer Communications)

| Order Value | Channel | Rationale |
|-------------|---------|-----------|
| > ₦50,000 | AI voice call | High-value = premium UX, highest conversion |
| ₦20,000 – ₦50,000 | Premium SMS | Important, cost-justified |
| ₦5,000 – ₦20,000 | Standard SMS | Cost-effective fallback |
| < ₦5,000 | Wait for reconnection | Unit economics don't justify channel cost |

```rust
enum EscalationPriority {
    Critical,   // Order value > ₦50K → AI voice call
    High,       // Order value ₦20K-₦50K → Premium SMS
    Medium,     // Order value ₦5K-₦20K → Standard SMS
    Low,        // Cart reminders < ₦5K → wait for reconnection
}
```

### Trigger Conditions
- WhatsApp delivery receipt not received within 5 minutes
- Customer unresponsive for > 2 hours on active order
- Payment timeout approaching (< 3 minutes on 15-min window)

---

## Part B: Vendor Communiqué Engine

The mechanism by which ACE communicates with merchants for decisions, summaries, and alerts. See full design: [VENDOR_COMMUNIQUE.md](../../../docs/product/VENDOR_COMMUNIQUE.md)

### Communiqué Types & Channels

| Communiqué Type | Default Channel | Configurable? |
|----------------|----------------|---------------|
| Negotiation exception (below-floor) | SMS (reply-code) | Yes |
| Restock approval request | SMS (reply-code) | Yes |
| High-value new customer decision | SMS (reply-code) | Yes |
| Payment anomaly alert | SMS (emergency override) | No |
| Order completion confirmation | WhatsApp | Yes |
| Daily morning digest | WhatsApp | Yes (time + channel) |
| Weekly performance summary | App push | Yes |
| AI voice call (> ₦50K exceptions) | Voice | Yes (toggle) |

### SMS Reply-Code Processor

```rust
struct SmsReplyProcessor {
    fn process_incoming_reply(
        &self,
        from_number: String,
        reply_text: String,
    ) -> Result<VendorDecision, Error> {
        // 1. Resolve merchant from phone number
        let merchant = self.merchant_repo.find_by_phone(&from_number)?;

        // 2. Find active communiqué session for this merchant
        let session = self.redis
            .get::<CommuniquéSession>(&merchant.id)
            .ok_or(Error::NoActiveCommuniqué)?;

        // 3. Parse reply code (handles: "1", "Yes", "Y", "Approve", "yes" etc.)
        let choice = self.parse_reply_leniently(&reply_text, session.option_count)?;

        // 4. Publish decision event to Kafka
        self.kafka.send("vendor.decisions", VendorDecision {
            merchant_id: merchant.id,
            session_id: session.id,
            choice,
            channel: DecisionChannel::Sms,
            response_time_seconds: session.elapsed_seconds(),
        })?;

        // 5. Send confirmation SMS back to merchant
        self.sms_client.send(SmsMessage {
            to: from_number,
            body: session.confirmation_messages[choice as usize].clone(),
        })?;

        Ok(session.decisions[choice as usize].clone())
    }
}
```

### Quiet Hours & Emergency Override

```rust
fn should_send_now(&self, merchant: &Merchant, communiqué_type: CommuniquéType) -> bool {
    let is_emergency = matches!(
        communiqué_type,
        CommuniquéType::PaymentFraud | CommuniquéType::LogisticsFailureHighValue
        | CommuniquéType::SupplierDispute | CommuniquéType::MultipleChargebacks
    );

    if is_emergency {
        return true;  // always sends, regardless of quiet hours
    }

    let now = current_time_for_merchant_timezone(merchant);
    !merchant.communiqué_quiet_hours.contains(now)
}
```

### Digest Builder

Compiles the morning briefing from multiple data sources:

```rust
struct DigestBuilder {
    fn build_daily_digest(&self, merchant_id: &str) -> Digest {
        Digest {
            revenue_yesterday: self.orders.sum_settled(merchant_id, yesterday()),
            orders_completed: self.orders.count_completed(merchant_id, yesterday()),
            orders_pending: self.orders.count_pending(merchant_id),
            awaiting_payment: self.orders.count_awaiting_payment(merchant_id),
            stock_alerts: self.inventory.get_low_stock(merchant_id),
            vip_alerts: self.crm.get_at_risk_vip_customers(merchant_id),
            actions_needed: self.exceptions.get_pending(merchant_id),
        }
    }
}
```

---

## Integrations

**Customer-facing:**
- **Twilio** — SMS + voice (primary)
- **Africa's Talking** — SMS (Nigeria/Kenya/Ghana optimised, lower latency)
- **Infobip** — SMS fallback

**Vendor communiqué:**
- Same SMS providers (separate sender IDs for merchant vs customer comms)
- WhatsApp Business Cloud API (for merchant WhatsApp digests)
- Push notification service → ACE merchant app

## Status

`[x] Implemented & Active`

- **Sliding Debounce Pipeline**: BullMQ-backed delayed job replacement (`turnQueue` + `turnWorker`) with sliding 10s window to batch rapid-fire bursts into atomic `ConversationTurn` payloads.
- **Multi-Vendor Isolation**: All message queues and buffers strictly keyed by `(merchantId, customerId)` with automatic `customer_merchant_links` persistence.
- **Vendor Communiqué Engine**: Two-way escalation engine formatting rich WhatsApp / SMS approval briefs for below-floor negotiations, stock exceptions, and payment anomalies with fast 1/2/3 reply code interception.
- **Transport Routing**: Unified outbound abstraction supporting WhatsApp Cloud Graph API and Baileys local business line sockets.

