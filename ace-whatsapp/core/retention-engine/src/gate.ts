import { sql } from '@ace/shared/clients.js';
import { Queue } from 'bullmq';
import { redis } from '@ace/shared/clients.js';
import { logger } from '@ace/shared/logger.js';

export const outboundQueue = new Queue('outbound_messages', {
  connection: { ...redis.options, maxRetriesPerRequest: null }
});

export class RetentionApprovalGate {
  async approveAndSend(draftId: string, merchantId: string): Promise<boolean> {
    try {
      const drafts = await sql<any[]>`
        SELECT d.id, d.customer_id, d.message_draft, d.status
        FROM winback_drafts d
        WHERE d.id = ${draftId} AND d.merchant_id = ${merchantId}::uuid
      `;

      if (drafts.length === 0) {
        logger.error('Winback draft not found or unauthorized', { draftId, merchantId });
        return false;
      }

      const draft = drafts[0];

      if (draft.status !== 'pending_approval' && draft.status !== 'pending' && draft.status !== 'draft') {
        logger.warn('Draft is not pending approval', { draftId, status: draft.status });
        return false;
      }

      await sql`
        UPDATE winback_drafts 
        SET status = 'sent', updated_at = NOW() 
        WHERE id = ${draftId}
      `;

      const targetPhone = draft.customer_id;
      if (targetPhone) {
        await outboundQueue.add('send_system_message', {
          merchantId,
          customerId: targetPhone,
          text: draft.message_draft,
          source: 'system'
        });
        logger.log('Winback message dispatched to outbound queue', { draftId, targetPhone });
      }

      return true;
    } catch (err) {
      logger.error('Failed to approve and send winback draft', { err, draftId });
      return false;
    }
  }

  async reject(draftId: string, merchantId: string): Promise<boolean> {
    try {
      const result = await sql`
        UPDATE winback_drafts 
        SET status = 'rejected', updated_at = NOW() 
        WHERE id = ${draftId} AND merchant_id = ${merchantId}::uuid
        RETURNING id
      `;
      return result.length > 0;
    } catch (err) {
      logger.error('Failed to reject draft', { err, draftId });
      return false;
    }
  }
}
