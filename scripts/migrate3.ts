import { logger } from "@ace/shared/logger.js";
import { sql } from "@ace/shared/clients";
async function main() {
  logger.log("Adding contact_phone to merchants...");
  await sql`ALTER TABLE merchants ADD COLUMN IF NOT EXISTS contact_phone text`;
  logger.log("Done.");
  process.exit(0);
}
main().catch(e => { logger.error(e); process.exit(1); });
