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
  const [tx, pi, ord] = await Promise.all([
    sql`SELECT DISTINCT status FROM transactions`,
    sql`SELECT DISTINCT status FROM payment_intents`,
    sql`SELECT DISTINCT status FROM orders`
  ]);
  console.log('transactions statuses:', tx.map(t => t.status).join(', '));
  console.log('payment_intents statuses:', pi.map(p => p.status).join(', '));
  console.log('orders statuses:', ord.map(o => o.status).join(', '));
  await sql.end();
}

main().catch(console.error);
