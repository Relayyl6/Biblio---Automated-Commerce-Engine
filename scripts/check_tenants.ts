import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL!, { ssl: "require" });

async function main() {
  const cols = await sql`
    SELECT column_name FROM information_schema.columns 
    WHERE table_name = 'tenants' AND table_schema = 'public'
  `;
  console.log("tenants columns:", cols.map((c: any) => c.column_name).join(", "));
  
  const rows = await sql`SELECT id, name, phone FROM tenants LIMIT 3` .catch(async () => 
    await sql`SELECT id FROM tenants LIMIT 3`
  );
  console.log("tenants rows:", JSON.stringify(rows));
  await sql.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
