import { sql } from './shared/src/clients.js';
async function main() {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS merchant_pricing_rules (
        merchant_id UUID PRIMARY KEY,
        max_discount_percent NUMERIC NOT NULL DEFAULT 10,
        min_margin_percent NUMERIC NOT NULL DEFAULT 15,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS winback_drafts (
        id TEXT PRIMARY KEY,
        merchant_id UUID NOT NULL,
        customer_id UUID NOT NULL,
        proposed_discount_percent NUMERIC NOT NULL,
        message_draft TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `;
    console.log('Retention Engine tables created.');
  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}
main();
