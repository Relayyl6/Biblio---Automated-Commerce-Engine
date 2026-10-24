const fs = require('fs');
const postgres = require('postgres');

const env = fs.readFileSync('.env', 'utf8');
const match = env.match(/DATABASE_URL=(.+)/);
if (!match) {
  console.error('No DATABASE_URL in .env');
  process.exit(1);
}
let url = match[1].trim();
if ((url.startsWith('"') && url.endsWith('"')) || (url.startsWith("'") && url.endsWith("'"))) {
  url = url.slice(1, -1);
}

const sql = postgres(url, { ssl: 'require' });

async function main() {
  const tables = await sql`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name;
  `;
  console.log('Tables in public schema:');
  console.log(tables.map(t => t.table_name).join(', '));
  await sql.end();
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
