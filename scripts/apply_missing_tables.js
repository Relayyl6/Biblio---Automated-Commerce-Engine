import 'dotenv/config';
import { sql } from '../shared/src/clients.js';

async function main() {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS merchant_integrations (
        merchant_id UUID NOT NULL,
        provider TEXT NOT NULL,
        access_token TEXT NOT NULL,
        refresh_token TEXT,
        token_expires_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
        PRIMARY KEY (merchant_id, provider)
      );
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS appointments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        merchant_id UUID NOT NULL,
        customer_id TEXT NOT NULL,
        service_id UUID NOT NULL,
        start_time TIMESTAMP WITH TIME ZONE NOT NULL,
        end_time TIMESTAMP WITH TIME ZONE NOT NULL,
        status TEXT NOT NULL DEFAULT 'confirmed',
        calendar_event_id TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS merchant_background_tasks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        merchant_id UUID NOT NULL,
        customer_id TEXT,
        topic TEXT NOT NULL,
        task_type TEXT NOT NULL DEFAULT 'inventory_sourcing',
        criteria JSONB DEFAULT '{}'::jsonb,
        status TEXT NOT NULL DEFAULT 'active',
        last_checked_at TIMESTAMP WITH TIME ZONE,
        found_result JSONB,
        notification_sent BOOLEAN DEFAULT false,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS idx_bg_tasks_merchant 
      ON merchant_background_tasks(merchant_id, status);
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS idx_bg_tasks_customer 
      ON merchant_background_tasks(customer_id);
    `;
    console.log('Tables created successfully.');
  } catch (e) {
    console.error('Error applying schema:', e);
  } finally {
    process.exit(0);
  }
}
main();
