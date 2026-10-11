-- infra/migrations/006_supplier_sourcing.sql
-- Adds the Sources, Source Quotes, and Merchant Pricing Defaults tables
-- for the Supplier Sourcing (B2B Procurement) feature.

-- ─── Sources ─────────────────────────────────────────────────────────────────
-- A "source" is anything the AI can query for a wholesale price:
-- a person on WhatsApp, a group chat, a warehouse API, or the merchant themselves.

CREATE TABLE IF NOT EXISTS sources (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id           UUID        NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  name                  TEXT        NOT NULL,  -- Human label: "Edwin", "Alaba Warehouse", "Unity"
  type                  TEXT        NOT NULL,  -- 'whatsapp_individual' | 'whatsapp_group' | 'warehouse_api' | 'self'
  contact               TEXT,                  -- Phone (E.164 no +), group JID, or API base URL
  description           TEXT,                  -- Free-text: "sells iPhones, Samsung, Android phones" (for semantic routing)
  known_skus            TEXT[]      NOT NULL DEFAULT '{}',  -- Explicit SKU list for exact-match routing
  is_default            BOOLEAN     NOT NULL DEFAULT false,  -- Broadcast to this source when no category match
  reply_timeout_minutes INT         NOT NULL DEFAULT 10,
  -- Pricing rules: JSONB array of PricingExpression, evaluated top-to-bottom.
  -- Shape: [{ if_cost_gte: 500000, markup_type: "flat", markup: 30000 }, ...]
  -- markup_type: "flat" | "percent" | "ask_merchant"
  pricing_rules         JSONB       NOT NULL DEFAULT '[]',
  avg_response_time_s   INT,                   -- Auto-tracked average reply speed
  active                BOOLEAN     NOT NULL DEFAULT true,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sources_merchant_id ON sources (merchant_id);
CREATE INDEX IF NOT EXISTS idx_sources_contact     ON sources (contact);
CREATE INDEX IF NOT EXISTS idx_sources_default     ON sources (merchant_id) WHERE is_default = true;

-- ─── Source Quotes ────────────────────────────────────────────────────────────
-- Immutable audit log of every price query sent and reply received.
-- One row per source contacted (a broadcast to 3 sources = 3 rows per order).

CREATE TABLE IF NOT EXISTS source_quotes (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id         UUID        REFERENCES orders(id),
  source_id        UUID        NOT NULL REFERENCES sources(id),
  merchant_id      UUID        NOT NULL REFERENCES merchants(id),
  customer_id      TEXT        NOT NULL,   -- WhatsApp phone of the customer waiting
  product_query    TEXT        NOT NULL,   -- "how much is iPhone 11"
  query_sent       TEXT        NOT NULL,   -- Exact WhatsApp message or API request sent
  reply_received   TEXT,                  -- Raw reply text from the source
  extracted_cost   NUMERIC,               -- Parsed wholesale price in NGN
  markup_applied   NUMERIC,               -- Amount added per pricing rules
  customer_price   NUMERIC,               -- Final price to quote the customer
  status           TEXT        NOT NULL DEFAULT 'pending',
    -- 'pending' | 'replied' | 'timed_out' | 'escalated' | 'used'
  sent_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  replied_at       TIMESTAMPTZ,
  used_at          TIMESTAMPTZ            -- When this quote was selected and sent to customer
);

CREATE INDEX IF NOT EXISTS idx_source_quotes_order_id    ON source_quotes (order_id);
CREATE INDEX IF NOT EXISTS idx_source_quotes_source_id   ON source_quotes (source_id);
CREATE INDEX IF NOT EXISTS idx_source_quotes_merchant_id ON source_quotes (merchant_id, status);
CREATE INDEX IF NOT EXISTS idx_source_quotes_pending     ON source_quotes (merchant_id)
  WHERE status = 'pending';

-- ─── Merchant Pricing Defaults ────────────────────────────────────────────────
-- Global fallback pricing rules if a source has no pricing_rules configured.
-- Same PricingExpression JSONB format as sources.pricing_rules.

CREATE TABLE IF NOT EXISTS merchant_pricing_defaults (
  merchant_id    UUID   PRIMARY KEY REFERENCES merchants(id) ON DELETE CASCADE,
  pricing_rules  JSONB  NOT NULL DEFAULT '[]',
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
