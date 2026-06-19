-- infra/schema.sql
--
-- Minimal schema to run the critical path end-to-end. A few notes on
-- choices that matter:
--
-- * `state jsonb` on orders: the OrderState discriminated union maps
--   directly to JSONB. This is a deliberate trade — you give up some
--   query-ability (harder to `WHERE status = 'draft'` without the
--   ->> operator) in exchange for the TS type and the DB row NEVER
--   disagreeing about shape. Add a generated column
--   (`status text generated always as (state->>'status') stored`) if you
--   need to index/filter on status frequently.
--
-- * pg_trgm extension: powers the `similarity()` call in tools.ts'
--   checkInventory — trigram similarity search is the cheapest way to get
--   "fuzzy product name match" without standing up a separate search
--   index (Elasticsearch/Meilisearch) for an MVP catalog of a few hundred
--   SKUs. Revisit once a merchant catalog exceeds ~10k products.

create extension if not exists pg_trgm;
create extension if not exists "uuid-ossp";

create table merchants (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  phone_number_id text not null unique, -- WhatsApp Business phone_number_id
  -- ── Seller context the AI negotiator speaks from ──────────────────────────
  -- These are injected into the negotiator's system prompt so each merchant's
  -- agent sounds like THEM, not a generic bot. See agentLoop.buildSystemPrompt.
  tone_guide text,            -- voice/persona, e.g. "Warm Lagos market trader"
  business_policies text,     -- standing rules: returns, min order, hours, etc.
  delivery_info text,         -- delivery areas, fees, timelines the AI may quote
  dialect text not null default 'pidgin', -- pidgin | yoruba | igbo | hausa | english
  -- ──────────────────────────────────────────────────────────────────────────
  whatsapp_catalog_id text,   -- Meta commerce catalog id, for catalog-sync
  default_discount_pct numeric not null default 0,
  created_at timestamptz not null default now()
);

-- Phase 1 identity resolution stub: one row per (customer phone, merchant).
-- Replace with the real Global Buyer ID resolution in Phase 2 — at that
-- point this table becomes a many-to-many link rather than the primary
-- identity source.
create table customer_merchant_links (
  customer_id text not null, -- WhatsApp phone number, E.164
  merchant_id uuid not null references merchants(id),
  created_at timestamptz not null default now(),
  primary key (customer_id, merchant_id)
);

create table products (
  sku text not null,
  merchant_id uuid not null references merchants(id),
  name text not null,
  stock integer not null default 0,
  price numeric not null,
  -- ── Deep product context the AI negotiator can sell on ────────────────────
  -- The richer this is, the better the agent describes, bundles, and justifies
  -- value instead of just discounting. check_inventory returns all of it.
  description text,                          -- selling copy: fabric, fit, story
  category text,                             -- e.g. "Ankara", "Footwear"
  tags jsonb not null default '[]',          -- ["wedding","plus-size","blue"]
  attributes jsonb not null default '{}',    -- {"sizes":["M","L"],"color":"blue","material":"100% cotton wax"}
  image_url text,                            -- catalog/IG image (visual-context, Phase 2)
  currency text not null default 'NGN',
  active boolean not null default true,      -- soft-hide without deleting
  -- Source of truth for this row: 'manual' (admin/seed) or 'whatsapp_catalog'.
  source text not null default 'manual',
  updated_at timestamptz not null default now(),
  primary key (sku, merchant_id)
);

create index products_name_trgm_idx on products using gin (name gin_trgm_ops);
-- Trigram index on description too, so the agent can match on selling copy
-- ("the flowy blue one") not just the product name.
create index products_description_trgm_idx on products using gin (description gin_trgm_ops);
create index products_category_idx on products (merchant_id, category);

create table orders (
  id uuid primary key,
  merchant_id uuid not null references merchants(id),
  customer_id text not null,
  state jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index orders_customer_merchant_idx on orders (customer_id, merchant_id, updated_at desc);

-- Payment-verification looks up the awaiting-payment order by the virtual account
-- number the customer paid into. This expression index keeps that lookup cheap.
create index orders_virtual_account_idx on orders ((state->>'virtualAccountNumber'));

-- ─── Transactions (payment ledger) ─────────────────────────────────────────────
-- One row per inbound payment event from a bank/card provider. `provider_ref` is
-- UNIQUE — it is the idempotency key that makes webhook redelivery a no-op (the
-- payment provider, like Meta, retries until it gets a 2xx). Mirrors the
-- `transactions` table in infra/README.md.
create table transactions (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid references orders(id),
  merchant_id uuid not null references merchants(id),
  customer_id text not null,
  amount numeric not null,                 -- amount paid, in NGN
  virtual_account text,                    -- the VAN credited
  provider_ref text not null unique,       -- bank/card reference — idempotency key
  status text not null,                    -- 'confirmed' | 'underpaid' | 'unmatched'
  created_at timestamptz not null default now()
);

create index transactions_order_idx on transactions (order_id, created_at desc);
create index transactions_merchant_idx on transactions (merchant_id, created_at desc);

create table escalations (
  id uuid primary key default uuid_generate_v4(),
  merchant_id uuid not null references merchants(id),
  customer_id text not null,
  reason text not null,
  context jsonb not null,
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);

-- ─── Merchant Pricing Rules ────────────────────────────────────────────────────
-- One row per merchant. Merchant configures these once via the merchant app.
-- ai-negotiator reads this to compute AuthorizedPriceRange.
create table merchant_pricing_rules (
  merchant_id uuid primary key references merchants(id),
  base_price numeric not null default 0,       -- Default anchor (per-product in Phase 2)
  absolute_floor numeric not null default 0,   -- Hard floor, never crossed
  -- JSONB columns for tier maps — see pricingService.ts for the shape.
  -- Example: '{"new":0.05,"returning":0.15,"loyal":0.22,"vip":0.30}'
  max_discount_by_tier jsonb not null default '{"new":0.05,"returning":0.15,"loyal":0.22,"vip":0.30}',
  max_bundle_value_add_by_tier jsonb not null default '{"new":0,"returning":0.10,"loyal":0.20,"vip":0.30}',
  future_credit_cap_by_tier jsonb not null default '{"new":0,"returning":1000,"loyal":2500,"vip":5000}',
  updated_at timestamptz not null default now()
);

-- ─── Negotiation Trace ─────────────────────────────────────────────────────────
-- Full arc recorded at session end. This is the NegotiationTrace from the
-- README — the enterprise data asset and training signal.
create table negotiation_traces (
  session_id uuid primary key,
  merchant_id uuid not null references merchants(id),
  customer_id text not null,
  customer_tier text not null,
  anchor_price numeric not null,
  authorized_floor numeric not null,
  outcome text not null,          -- 'closed' | 'below_floor_escalated' | 'bundle_closed' | 'abandoned'
  final_price numeric,
  final_margin numeric,           -- final_price - absolute_floor — computed on insert
  tactics_deployed jsonb not null default '[]',
  tactics_succeeded jsonb not null default '[]',
  price_elasticity_signal numeric, -- customer_final_offer / base_price
  turns jsonb not null default '[]',
  created_at timestamptz not null default now()
);

create index negotiation_traces_merchant_idx on negotiation_traces (merchant_id, created_at desc);
create index negotiation_traces_outcome_idx on negotiation_traces (outcome);