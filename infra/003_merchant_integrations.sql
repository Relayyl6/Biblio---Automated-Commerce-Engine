CREATE TABLE IF NOT EXISTS merchant_integrations (
  merchant_id UUID REFERENCES merchants(id),
  provider VARCHAR(50) NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TIMESTAMP,
  metadata JSONB DEFAULT '{}'::jsonb,
  PRIMARY KEY (merchant_id, provider)
);
