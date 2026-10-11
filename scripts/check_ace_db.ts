import postgres from "postgres";
// Check the ace-whatsapp env file
import { readFileSync } from "fs";
const envContent = readFileSync("ace-whatsapp/.env", "utf8").catch ? "" : readFileSync("ace-whatsapp/.env", "utf8");
const match = envContent.match(/DATABASE_URL=["']?([^"'\n]+)/);
const acDbUrl = match?.[1] ?? process.env.DATABASE_URL!;
console.log("ace-whatsapp DB URL:", acDbUrl.substring(0, 60) + "...");

const sql = postgres(acDbUrl, { ssl: "require" });
const tables = await sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name LIMIT 20`;
console.log("Tables:", tables.map((t: any) => t.table_name).join(", "));
await sql.end();
