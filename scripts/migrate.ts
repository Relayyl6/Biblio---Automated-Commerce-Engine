import { logger } from "@ace/shared/logger.js";
import { sql } from "@ace/shared/clients";

async function main() {
  logger.log("Running migration...");
  await sql`
    ALTER TABLE merchants
    ADD COLUMN IF NOT EXISTS bank_account_number text,
    ADD COLUMN IF NOT EXISTS bank_code text,
    ADD COLUMN IF NOT EXISTS paystack_recipient_code text;
  `;
  logger.log("Migration complete.");
  process.exit(0);
}
main().catch(logger.error);
