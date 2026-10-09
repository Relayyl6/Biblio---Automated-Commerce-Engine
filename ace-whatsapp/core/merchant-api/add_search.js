const fs = require('fs');
let content = fs.readFileSync('src/index.ts', 'utf8');

const searchEndpoint = 
  app.get('/merchants/:id/search', async (req, reply) => {
    const { id } = req.params as { id: string };
    const { q } = req.query as { q: string };
    
    if (!q || q.length < 2) return reply.send([]);
    
    const term = \%\%\;
    
    const results = await sql\
      SELECT id, name as title, phone as subtitle, 'customer' as type 
      FROM customers 
      WHERE merchant_id = \ AND (name ILIKE \ OR phone ILIKE \)
      
      UNION ALL
      
      SELECT id, name as title, 'Stock: ' || current_stock as subtitle, 'product' as type 
      FROM products 
      WHERE merchant_id = \ AND name ILIKE \
      
      UNION ALL
      
      SELECT id, 'Order ' || left(id::text, 8) as title, status as subtitle, 'order' as type 
      FROM orders 
      WHERE merchant_id = \ AND id::text ILIKE \
      
      LIMIT 15
    \;
    
    return reply.send(results);
  });
;

if (!content.includes('/merchants/:id/search')) {
  content = content.replace(/app\.listen\(/, searchEndpoint + '\n  app.listen(');
  fs.writeFileSync('src/index.ts', content);
}
