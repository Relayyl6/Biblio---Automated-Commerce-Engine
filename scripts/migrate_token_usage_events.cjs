const fs = require('fs');
const postgres = require('postgres');

const env = fs.readFileSync('.env', 'utf8');
const match = env.match(/DATABASE_URL=(.+)/);
let url = match[1].trim();
if ((url.startsWith('"') && url.endsWith('"')) || (url.startsWith("'") && url.endsWith("'"))) {
  url = url.slice(1, -1);
}

const sql = postgres(url, { ssl: 'require' });

async function main() {
  console.log('Creating token_usage_events table...');
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS token_usage_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
      feature TEXT NOT NULL,
      tokens_used BIGINT NOT NULL DEFAULT 0,
      naira_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
      metadata JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_token_usage_merchant_created ON token_usage_events (merchant_id, created_at);
  `);
  console.log('token_usage_events table ready!');
  await sql.end();
}

main().catch(err => {
  console.error('Migration error:', err);
  process.exit(1);
});
