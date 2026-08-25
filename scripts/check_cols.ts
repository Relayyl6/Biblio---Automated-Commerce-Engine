import { logger } from "@ace/shared/logger.js";
import { sql } from "@ace/shared/clients";
const cols = await sql<{column_name:string}[]>`select column_name from information_schema.columns where table_name = 'merchants' order by ordinal_position`;
logger.log(cols.map(c => c.column_name).join(", "));
process.exit(0);
