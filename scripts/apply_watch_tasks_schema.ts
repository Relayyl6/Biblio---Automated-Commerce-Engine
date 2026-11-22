import { sql } from '../shared/src/clients.js';

async function migrate() {
  console.log('Applying customer_watch_tasks table migration...');
  
  await sql`
    CREATE TABLE IF NOT EXISTS customer_watch_tasks (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      customer_id TEXT NOT NULL,
      merchant_id UUID NOT NULL,
      criteria JSONB NOT NULL,
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'fulfilled', 'cancelled', 'expired')),
      expiry TIMESTAMPTZ NOT NULL,
      notify_channel TEXT NOT NULL DEFAULT 'whatsapp',
      last_checked_at TIMESTAMPTZ,
      matched_items JSONB,
      notification_sent BOOLEAN NOT NULL DEFAULT false,
      notification_sent_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_watch_tasks_active 
    ON customer_watch_tasks (merchant_id, status) 
    WHERE status = 'active'
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_watch_tasks_customer 
    ON customer_watch_tasks (customer_id, status)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_watch_tasks_expiry 
    ON customer_watch_tasks (expiry) 
    WHERE status = 'active'
  `;

  console.log('Migration completed successfully!');
  process.exit(0);
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
