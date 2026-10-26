import { sql } from '@ace/shared/clients.js';
import { SupplierPinger } from '../../../supplier-integration/src/pinger.js';

export async function handleLowStockEvent(merchantId: string, sku: string, quantityRemaining: number, category: string) {
  console.log(`[Event Orchestrator] Low stock detected for ${sku} (${quantityRemaining} remaining).`);
  
  // Fetch real velocity from DB orders
  const velocityData = await sql`
    SELECT COALESCE(SUM((item->>'quantity')::int), 0) as recent_sales
    FROM orders o, jsonb_array_elements(CASE WHEN jsonb_typeof(o.items) = 'array' THEN o.items ELSE '[]'::jsonb END) as item
    WHERE item->>'sku' = ${sku}
      AND (o.tenant_id = ${merchantId}::uuid OR o.supplier_id = ${merchantId}::uuid)
      AND o.created_at >= NOW() - INTERVAL '30 days'
  `.catch(() => [{ recent_sales: 0 }]);
  
  const recentSales = Number(velocityData[0]?.recent_sales || 0);
  const quantityNeeded = Math.max(recentSales, 10); // Restock 30-day velocity, minimum 10

  console.log(`[Event Orchestrator] Drafting Auto-Restock of ${quantityNeeded} units for merchant ${merchantId}...`);
  
  const productRows = await sql`
    SELECT id, sku, name, supplier_id, COALESCE(quantity, stock, 0) as stock_quantity, low_stock_threshold
    FROM products
    WHERE sku = ${sku} AND (merchant_id = ${merchantId}::uuid OR tenant_id = ${merchantId}::uuid)
    LIMIT 1
  `.catch(() => []);

  if (productRows.length > 0) {
    const p = productRows[0];
    const pinger = new SupplierPinger();
    await pinger.draftRestockOrder({
      id: p.id,
      merchantId,
      sku: p.sku,
      name: p.name,
      stockQuantity: Number(p.stock_quantity || 0),
      reorderThreshold: Number(p.low_stock_threshold || 5),
      reorderBatchSize: quantityNeeded,
      supplierId: p.supplier_id
    });
  }
}

export async function handleOrderPaidForRestock(data: {
  merchantId: string;
  items?: Array<{ sku: string; quantity: number; category?: string }>;
}) {
  if (!data?.items || !Array.isArray(data.items)) return;
  for (const item of data.items) {
    const stockRows = await sql<{ quantity: number }[]>`
      SELECT COALESCE(quantity, stock, 0) as quantity 
      FROM products 
      WHERE sku = ${item.sku} AND (merchant_id = ${data.merchantId}::uuid OR tenant_id = ${data.merchantId}::uuid) 
      LIMIT 1
    `.catch(() => []);
    const remaining = stockRows[0]?.quantity ?? 0;
    if (remaining <= 5) {
      await handleLowStockEvent(data.merchantId, item.sku, remaining, item.category || 'general');
    }
  }
}
