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
  const m = await sql`SELECT id FROM merchants LIMIT 1`;
  if (!m.length) {
    console.log('No merchants found');
    await sql.end();
    return;
  }
  const id = m[0].id;
  const q = 'a';
  const term = '%' + q + '%';

  const results = await sql`
    SELECT customer_id as id, customer_id as title, 'Customer Link' as subtitle, 'customer' as type 
    FROM customer_merchant_links 
    WHERE merchant_id = ${id}::uuid AND customer_id ILIKE ${term}
    UNION ALL
    SELECT id::text as id, name as title, 'Stock: ' || COALESCE(quantity, stock, 0) as subtitle, 'product' as type 
    FROM products 
    WHERE merchant_id = ${id}::uuid AND deleted_at IS NULL AND (name ILIKE ${term} OR category ILIKE ${term} OR sku ILIKE ${term})
    UNION ALL
    SELECT id::text as id, 'Order #' || left(id::text, 8) as title, status::text as subtitle, 'order' as type 
    FROM orders 
    WHERE tenant_id = ${id}::uuid AND (id::text ILIKE ${term} OR status::text ILIKE ${term})
    LIMIT 15
  `;
  console.log('Search test passed! Returned items:', results.length);
  await sql.end();
}

main().catch(err => {
  console.error('Search error:', err);
  process.exit(1);
});
