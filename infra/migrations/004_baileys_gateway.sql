-- infra/migrations/004_baileys_gateway.sql
--
-- Schema additions for the Baileys business-line vendor model.
--
-- HOW TO RUN:
--   psql $DATABASE_URL -f infra/migrations/004_baileys_gateway.sql
--
-- WHAT THIS ADDS:
--   1. `vendors` table  — one row per business line. A vendor is a merchant's
--      operational identity on one WhatsApp number managed by Baileys.
--   2. `status_log` table — immutable log of every Status/Story post made
--      (for dashboard history and debugging).
--   3. `status_post_queue` table — pending posts waiting for vendor approval
--      (used when approve_before_post = true).
--   4. Column additions to `products` — last_posted_at, updated_at, and
--      a 'vendor_push' source value.

-- ─── 1. vendors ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS vendors (
  id                       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Which merchant this business line belongs to
  merchant_id              UUID        NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,

  -- The new SIM number (the "business line") — E.164 without '+': "2348012345678"
  -- NULL until the vendor has completed the pairing flow
  business_line_number     TEXT        UNIQUE,

  -- The vendor's own personal WhatsApp number — used by the classifier to
  -- identify inbound product submissions vs. customer queries
  personal_number          TEXT        NOT NULL,

  -- Contact number for reprovision alerts (SMS / another WA)
  notification_phone       TEXT,

  -- Session lifecycle managed by baileys-gateway
  session_status           TEXT        NOT NULL DEFAULT 'disconnected',
    -- Allowed values: 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'logged_out'

  -- Status (Story) posting configuration
  auto_status_enabled      BOOLEAN     NOT NULL DEFAULT false,
  posting_frequency_hours  INTEGER     NOT NULL DEFAULT 24,
  approve_before_post      BOOLEAN     NOT NULL DEFAULT true,  -- false = fully automatic

  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for merchant → vendor lookups (one merchant can have multiple business lines)
CREATE INDEX IF NOT EXISTS idx_vendors_merchant_id ON vendors (merchant_id);

-- ─── 2. status_log ────────────────────────────────────────────────────────────
-- Immutable audit log of every Status post made. Never delete rows here —
-- soft-delete by adding an 'error' column if a post failed.

CREATE TABLE IF NOT EXISTS status_log (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id   UUID        NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  sku         TEXT        NOT NULL,
  image_url   TEXT,
  caption     TEXT,
  posted_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- NULL on success, error message on failure (future)
  error       TEXT
);

CREATE INDEX IF NOT EXISTS idx_status_log_vendor_id  ON status_log (vendor_id);
CREATE INDEX IF NOT EXISTS idx_status_log_posted_at  ON status_log (posted_at DESC);

-- ─── 3. status_post_queue ─────────────────────────────────────────────────────
-- Used when approve_before_post = true. Items sit here until a merchant
-- approves them via the dashboard (PATCH /vendors/:id/queue/:queueId/approve).

CREATE TABLE IF NOT EXISTS status_post_queue (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id   UUID        NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  sku         TEXT        NOT NULL,
  image_url   TEXT,
  caption     TEXT,

  -- Lifecycle timestamps
  queued_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at TIMESTAMPTZ,                         -- NULL = pending review
  posted_at   TIMESTAMPTZ                          -- NULL = not yet posted
);

CREATE INDEX IF NOT EXISTS idx_status_queue_vendor_id ON status_post_queue (vendor_id);
CREATE INDEX IF NOT EXISTS idx_status_queue_pending
  ON status_post_queue (vendor_id)
  WHERE approved_at IS NOT NULL AND posted_at IS NULL;

-- ─── 4. products table additions ─────────────────────────────────────────────
-- The catalog-sync service already uses the `source` column ('whatsapp_catalog',
-- 'manual'). We add 'vendor_push' as a new valid value (no constraint to change).

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS last_posted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at     TIMESTAMPTZ DEFAULT now();

-- Back-fill updated_at for existing rows
UPDATE products SET updated_at = now() WHERE updated_at IS NULL;

-- ─── 5. vendor_decisions (already exists from vendorCommunique.ts) ────────────
-- This table is referenced in vendorCommunique.ts but may not exist yet.
-- Create it idempotently here.

CREATE TABLE IF NOT EXISTS vendor_decisions (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id    UUID        REFERENCES merchants(id),
  decision_type  TEXT        NOT NULL,  -- 'escalation_reply'
  channel        TEXT        NOT NULL,  -- 'sms' | 'whatsapp'
  choice         TEXT        NOT NULL,  -- 'approve_exception' | 'hold_firm' | 'offer_bundle'
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vendor_decisions_merchant ON vendor_decisions (merchant_id);
