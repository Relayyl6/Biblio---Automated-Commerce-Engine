const fs = require('fs');
let file = 'infra/schema.sql';
let content = fs.readFileSync(file, 'utf8');

const missingSql = `
-- Transactional Outbox for State Machine Events
CREATE TABLE IF NOT EXISTS outbox_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processed_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX IF NOT EXISTS idx_outbox_pending ON outbox_events (status, created_at);
`;

if (!content.includes('outbox_events')) {
  fs.appendFileSync(file, missingSql);
  console.log('Appended outbox_events table to schema.sql');
}
