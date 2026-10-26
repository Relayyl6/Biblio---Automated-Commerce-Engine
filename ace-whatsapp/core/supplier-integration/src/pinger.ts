import { sql } from '@ace/shared/clients.js';
import { InventoryItem, Supplier, RestockDraft } from './types.js';
import P from 'pino';

const logger = P({ level: process.env.LOG_LEVEL || 'info' });

export class SupplierPinger {
  
  /**
   * Generates a Restock Draft for a low stock item, ready for merchant approval.
   */
  async createRestockDraft(item: InventoryItem): Promise<RestockDraft | null> {
    if (!item.supplierId) {
      logger.warn({ itemId: item.id }, 'Cannot ping supplier: No supplier assigned to this item');
      return null;
    }

    try {
      const supplierRows = await sql<any[]>`
        SELECT id, tenant_id, display_name, legal_name, phone, email, metadata
        FROM suppliers
        WHERE id = ${item.supplierId}::uuid
      `;

      if (supplierRows.length === 0) {
        logger.error({ supplierId: item.supplierId }, 'Supplier not found in database');
        return null;
      }

      const sRow = supplierRows[0];
      const supplierName = sRow.display_name || sRow.legal_name || 'Supplier';
      const supplierPhone = sRow.phone || sRow.metadata?.contact_phone;
      const supplierEmail = sRow.email || sRow.metadata?.contact_email;

      const proposedQuantity = item.reorderBatchSize > 0 ? item.reorderBatchSize : 50;
      
      const messageDraft = `Hello ${supplierName},\n\nWe need to place a restock order for:\n\nItem: ${item.name} (SKU: ${item.sku})\nQuantity: ${proposedQuantity} units\n\nPlease confirm availability and invoice us. Thank you.`;

      const draftId = `rst_${Date.now()}`;

      await sql`
        INSERT INTO restock_drafts (id, merchant_id, supplier_id, inventory_item_id, proposed_quantity, message_draft, status, created_at)
        VALUES (${draftId}, ${item.merchantId}::uuid, ${sRow.id}::uuid, ${item.id}::uuid, ${proposedQuantity}, ${messageDraft}, 'pending_approval', NOW())
      `;

      logger.info({ draftId, supplierId: sRow.id }, 'Generated restock draft');

      return {
        id: draftId,
        merchantId: item.merchantId,
        supplierId: sRow.id,
        inventoryItemId: item.id,
        proposedQuantity,
        messageDraft,
        status: 'pending_approval',
        createdAt: new Date().toISOString()
      };
    } catch (err) {
      logger.error({ err, itemId: item.id }, 'Failed to create restock draft');
      return null;
    }
  }
}
