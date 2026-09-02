import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL!, { ssl: "require" });

async function main() {
  const tables = await sql`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name
  `;
  console.log("Tables:", tables.map((t: any) => t.table_name).join(", "));
  try {
    const m = await sql`SELECT id, contact_phone FROM merchants LIMIT 3`;
    console.log("Merchants:", JSON.stringify(m));
  } catch(e: any) { console.error("merchants error:", e.message); }
  await sql.end();
}
main().catch(e => { console.error(e); process.exit(1); });
