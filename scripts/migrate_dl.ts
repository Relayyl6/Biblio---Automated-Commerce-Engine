import { logger } from "@ace/shared/logger.js";
import { sql } from "@ace/shared/clients";
async function main() {
  await sql`CREATE TABLE IF NOT EXISTS outbound_dead_letters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID NOT NULL,
    phone_number_id TEXT NOT NULL,
    payload JSONB NOT NULL,
    error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  logger.log("Done.");
  process.exit(0);
}
main().catch(e => { logger.error(e); process.exit(1); });
