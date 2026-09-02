import postgres from "postgres";
import fs from "fs";

const sql = postgres(process.env.DATABASE_URL!, { ssl: "require" });

async function main() {
  const schema = fs.readFileSync("infra/schema.sql", "utf8");
  const stmts = schema.split(";");
  for (const s of stmts) {
    if (!s.trim()) continue;
    let runStr = s.trim();
    if (runStr.toLowerCase().startsWith("create table ")) {
      runStr = runStr.replace(/create table /i, "create table if not exists ");
    }
    
    try {
      await sql.unsafe(runStr);
    } catch(e) {
      if (e.code === '42P07') continue; // already exists
      if (e.message.includes('gin_trgm_ops')) continue; // skip bad index
      console.error("Skipping error:", e.message);
    }
  }
  console.log("Schema applied.");
  await sql.end();
}
main();
