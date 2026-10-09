import { sql } from './shared/src/clients.js';
async function main() {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS suppliers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        merchant_id UUID NOT NULL,
        name TEXT NOT NULL,
        contact_phone TEXT,
        contact_email TEXT,
        preferred_channel TEXT DEFAULT 'whatsapp',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS restock_drafts (
        id TEXT PRIMARY KEY,
        merchant_id UUID NOT NULL,
        supplier_id UUID NOT NULL,
        inventory_item_id UUID NOT NULL,
        proposed_quantity INT NOT NULL,
        message_draft TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `;
    console.log('Supplier tables created.');
  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}
main();
