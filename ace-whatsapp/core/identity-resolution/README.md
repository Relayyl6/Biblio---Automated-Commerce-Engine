# Identity Resolution Service

> **ACE WhatsApp — Core Microservice #2**  
> Stack: **Rust**  
> Role: Builds and maintains the Global Buyer ID — the cross-platform customer identity graph

## Responsibility

Clusters phone numbers, usernames, and email addresses from any channel into a single canonical `global_buyer_id`. This is the foundation of the cross-merchant 1-tap checkout network effect — ACE's most powerful structural moat.

## Key Functions

- **Contact Merge (Omni-Channel)**: If the same customer messages on WhatsApp in the morning and emails in the afternoon, the platform recognizes it's the same person and merges their profiles into a single thread.
- **Identifier clustering**: Maps phone numbers, WhatsApp IDs, Instagram handles, emails → single `global_buyer_id`.
- **Fuzzy name resolution**: "David", "Dave", "Davido" + same phone number → same identity.
- **Cross-platform coherence**: Same customer messaging via WhatsApp and Instagram DM = unified profile avoiding duplicate tickets.
- **Profile enrichment**: Aggregates purchase history, preferences, and addresses across all ACE merchants
- **1-tap checkout enablement**: Verified details pre-populate on any ACE PWA after first checkout
- **Privacy-preserving**: Internal ID is a hash — PII stored separately with strict access controls

## The Network Effect This Creates

```
Customer first purchase (Merchant A):
  Fills checkout form → global_buyer_id created

Customer second purchase (Merchant B, different merchant):
  Opens PWA → form auto-filled → "Confirm" (8 seconds)

After 3+ purchases across different ACE merchants:
  93% probability customer uses ACE for next informal purchase
```

## Data Model (Draft)

```
global_buyer_id (PK, UUID)
├── phone_number_hash (indexed, anonymised)
├── verified_name
├── verified_address
├── payment_preferences
├── purchase_history[] → cross-merchant order refs
└── merchant_interactions[] → per-merchant preference data
```

## Status

`[ ] Not started — placeholder`
