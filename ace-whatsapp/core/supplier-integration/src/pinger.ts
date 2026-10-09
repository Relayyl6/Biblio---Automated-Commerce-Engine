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
        SELECT id, merchant_id, name, contact_phone, contact_email, preferred_channel
        FROM suppliers
        WHERE id = ${item.supplierId}
      `;

      if (supplierRows.length === 0) {
        logger.error({ supplierId: item.supplierId }, 'Supplier not found in database');
        return null;
      }

      const supplier: Supplier = {
        id: supplierRows[0].id,
        merchantId: supplierRows[0].merchant_id,
        name: supplierRows[0].name,
        contactPhone: supplierRows[0].contact_phone,
        contactEmail: supplierRows[0].contact_email,
        preferredChannel: supplierRows[0].preferred_channel || 'whatsapp'
      };

      const proposedQuantity = item.reorderBatchSize > 0 ? item.reorderBatchSize : 50;
      
      const messageDraft = `Hello ${supplier.name},\n\nWe need to place a restock order for:\n\nItem: ${item.name} (SKU: ${item.sku})\nQuantity: ${proposedQuantity} units\n\nPlease confirm availability and invoice us. Thank you.`;

      const draftId = `rst_${Date.now()}`;

      await sql`
        INSERT INTO restock_drafts (id, merchant_id, supplier_id, inventory_item_id, proposed_quantity, message_draft, status, created_at)
        VALUES (${draftId}, ${item.merchantId}, ${supplier.id}, ${item.id}, ${proposedQuantity}, ${messageDraft}, 'pending_approval', NOW())
      `;

      logger.info({ draftId, supplierId: supplier.id }, 'Generated restock draft');

      return {
        id: draftId,
        merchantId: item.merchantId,
        supplierId: supplier.id,
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
