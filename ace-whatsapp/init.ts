import { sql } from '@ace/shared/clients.js';
async function run() {
  await sql`CREATE TABLE IF NOT EXISTS dispatch_drafts (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), merchant_id UUID NOT NULL, order_id UUID NOT NULL, status TEXT NOT NULL DEFAULT 'pending', created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW())`;
  process.exit(0);
}
run();
