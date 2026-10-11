const fs = require('fs');
let file = 'infra/schema.sql';
let content = fs.readFileSync(file, 'utf8');

const missingSql = `

-- Added from apply_retention.js
CREATE TABLE IF NOT EXISTS merchant_pricing_rules (
  merchant_id UUID PRIMARY KEY,
  max_discount_percent NUMERIC NOT NULL DEFAULT 10,
  min_margin_percent NUMERIC NOT NULL DEFAULT 15,
  winback_discounts_enabled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS winback_drafts (
  id TEXT PRIMARY KEY,
  merchant_id UUID NOT NULL,
  customer_id TEXT NOT NULL,
  proposed_discount_percent NUMERIC NOT NULL,
  message_draft TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Added from apply_suppliers.js
CREATE TABLE IF NOT EXISTS suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL,
  name TEXT NOT NULL,
  contact_phone TEXT,
  contact_email TEXT,
  preferred_channel TEXT DEFAULT 'whatsapp',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS restock_drafts (
  id TEXT PRIMARY KEY,
  merchant_id UUID NOT NULL,
  supplier_id UUID,
  inventory_item_id UUID NOT NULL,
  proposed_quantity INT NOT NULL,
  message_draft TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Added from apply_tone_guides.js
CREATE TABLE IF NOT EXISTS tone_guides (
  id TEXT PRIMARY KEY,
  operator_id UUID,
  version INT,
  sections JSONB,
  approved_by TEXT,
  approved_at TIMESTAMP WITH TIME ZONE,
  supersedes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT false,
  merchant_id UUID,
  style_metrics JSONB,
  status TEXT DEFAULT 'pending_approval'
);
CREATE INDEX IF NOT EXISTS idx_tone_guides_operator ON tone_guides (operator_id);
`;

if (!content.includes('winback_drafts')) {
  fs.appendFileSync(file, missingSql);
  console.log('Appended missing tables to schema.sql');
} else {
  console.log('Tables already exist in schema.sql');
}
