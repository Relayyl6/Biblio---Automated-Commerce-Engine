# Customer PWA

> **ACE WhatsApp — Phase 1**  
> Stack: **Progressive Web App**  
> Delivery: Embedded link sent via WhatsApp, opens in in-app browser

## The Trojan Horse Strategy

Customers interact purely via WhatsApp in Phase 1. For complex interactions (browsing a 50-item catalog, customising orders, managing a checkout), ACE's AI sends a PWA link. It opens **inside WhatsApp's built-in browser** — feels native, loads instantly.

**Critical transition point:** The transaction now happens on ACE's servers, not Meta's ecosystem. This is where the Global Buyer ID is created and the network effect begins.

## Core Views

### Product Detail
- Product images, size/variant selectors
- Pre-filled customer details from Global Buyer ID (returning customers)
- Real-time stock availability

### Checkout
- Order summary with applied discounts (from AI negotiation)
- Payment options:
  - Bank transfer to dynamic virtual account
  - Card (Paystack)
  - Pay-on-delivery (where merchant-enabled)
- Delivery address confirmation

### Order Tracking
- Real-time rider tracking (Kwik/Gokada/MAX integration)
- Live ETA updates

### Order History (Phase 1.5+)
- Across all ACE merchants the customer has bought from
- Re-order with one tap

## Global Buyer ID Flow

```
First purchase (any ACE merchant):
  Customer fills checkout form (2 minutes)
  → Global Buyer ID created (phone number → profile)
  
All subsequent purchases (any ACE merchant):
  Form auto-filled → "Confirm" button appears immediately (8 seconds)
```

## Design Constraints
- Must load fast on 3G (< 3s First Contentful Paint)
- Offline-capable for order tracking view
- Touch targets sized for phone-only users
- English + Pidgin UI copy

## Status

`[ ] Not started — placeholder`
