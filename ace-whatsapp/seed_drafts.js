import { sql } from './shared/src/clients.js';
async function createTables() {
  await sql\
    CREATE TABLE IF NOT EXISTS winback_drafts (
      id UUID PRIMARY KEY,
      merchant_id UUID NOT NULL,
      customer_id TEXT NOT NULL,
      proposed_discount_percent NUMERIC,
      message_draft TEXT,
      status TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );
  \;
  await sql\
    CREATE TABLE IF NOT EXISTS restock_drafts (
      id UUID PRIMARY KEY,
      merchant_id UUID NOT NULL,
      supplier_id TEXT,
      inventory_item_id UUID,
      proposed_quantity NUMERIC,
      message_draft TEXT,
      status TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );
  \;
  
  // Seed with some test drafts for the UI to read
  await sql\
    INSERT INTO winback_drafts (id, merchant_id, customer_id, proposed_discount_percent, message_draft, status)
    VALUES (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', '2348011111111', 15, 'Blessing! We missed you. New Ankara just landed. 15% off for you today.', 'pending')
    ON CONFLICT DO NOTHING;
  \;
  
  console.log('Tables created and seeded.');
  process.exit(0);
}
createTables();
