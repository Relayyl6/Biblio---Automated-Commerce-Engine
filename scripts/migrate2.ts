import { logger } from "@ace/shared/logger.js";
import { sql } from "@ace/shared/clients";

async function main() {
  logger.log("Running Vendor Decisions migration...");
  await sql`
    CREATE TABLE IF NOT EXISTS vendor_decisions (
      id uuid primary key default gen_random_uuid(),
      merchant_id uuid not null references merchants(id),
      decision_type text not null,
      channel text not null,
      choice text not null,
      created_at timestamptz not null default now()
    );
  `;
  logger.log("Migration complete.");
  process.exit(0);
}
main().catch(logger.error);
