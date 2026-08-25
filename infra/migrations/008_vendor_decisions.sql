-- infra/migrations/008_vendor_decisions.sql

CREATE TABLE IF NOT EXISTS vendor_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES merchants(id),
  decision_type text NOT NULL, -- e.g., 'escalation_reply', 'restock_approval'
  channel text NOT NULL,       -- e.g., 'baileys', 'sms', 'graph_api'
  choice text NOT NULL,        -- e.g., 'approve_exception', 'hold_firm', 'offer_bundle'
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Basic row-level security
ALTER TABLE vendor_decisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Merchants can read their own decisions" 
  ON vendor_decisions 
  FOR SELECT 
  USING (merchant_id = current_setting('app.current_merchant_id')::uuid);
