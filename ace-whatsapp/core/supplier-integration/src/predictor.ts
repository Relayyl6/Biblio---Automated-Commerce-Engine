import { sql } from '@ace/shared/clients.js';
import { InventoryItem } from './types.js';
import P from 'pino';

const logger = P({ level: process.env.LOG_LEVEL || 'info' });

export class StockoutPredictor {
  /**
   * Scans inventory for a specific merchant or globally to find items below their reorder threshold.
   * In a real system, this could be triggered by an `order_paid` event in BullMQ.
   */
  async getLowStockItems(merchantId?: string): Promise<InventoryItem[]> {
    try {
      const items = await sql<any[]>`
        SELECT id, merchant_id, sku, name, stock_quantity, reorder_threshold, reorder_batch_size, supplier_id
        FROM products
        WHERE stock_quantity <= reorder_threshold
        ${merchantId ? sql`AND merchant_id = ${merchantId}` : sql``}
      `;

      return items.map(row => ({
        id: row.id,
        merchantId: row.merchant_id,
        sku: row.sku,
        name: row.name,
        stockQuantity: row.stock_quantity,
        reorderThreshold: row.reorder_threshold,
        reorderBatchSize: row.reorder_batch_size,
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
          SELECT id, merchant_id, sku, name, stock_quantity, reorder_threshold, reorder_batch_size, supplier_id
          FROM products
          WHERE id = ${item.productId}
        `;
        
        if (rows.length > 0) {
          const row = rows[0];
          // We assume the DB has already decremented the stock via the order transaction,
          // so we just check if it's currently at or below threshold.
          if (row.stock_quantity <= row.reorder_threshold) {
            lowStock.push({
              id: row.id,
              merchantId: row.merchant_id,
              sku: row.sku,
              name: row.name,
              stockQuantity: row.stock_quantity,
              reorderThreshold: row.reorder_threshold,
              reorderBatchSize: row.reorder_batch_size,
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
