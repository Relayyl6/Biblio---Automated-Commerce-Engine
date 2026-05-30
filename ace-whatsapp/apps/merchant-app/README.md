# Merchant App

> **ACE WhatsApp — Phase 1**  
> Stack: **React Native + Expo**  
> Platform: iOS + Android

## Why React Native + Expo

- Merchants are mobile-first: 97% of target users never touch a laptop
- Cross-platform from single codebase (iOS + Android)
- Expo OTA updates bypass app store approval for rapid iteration
- Native performance for real-time chat rendering

## Design Philosophy

**The merchant's dashboard should be empty most of the time.** ACE handles 94%+ of interactions autonomously. This app surfaces only the 6% requiring human judgment.

## Core Screens

### 1. Command Center (Home)
- Live order velocity meter (orders/hour)
- Cash flow river (money in vs. out, real-time)
- AI-generated daily briefing: _"3 VIP customers haven't ordered in 2 weeks. Tap to see drafts."_
- Exception queue: _"2 payments need manual verification. 1 supplier awaiting approval."_

### 2. Conversation Hub
- Unified timeline of all customer interactions
- Each thread shows: Customer LTV · Order history · AI confidence score · Autonomous actions taken
- Only the exceptions bubble up

### 3. Inventory Oracle
- Auto-updating stock levels based on sales velocity
- Predictive restocking alerts: _"Run out of Blue Ankara in 4 days. Pre-negotiated restock ready. Approve?"_

### 4. Financial Dashboard
- Real-time reconciliation of all payment channels
- Outstanding receivables with AI-drafted follow-up messages
- Margin analysis per product (live)

### 5. Autonomous Settings
- Define autonomy boundaries: _"Auto-approve purchases under ₦50K. Auto-apply loyalty discounts up to 8%."_
- Connect bank accounts, payment processors, logistics partners
- Regional dialect calibration (Pidgin / Yoruba / Hausa / Igbo)

## Status

`[ ] Not started — placeholder`
