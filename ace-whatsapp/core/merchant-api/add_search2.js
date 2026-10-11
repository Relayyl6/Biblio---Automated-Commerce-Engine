const fs = require('fs');
let content = fs.readFileSync('src/index.ts', 'utf8');

const searchEndpoint = "app.get('/merchants/:id/search', async (req, reply) => {\n" +
  "  const { id } = req.params;\n" +
  "  const { q } = req.query;\n" +
  "  if (!q || q.length < 2) return reply.send([]);\n" +
  "  const term = '%' + q + '%';\n" +
  "  const results = await sql\n" +
  "    SELECT id, name as title, phone as subtitle, 'customer' as type FROM customers WHERE merchant_id =  AND (name ILIKE  OR phone ILIKE )\n" +
  "    UNION ALL\n" +
  "    SELECT id, name as title, 'Stock: ' || current_stock as subtitle, 'product' as type FROM products WHERE merchant_id =  AND name ILIKE \n" +
  "    UNION ALL\n" +
  "    SELECT id, 'Order ' || left(id::text, 8) as title, status as subtitle, 'order' as type FROM orders WHERE merchant_id =  AND id::text ILIKE \n" +
  "    LIMIT 15\n" +
  "  ;\n" +
  "  return reply.send(results);\n" +
  "});\n";

if (!content.includes('/merchants/:id/search')) {
  content = content.replace('const port = Number(process.env.MERCHANT_API_PORT', searchEndpoint + '\nconst port = Number(process.env.MERCHANT_API_PORT');
  fs.writeFileSync('src/index.ts', content);
}
