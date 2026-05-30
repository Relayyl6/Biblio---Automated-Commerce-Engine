# Vendor Communiqué System

> **ACE — Merchant Communication Protocol**  
> How ACE talks to merchants, collects their preferences, and keeps them in control  
> even when they're not looking at the app

---

## The Design Problem

ACE runs 94% of operations autonomously. But the remaining 6% — exceptions, approvals, high-stakes negotiations — require the merchant's input. The challenge:

**Merchants are not sitting at a dashboard. They're at the market. In traffic. Managing physical stock. They have WhatsApp open, not the ACE app.**

The Vendor Communiqué system solves this by meeting merchants where they are, using the **minimum viable channel required** for each type of decision — including SMS for decisions that don't need the app.

---

## The Communiqué Hierarchy

ACE selects the right channel for every merchant touchpoint based on urgency, decision complexity, and order value.

```
                    HIGH URGENCY / HIGH VALUE
                              │
                    ┌─────────▼─────────┐
                    │   AI VOICE CALL   │  Order > ₦50K exception
                    │                   │  Payment dispute escalation
                    └─────────┬─────────┘  Time-sensitive fraud alert
                              │
                    ┌─────────▼─────────┐
                    │    SMS COMMUNIQUÉ │  Most exceptions (any phone)
                    │   (reply-code     │  Below-floor negotiation decisions
                    │    protocol)      │  Supplier approval requests
                    └─────────┬─────────┘  High-value restock approvals
                              │
                    ┌─────────▼─────────┐
                    │  WHATSAPP MESSAGE │  Routine summaries
                    │  (to merchant's   │  Daily digest
                    │   personal WA)    │  Completed order confirmations
                    └─────────┬─────────┘  Draft re-engagement messages
                              │
                    ┌─────────▼─────────┐
                    │    ACE APP PUSH   │  Non-urgent alerts
                    │   NOTIFICATION    │  Performance summaries
                    └───────────────────┘  Weekly analytics
                    
                    LOW URGENCY / ROUTINE
```

---

## The SMS Communiqué Protocol

The SMS channel is designed for **zero-app, zero-smartphone-dependency decisions**. Every SMS from ACE is structured so the merchant can reply with a single digit or short code from any phone.

### Format

```
ACE: [EXCEPTION TYPE] - [1-LINE CONTEXT]
[OPTION 1] | [OPTION 2] | [OPTION 3]
Reply: 1, 2, or 3

Examples:

ACE: NEGOTIATION - Amaka wants dress at ₦12K (your floor: ₦14,250)
1-Approve ₦12K | 2-Hold firm ₦14,250 | 3-Offer bundle
Reply 1, 2, or 3

ACE: RESTOCK - Red Ankara running out (16hrs). Alhaji: ₦42K for 50yds (44% margin)
1-Approve payment | 2-Negotiate lower | 3-Skip this restock
Reply 1, 2, or 3

ACE: PAYMENT - ₦45K order from NEW customer. Payment unconfirmed after 30min.
1-Send reminder | 2-Cancel order | 3-Extend 30min more
Reply 1, 2, or 3
```

### How Replies Are Processed

```
Merchant replies: "1"
      │
      ▼
comms-router/sms-reply-processor (Rust):
  ├─ Maps SMS source number → merchant_id
  ├─ Finds active communiqué for this merchant (Redis lookup by session_id)
  ├─ Maps reply "1" → action enum (e.g., ApproveNegotiationException)
  ├─ Publishes: VendorDecisionReceived event to Kafka
  └─ Downstream service executes the decision
      │
      ├─ State Machine receives → transitions order state
      ├─ AI Negotiator receives → responds to customer with approved price
      └─ Supplier Integration receives → triggers payment
```

### Confirmation Back to Merchant

After any SMS decision:
```
ACE: Done! ₦12K approved for Amaka. She's completing payment now.
```

---

## The Vendor Voice Profile

Before ACE's AI speaks on behalf of a merchant, it learns **how that merchant speaks**. The Vendor Voice Profile ensures the AI sounds like them — not like generic customer service.

### Profile Dimensions

```typescript
interface VendorVoiceProfile {
  // Tone calibration
  formality: 'very_casual' | 'casual' | 'friendly_professional' | 'professional'
  emojiUsage: 'heavy' | 'moderate' | 'minimal' | 'none'
  languagePrimary: Dialect  // english | pidgin | yoruba | hausa | igbo
  languageMix: Dialect[]    // will code-switch between these

  // Relationship style
  addressesCustomerAs: 'by_name' | 'informal' | 'respectful' | 'playful'
  closingStyle: 'warm' | 'direct' | 'transactional'
  
  // Negotiation personality
  negotiationStyle: 'firm' | 'flexible' | 'warm_firm' | 'relationship_first'
  usesScarcityTactics: boolean  // some merchants don't want this
  usesHumour: boolean

  // Autonomy boundaries
  autoApproveBelow: number      // ₦ amount — AI fully autonomous below this
  requireApprovalAbove: number  // ₦ amount — always SMS merchant above this
  alwaysConsultFor: string[]    // specific scenarios: ['new_customer_bulk', 'custom_orders']

  // Communication preferences
  communiquéChannelPreference: 'sms' | 'whatsapp' | 'app_only'
  communiquéQuietHours: { start: string, end: string }  // e.g. "22:00" to "07:00"
  dailyDigestTime: string       // e.g. "08:00" — morning briefing
}
```

### How the Profile Is Built

**Week 1 (Onboarding):** Merchant answers 8 questions in a conversational onboarding flow.  
**Ongoing:** AI observes merchant corrections and edits. If merchant consistently rewrites formal AI messages to be more casual → `formality` auto-updates.  
**Merchant control:** Can edit any dimension in ACE app → Autonomous Settings → Voice & Communication.

---

## The Daily Merchant Briefing

Every morning at the merchant's configured time, ACE sends a digest via their preferred channel.

### WhatsApp Version

```
Good morning! Here's yesterday's summary for your business:

💰 Revenue: ₦124,500 (12 orders completed)
📦 Pending: 2 orders awaiting delivery
⏳ Awaiting payment: 1 order (Chisom, ₦18,500 — 2hrs remaining)
📉 Stock alert: Blue Satin Midi Dress — 2 units left
👥 VIP alert: Blessing hasn't ordered in 27 days

Actions needed from you today: 1
  → Review: Supplier restock proposal from Alhaji Ibrahim (₦42K, 44% margin)
    [Tap to review]

Everything else handled ✓
```

### SMS Version (for merchants who prefer minimal app usage)

```
ACE MORNING BRIEF: Revenue ₦124.5K (12 orders). 1 action needed: 
Restock proposal ₦42K. Reply Y to approve, N to skip. Details in app.
```

---

## Communiqué Decision Log

Every vendor decision — whether made via SMS, app, or voice — is logged and becomes a training signal.

```typescript
interface VendorDecision {
  merchantId: string  // hashed
  decisionType: 'negotiation_exception' | 'restock_approval' | 'payment_extension' | 'custom_exception'
  channel: 'sms' | 'whatsapp' | 'app' | 'voice'
  responseTimeSeconds: number  // how fast did merchant respond?
  optionChosen: number  // which option (1, 2, 3)?
  outcome: string  // what happened as a result?
  
  // Training value
  contextSnapshot: object  // full business context at decision time
  // This teaches the AI: "In this context, merchants typically choose option X"
  // → Over time, AI can pre-recommend the right option, reducing merchant cognitive load
}
```

**The self-improving loop:** As ACE sees which options merchants consistently choose, it starts pre-selecting the recommended option in the communiqué and reduces the number of SMS decisions needed over time. After 6 months, many merchants are only making truly novel decisions.

---

## Quiet Hours & Emergency Override

```typescript
// If communiqué_quiet_hours = "22:00–07:00":
// ACE buffers all non-urgent communiqués → sends at 07:00 digest

// Emergency override conditions (always sends regardless of quiet hours):
const EMERGENCY_CONDITIONS = [
  'payment_fraud_detected',          // potential fraudulent transaction
  'logistics_failure_high_value',    // delivery failed on > ₦50K order
  'supplier_dispute',                // supplier claims non-payment
  'multiple_chargebacks_detected',   // platform safety threshold breached
]
```

---

## The Vendor Communiqué as Data

Like everything in ACE, the communiqué system generates enterprise-valuable data:

| Signal | Enterprise Value |
|--------|-----------------|
| Merchant response time to SMS | TrustScore: operational responsiveness |
| Decisions made per day | TrustScore: exception rate (lower = better AI calibration) |
| Which options merchants choose | AI training: preference prediction model |
| Communiqué quiet hours pattern | FMCG: merchant active hours by geography |
| Voice profile formality settings | Language intelligence: dialect/register mapping |
