import { sql } from '../shared/src/clients.js';

async function migrate() {
  console.log('Migrating support_tickets schema...');
  await sql`
    CREATE TABLE IF NOT EXISTS support_tickets (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      merchant_id text NOT NULL,
      reference text NOT NULL,
      subject text NOT NULL,
      message text NOT NULL,
      priority text DEFAULT 'normal',
      category text DEFAULT 'general',
      status text DEFAULT 'open',
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_support_tickets_merchant_id ON support_tickets(merchant_id)`;
  console.log('support_tickets migrated successfully!');
  process.exit(0);
}

migrate().catch(e => {
  console.error('Migration failed:', e);
  process.exit(1);
});
