# Supplier Integration Service

> **ACE WhatsApp — Core Microservice #7**  
> Stack: **Rust**  
> Role: Autonomous demand-driven restocking — merchant's only job is a 1-tap approval

## Responsibility

Detects impending stockouts before they happen, autonomously contacts suppliers, pre-negotiates pricing, performs margin analysis, and surfaces a ready-to-approve purchase order to the merchant. End-to-end time for merchant: ~8 seconds.

## Key Functions

### Inventory Oracle (background — runs every 6 hours)
- Analyses sales velocity for all SKUs per merchant
- Computes 7-day moving average sales rate
- Calculates predicted stockout time = `current_stock / avg_daily_sales`
- Triggers restock workflow when predicted stockout < 24 hours

### Supplier Communication
- Queries merchant's verified supplier database
- Sends WhatsApp template message to supplier via Business API
- Example: _"Hello Alhaji, ACE here for [Merchant]. Need 50 yards Red Ankara at your last price ₦800/yard. Available?"_
- Awaits supplier response (natural language or structured)

### Margin Analysis
- Calculates COGS from supplier quote
- Validates against merchant's acceptable margin floor (merchant-configured)
- Marks PO as auto-approvable if margin ≥ floor, escalates if not
- Example: ₦42K for 50 yards → ₦840/yard COGS → selling at ₦1,500 → 44% margin → ✓ auto-approvable

### Merchant Notification & 1-Tap Approval
- Sends merchant a concise notification: _"Red Ankara running out (8 yards, ~16hrs). Restock: 50 yards from Alhaji Ibrahim, ₦42K (44% margin). Tap to approve."_
- On approval: triggers payment to supplier, sends pickup confirmation, updates inventory forecast

### Gap Management
- During restocking gap, automatically tells customers: _"Fresh stock arriving tomorrow! Reserve now at 10% off for pre-orders."_

## Exclusive Supplier Network (The Structural Moat)
ACE negotiates platform rates with wholesalers based on aggregate committed volume:
- Example: Ankara fabric at ₦900/yard direct → ₦720/yard via ACE (20% discount)
- For a merchant doing ₦500K/month revenue, leaving ACE costs ₦100K/month in lost margin vs ₦12K subscription

## Status

`[ ] Not started — placeholder`
