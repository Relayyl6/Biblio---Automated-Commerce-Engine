import { sql } from '../shared/src/clients.js';

async function migrate() {
  console.log("Migrating audit_logs table...");
  await sql`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      service text NOT NULL,
      merchant_id text NOT NULL,
      action text NOT NULL,
      metadata jsonb DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS audit_logs_merchant_idx ON audit_logs (merchant_id)`;
  await sql`CREATE INDEX IF NOT EXISTS audit_logs_service_idx ON audit_logs (service)`;
  await sql`CREATE INDEX IF NOT EXISTS audit_logs_created_idx ON audit_logs (created_at DESC)`;
  console.log("audit_logs table migrated successfully!");
  process.exit(0);
}

migrate().catch(console.error);
