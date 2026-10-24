const fs = require('fs');
const postgres = require('postgres');

const env = fs.readFileSync('.env', 'utf8');
const match = env.match(/DATABASE_URL=(.+)/);
if (!match) {
  console.error('No DATABASE_URL found');
  process.exit(1);
}
let url = match[1].trim();
if ((url.startsWith('"') && url.endsWith('"')) || (url.startsWith("'") && url.endsWith("'"))) {
  url = url.slice(1, -1);
}

const sql = postgres(url, { ssl: 'require' });

async function main() {
  console.log('Running v7 schema migration on PostgreSQL...');

  await sql.unsafe(`
    -- 1. Chat Classifications Table (Section 2 of Brief v7)
    CREATE TABLE IF NOT EXISTS chat_classifications (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
      chat_id TEXT NOT NULL,
      customer_id TEXT,
      classification TEXT NOT NULL DEFAULT 'uncertain', -- 'business', 'personal', 'uncertain'
      confidence DOUBLE PRECISION DEFAULT 0.5,
      reasons JSONB DEFAULT '[]'::jsonb,
      vendor_override TEXT, -- 'business', 'personal', 'ignore'
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      CONSTRAINT uq_merchant_chat_classification UNIQUE (merchant_id, chat_id)
    );

    -- 2. Chat Quarantine Table (Section 2 & 3 of Brief v7 - Short TTL Quarantine)
    CREATE TABLE IF NOT EXISTS chat_quarantine (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
      chat_id TEXT NOT NULL,
      message_id TEXT NOT NULL,
      content TEXT,
      sender_phone TEXT,
      status TEXT NOT NULL DEFAULT 'quarantined', -- 'quarantined', 'approved', 'discarded'
      expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours'),
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- 3. Vendor Presence State Table (Section 1 of Brief v7)
    CREATE TABLE IF NOT EXISTS vendor_presence (
      merchant_id UUID PRIMARY KEY REFERENCES merchants(id) ON DELETE CASCADE,
      state TEXT NOT NULL DEFAULT 'present', -- 'present', 'delayed', 'away', 'off'
      sla_minutes INTEGER NOT NULL DEFAULT 10,
      read_grace_minutes INTEGER NOT NULL DEFAULT 5,
      cover_me BOOLEAN NOT NULL DEFAULT false,
      last_active_at TIMESTAMPTZ DEFAULT NOW(),
      context_summary TEXT,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- 4. Chat Overrides Table (Hands-off & Per-chat controls)
    CREATE TABLE IF NOT EXISTS chat_overrides (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
      chat_id TEXT NOT NULL,
      hands_off BOOLEAN NOT NULL DEFAULT false,
      hold_queue BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      CONSTRAINT uq_merchant_chat_override UNIQUE (merchant_id, chat_id)
    );

    -- 5. Veto Audit Logs Table (Section 8 of Brief v7)
    CREATE TABLE IF NOT EXISTS veto_audit_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
      chat_id TEXT,
      action_type TEXT NOT NULL, -- 'reply_review', 'live_barge_in', 'undo_rollback', 'guardrail_block', 'hands_off', 'kill_switch'
      blocked_by TEXT NOT NULL, -- 'operator' or 'guardrail'
      reason TEXT,
      payload JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- 6. Token Ledgers & Spend Caps Table (Section 7 of Brief v7)
    CREATE TABLE IF NOT EXISTS token_ledgers (
      merchant_id UUID PRIMARY KEY REFERENCES merchants(id) ON DELETE CASCADE,
      balance_tokens BIGINT NOT NULL DEFAULT 50000,
      balance_naira NUMERIC(12, 2) NOT NULL DEFAULT 5000.00,
      daily_cap NUMERIC(12, 2) NOT NULL DEFAULT 15000.00,
      monthly_cap NUMERIC(12, 2) NOT NULL DEFAULT 100000.00,
      spent_today NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
      spent_month NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
      burn_rate_7d NUMERIC(12, 2) NOT NULL DEFAULT 1200.00,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- 7. Add Unified Message Model Columns to conversation_messages (Section 4 of Brief v7)
    ALTER TABLE conversation_messages ADD COLUMN IF NOT EXISTS author_type TEXT DEFAULT 'customer';
    ALTER TABLE conversation_messages ADD COLUMN IF NOT EXISTS content_type TEXT DEFAULT 'text';
    ALTER TABLE conversation_messages ADD COLUMN IF NOT EXISTS reply_to_id TEXT;
    ALTER TABLE conversation_messages ADD COLUMN IF NOT EXISTS edit_history JSONB DEFAULT '[]'::jsonb;
    ALTER TABLE conversation_messages ADD COLUMN IF NOT EXISTS delete_state TEXT DEFAULT 'none';
    ALTER TABLE conversation_messages ADD COLUMN IF NOT EXISTS reactions JSONB DEFAULT '[]'::jsonb;
    ALTER TABLE conversation_messages ADD COLUMN IF NOT EXISTS delivery_state TEXT DEFAULT 'delivered';
    ALTER TABLE conversation_messages ADD COLUMN IF NOT EXISTS read_state TEXT DEFAULT 'read';
    ALTER TABLE conversation_messages ADD COLUMN IF NOT EXISTS handled_by TEXT DEFAULT 'biblio';
    ALTER TABLE conversation_messages ADD COLUMN IF NOT EXISTS internal_notes TEXT;
    ALTER TABLE conversation_messages ADD COLUMN IF NOT EXISTS message_priority TEXT DEFAULT 'normal';
  `);

  console.log('Migration successfully completed!');
  await sql.end();
}

main().catch(err => {
  console.error('Migration error:', err);
  process.exit(1);
});
