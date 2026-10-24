const fs = require('fs');
const postgres = require('postgres');

const env = fs.readFileSync('.env', 'utf8');
const match = env.match(/DATABASE_URL=(.+)/);
let url = match[1].trim();
if ((url.startsWith('"') && url.endsWith('"')) || (url.startsWith("'") && url.endsWith("'"))) {
  url = url.slice(1, -1);
}

const sql = postgres(url, { ssl: 'require' });

async function main() {
  const tables = ['merchant_agent_transcripts', 'token_ledgers', 'conversation_messages'];
  for (const t of tables) {
    const cols = await sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = ${t}
      ORDER BY ordinal_position;
    `;
    console.log(`\nTable ${t}:`, cols.map(c => `${c.column_name} (${c.data_type})`).join(', '));
  }
  await sql.end();
}

main().catch(console.error);
