export const adminTools = [
  {
    type: "function" as const,
    function: {
      name: "view_pending_drafts",
      description: "Fetch all pending drafts (restock POs, win-back discounts, dispatch orders, or tone updates) that require the merchant's approval.",
      parameters: {
        type: "object",
        properties: {
          draftType: {
            type: "string",
            enum: ["restock", "winback", "dispatch", "tone", "all"],
            description: "The type of drafts to view."
          }
        },
        required: ["draftType"]
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "approve_draft",
      description: "Approve a pending draft, allowing the system to send it to the supplier or customer, dispatch a rider, or apply the tone update.",
      parameters: {
        type: "object",
        properties: {
          draftId: {
            type: "string",
            description: "The exact ID of the draft to approve (e.g. r_123, rst_123, w_456, win_456, d_789)."
          }
        },
        required: ["draftId"]
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "reject_draft",
      description: "Reject a pending draft.",
      parameters: {
        type: "object",
        properties: {
          draftId: {
            type: "string",
            description: "The exact ID of the draft to reject."
          }
        },
        required: ["draftId"]
      }
    }
  }
];

import { sql, redis } from '@ace/shared/clients.js';
import { logger } from '@ace/shared/logger.js';
import { ApprovalGate as SupplierGate } from '../../../supplier-integration/src/gate.js';
import { RetentionApprovalGate } from '../../../retention-engine/src/gate.js';

const supplierGate = new SupplierGate();
const retentionGate = new RetentionApprovalGate();

export const adminHandlers = {
  view_pending_drafts: async (merchantId: string, args: any) => {
    let result = '';
    const { draftType } = args;
    
    if (draftType === 'restock' || draftType === 'all') {
      const restocks = await sql<any[]>`
        SELECT id, proposed_quantity, message_draft 
        FROM restock_drafts 
        WHERE merchant_id = ${merchantId}::uuid AND status IN ('pending_approval', 'pending', 'draft')
        ORDER BY created_at DESC LIMIT 10
      `.catch(() => []);
      if (restocks.length) {
        result += 'Pending Restock Drafts:\n' + restocks.map(r => `- [ID: r_${r.id}] ${r.proposed_quantity} units. Msg: "${r.message_draft}"`).join('\n') + '\n\n';
      }
    }
    
    if (draftType === 'winback' || draftType === 'all') {
      const winbacks = await sql<any[]>`
        SELECT id, proposed_discount_percent, message_draft 
        FROM winback_drafts 
        WHERE merchant_id = ${merchantId}::uuid AND status IN ('pending_approval', 'pending', 'draft')
        ORDER BY created_at DESC LIMIT 10
      `.catch(() => []);
      if (winbacks.length) {
        result += 'Pending Win-back Drafts:\n' + winbacks.map(w => `- [ID: w_${w.id}] ${w.proposed_discount_percent}% off. Msg: "${w.message_draft}"`).join('\n') + '\n\n';
      }
    }

    if (draftType === 'dispatch' || draftType === 'all') {
      const dispatches = await sql<any[]>`
        SELECT id, order_id 
        FROM dispatch_drafts 
        WHERE merchant_id = ${merchantId}::uuid AND status IN ('pending_approval', 'pending', 'draft')
        ORDER BY created_at DESC LIMIT 10
      `.catch(() => []);
      if (dispatches.length) {
        result += 'Pending Dispatch Drafts:\n' + dispatches.map(d => `- [ID: d_${d.id}] Order: ${d.order_id}`).join('\n') + '\n\n';
      }
    }
    
    if (draftType === 'tone' || draftType === 'all') {
      const tones = await sql<any[]>`
        SELECT id, style_metrics 
        FROM tone_guides 
        WHERE merchant_id = ${merchantId}::uuid AND status IN ('pending_approval', 'pending', 'draft')
        ORDER BY created_at DESC LIMIT 10
      `.catch(() => []);
      if (tones.length) {
        result += 'Pending Tone Guide Updates:\n' + tones.map(t => `- [ID: ${t.id}] Metrics: ${JSON.stringify(t.style_metrics)}`).join('\n') + '\n\n';
      }
    }
    
    return result || 'No pending drafts found.';
  },
  
  approve_draft: async (merchantId: string, args: any) => {
    const { draftId } = args;
    if (!draftId) return 'Draft ID is required.';

    if (draftId.startsWith('r_') || draftId.startsWith('rst_')) {
      const cleanId = draftId.startsWith('r_') ? draftId.slice(2) : draftId;
      const ok = await supplierGate.approveAndSend(cleanId, merchantId);
      return ok ? `Restock draft ${draftId} approved and sent to supplier.` : `Failed to approve restock draft ${draftId}.`;
    } else if (draftId.startsWith('w_') || draftId.startsWith('win_')) {
      const cleanId = draftId.startsWith('w_') ? draftId.slice(2) : draftId;
      const ok = await retentionGate.approveAndSend(cleanId, merchantId);
      return ok ? `Win-back draft ${draftId} approved and queued for sending.` : `Failed to approve win-back draft ${draftId}.`;
    } else if (draftId.startsWith('d_')) {
      const cleanId = draftId.slice(2);
      await sql`UPDATE dispatch_drafts SET status = 'approved' WHERE id = ${cleanId}::uuid AND merchant_id = ${merchantId}::uuid`;
      const orderRows = await sql`SELECT order_id FROM dispatch_drafts WHERE id = ${cleanId}::uuid`;
      const orderId = orderRows[0]?.order_id;
      if (orderId) {
        const { Queue } = await import('bullmq');
        const queue = new Queue('logistics-dispatch', { connection: { ...redis.options, maxRetriesPerRequest: null } });
        await queue.add('dispatch_rider_requested', { orderId, merchantId, action: 'dispatch_rider_requested' });
      }
      return `Dispatch draft ${draftId} approved. Delivery rider request queued.`;
    } else if (draftId.startsWith('tone_')) {
      await sql`UPDATE tone_guides SET status = 'active' WHERE id = ${draftId} AND merchant_id = ${merchantId}::uuid`;
      return `Tone guide ${draftId} approved and is now active.`;
    }
    return `Unknown draft ID format: ${draftId}`;
  },
  
  reject_draft: async (merchantId: string, args: any) => {
    const { draftId } = args;
    if (!draftId) return 'Draft ID is required.';

    if (draftId.startsWith('r_') || draftId.startsWith('rst_')) {
      const cleanId = draftId.startsWith('r_') ? draftId.slice(2) : draftId;
      await supplierGate.reject(cleanId, merchantId);
    } else if (draftId.startsWith('w_') || draftId.startsWith('win_')) {
      const cleanId = draftId.startsWith('w_') ? draftId.slice(2) : draftId;
      await retentionGate.reject(cleanId, merchantId);
    } else if (draftId.startsWith('d_')) {
      const cleanId = draftId.slice(2);
      await sql`UPDATE dispatch_drafts SET status = 'rejected' WHERE id = ${cleanId}::uuid AND merchant_id = ${merchantId}::uuid`;
    } else if (draftId.startsWith('tone_')) {
      await sql`UPDATE tone_guides SET status = 'rejected' WHERE id = ${draftId} AND merchant_id = ${merchantId}::uuid`;
    } else {
      return `Unknown draft ID format: ${draftId}`;
    }
    return `Draft ${draftId} rejected successfully.`;
  }
};
