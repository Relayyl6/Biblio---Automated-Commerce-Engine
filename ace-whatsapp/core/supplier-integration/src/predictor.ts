import { sql } from '@ace/shared/clients.js';
import { InventoryItem } from './types.js';
import P from 'pino';

const logger = P({ level: process.env.LOG_LEVEL || 'info' });

export class StockoutPredictor {
  /**
   * Scans inventory for a specific merchant or globally to find items below their reorder threshold.
   * Triggered by cron or after order completion.
   */
  async getLowStockItems(merchantId?: string): Promise<InventoryItem[]> {
    try {
      const items = await sql<any[]>`
        SELECT id, COALESCE(merchant_id, tenant_id) as merchant_id, sku, name, 
               COALESCE(quantity, stock, 0) as stock_quantity, 
               COALESCE(low_stock_threshold, 5) as reorder_threshold, 
               COALESCE(low_stock_threshold, 5) * 5 as reorder_batch_size, 
               supplier_id
        FROM products
        WHERE COALESCE(quantity, stock, 0) <= COALESCE(low_stock_threshold, 5)
        ${merchantId ? sql`AND (merchant_id = ${merchantId}::uuid OR tenant_id = ${merchantId}::uuid)` : sql``}
      `;

      return items.map(row => ({
        id: row.id,
        merchantId: row.merchant_id,
        sku: row.sku,
        name: row.name,
        stockQuantity: Number(row.stock_quantity || 0),
        reorderThreshold: Number(row.reorder_threshold || 5),
        reorderBatchSize: Number(row.reorder_batch_size || 25),
        supplierId: row.supplier_id
      }));
    } catch (err) {
      logger.error({ err, merchantId }, 'Failed to fetch low stock items');
      return [];
    }
  }

  /**
   * Called specifically when an order is paid to check if the purchased items trigger a reorder.
   */
  async checkAfterOrder(orderItems: Array<{ productId: string; quantity: number }>): Promise<InventoryItem[]> {
    const lowStock: InventoryItem[] = [];
    
    for (const item of orderItems) {
      try {
        const rows = await sql<any[]>`
          SELECT id, COALESCE(merchant_id, tenant_id) as merchant_id, sku, name, 
                 COALESCE(quantity, stock, 0) as stock_quantity, 
                 COALESCE(low_stock_threshold, 5) as reorder_threshold, 
                 COALESCE(low_stock_threshold, 5) * 5 as reorder_batch_size, 
                 supplier_id
          FROM products
          WHERE id = ${item.productId}::uuid
        `;
        
        if (rows.length > 0) {
          const row = rows[0];
          const currentStock = Number(row.stock_quantity || 0);
          const threshold = Number(row.reorder_threshold || 5);
          if (currentStock <= threshold) {
            lowStock.push({
              id: row.id,
              merchantId: row.merchant_id,
              sku: row.sku,
              name: row.name,
              stockQuantity: currentStock,
              reorderThreshold: threshold,
              reorderBatchSize: Number(row.reorder_batch_size || 25),
              supplierId: row.supplier_id
            });
          }
        }
      } catch (err) {
        logger.error({ err, productId: item.productId }, 'Failed to check stock threshold for item');
      }
    }
    
    return lowStock;
  }
}
