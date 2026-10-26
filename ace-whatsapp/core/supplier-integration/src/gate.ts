import { sql } from '@ace/shared/clients.js';
import { Queue } from 'bullmq';
import { redis } from '@ace/shared/clients.js';
import P from 'pino';

const logger = P({ level: process.env.LOG_LEVEL || 'info' });

export const outboundQueue = new Queue('outbound_messages', {
  connection: { ...redis.options, maxRetriesPerRequest: null }
});

export class ApprovalGate {
  
  /**
   * Approves a restock draft and dispatches the message to the supplier.
   */
  async approveAndSend(draftId: string, merchantId: string): Promise<boolean> {
    try {
      const drafts = await sql<any[]>`
        SELECT d.id, d.message_draft, d.status, s.phone, s.email, s.metadata
        FROM restock_drafts d
        JOIN suppliers s ON d.supplier_id = s.id
        WHERE d.id = ${draftId} AND d.merchant_id = ${merchantId}::uuid
      `;

      if (drafts.length === 0) {
        logger.error({ draftId, merchantId }, 'Draft not found or unauthorized');
        return false;
      }

      const draft = drafts[0];

      if (draft.status !== 'pending_approval' && draft.status !== 'pending' && draft.status !== 'draft') {
        logger.warn({ draftId, status: draft.status }, 'Draft is not pending approval');
        return false;
      }

      // Mark as approved and sent
      await sql`
        UPDATE restock_drafts 
        SET status = 'sent', updated_at = NOW() 
        WHERE id = ${draftId}
      `;

      // Dispatch via preferred channel (WhatsApp phone or email)
      const supplierPhone = draft.phone || draft.metadata?.contact_phone;
      const supplierEmail = draft.email || draft.metadata?.contact_email;

      if (supplierPhone) {
        await outboundQueue.add('send_system_message', {
          merchantId,
          customerId: supplierPhone,
          text: draft.message_draft,
          source: 'system'
        });
        logger.info({ draftId, channel: 'whatsapp', supplierPhone }, 'Restock message dispatched to outbound queue');
      } else if (supplierEmail) {
        await outboundQueue.add('send_email', {
          to: supplierEmail,
          subject: 'Restock Request from Biblio',
          body: draft.message_draft,
          merchantId,
          draftId
        });
        logger.info({ draftId, email: supplierEmail }, 'Restock email queued for dispatch');
      } else {
        logger.error({ draftId }, 'Supplier has no valid contact info');
        return false;
      }

      return true;
    } catch (err) {
      logger.error({ err, draftId }, 'Failed to approve and send restock draft');
      return false;
    }
  }

  /**
   * Rejects a restock draft.
   */
  async reject(draftId: string, merchantId: string): Promise<boolean> {
    try {
      const result = await sql`
        UPDATE restock_drafts 
        SET status = 'rejected', updated_at = NOW() 
        WHERE id = ${draftId} AND merchant_id = ${merchantId}::uuid
        RETURNING id
      `;
      
      if (result.length > 0) {
        logger.info({ draftId }, 'Restock draft rejected safely');
        return true;
      }
      return false;
    } catch (err) {
      logger.error({ err, draftId }, 'Failed to reject draft');
      return false;
    }
  }
}
