import { sql } from "@ace/shared/clients";
import fs from "fs";

async function main() {
  const sqlContent = fs.readFileSync("infra/migrations/007_visual_search.sql", "utf-8");
  await sql.unsafe(sqlContent);
  console.log("Migration 007 successful");
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
