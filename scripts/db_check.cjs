const postgres = require('../node_modules/postgres');
require('dotenv').config();
const sql = postgres(process.env.DATABASE_URL, { ssl: 'require', max: 2 });

async function main() {
  // List all tables
  const tables = await sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`;
  console.log('TABLES:', tables.map(x => x.table_name).join(', '));

  // Check supplier_ledger columns
  try {
    const cols = await sql`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'supplier_ledger' ORDER BY ordinal_position`;
    console.log('supplier_ledger cols:', cols.map(c => c.column_name + ':' + c.data_type).join(', '));
  } catch(e) { console.log('supplier_ledger error:', e.message); }

  // Check suppliers columns
  try {
    const cols = await sql`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'suppliers' ORDER BY ordinal_position`;
    console.log('suppliers cols:', cols.map(c => c.column_name + ':' + c.data_type).join(', '));
  } catch(e) { console.log('suppliers error:', e.message); }

  // Check if app_config table exists
  try {
    const r = await sql`SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'app_config') as exists`;
    console.log('app_config exists:', r[0].exists);
  } catch(e) { console.log('app_config check error:', e.message); }
}
main().catch(console.error);
