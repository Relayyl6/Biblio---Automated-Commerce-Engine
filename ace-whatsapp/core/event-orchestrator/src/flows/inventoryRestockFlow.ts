import { procurementService } from '../../../supplier-integration/src/procurementService.js';
import { sql } from '@ace/shared/clients.js';

export async function handleLowStockEvent(merchantId: string, sku: string, quantityRemaining: number, category: string) {
  console.log(`[Event Orchestrator] Low stock detected for ${sku} (${quantityRemaining} remaining).`);
  
  // Fetch real velocity from DB instead of mocking
  const velocityData = await sql`
    SELECT COALESCE(SUM(quantity), 0) as recent_sales
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    WHERE oi.sku = ${sku} 
      AND o.merchant_id = ${merchantId}
      AND o.created_at >= NOW() - INTERVAL '30 days'
  `;
  
  const recentSales = Number(velocityData[0]?.recent_sales || 0);
  const quantityNeeded = Math.max(recentSales, 10); // Restock 30-day velocity, minimum 10

  console.log(`[Event Orchestrator] Triggering Auto-Restock of ${quantityNeeded} units via Procurement Nodes...`);
  
  await procurementService.broadcastRestockRequest(merchantId, {
    sku,
    quantityNeeded,
    urgency: quantityRemaining === 0 ? 'high' : 'low'
  }, category);
}

export async function handleOrderPaidForRestock(data: {
  merchantId: string;
  items?: Array<{ sku: string; quantity: number; category?: string }>;
}) {
  if (!data?.items || !Array.isArray(data.items)) return;
  for (const item of data.items) {
    const stockRows = await sql<{ quantity: number }[]>`
      SELECT quantity FROM products WHERE sku = ${item.sku} AND merchant_id = ${data.merchantId}::uuid LIMIT 1
    `.catch(() => []);
    const remaining = stockRows[0]?.quantity ?? 0;
    if (remaining <= 5) {
      await handleLowStockEvent(data.merchantId, item.sku, remaining, item.category || 'general');
    }
  }
}
