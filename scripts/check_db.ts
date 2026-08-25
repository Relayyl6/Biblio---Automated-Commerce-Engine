import { logger } from "@ace/shared/logger.js";
import { sql } from "@ace/shared/clients";
async function main() {
  const rows = await sql`select id, state from orders order by created_at desc limit 3`;
  logger.log(JSON.stringify(rows, null, 2));
  process.exit(0);
}
main().catch(logger.error);
