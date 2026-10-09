import postgres from "postgres";
import fs from "fs";

const sql = postgres(process.env.DATABASE_URL!, { ssl: "require" });

async function main() {
  const schema = fs.readFileSync("infra/schema.sql", "utf8");
  // Replace "create table" with "create table if not exists" everywhere to avoid duplicate errors
  const safeSchema = schema.replace(/create table (?!if not exists)/gi, "create table if not exists ");
  
  await sql.unsafe(safeSchema);
  console.log("Schema applied with IF NOT EXISTS.");
  await sql.end();
}

main().catch(console.error);
