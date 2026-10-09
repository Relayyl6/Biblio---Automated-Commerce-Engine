import { sql } from './shared/src/clients.ts';

async function run() {
  const tables = await sql`
    SELECT table_name, column_name, data_type 
    FROM information_schema.columns 
    WHERE table_schema = 'public'
    ORDER BY table_name, ordinal_position
  `;
  
  let currentTable = '';
  for (const row of tables) {
    if (row.table_name !== currentTable) {
      console.log(`\nTable: ${row.table_name}`);
      currentTable = row.table_name;
    }
    console.log(`  - ${row.column_name} (${row.data_type})`);
  }
  process.exit(0);
}
run();
