export const adminTools = [
  {
    type: "function" as const,
    function: {
      name: "view_pending_drafts",
      description: "Fetch all pending drafts (restock POs, win-back discounts, or tone updates) that require the merchant's approval.",
      parameters: {
        type: "object",
        properties: {
          draftType: {
            type: "string",
            enum: ["restock", "winback", "tone", "all"],
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
      description: "Approve a pending draft, allowing the system to send it to the supplier or customer, or apply the tone update.",
      parameters: {
        type: "object",
        properties: {
          draftId: {
            type: "string",
            description: "The exact ID of the draft to approve (e.g. rst_12345 or win_67890)."
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

import { sql } from '@ace/shared/clients.js';
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
      const restocks = await sql<any[]>`SELECT id, proposed_quantity, message_draft FROM restock_drafts WHERE merchant_id = ${merchantId} AND status = 'pending_approval'`;
      if (restocks.length) {
        result += 'Pending Restock Drafts:\n' + restocks.map(r => `- [ID: ${r.id}] ${r.proposed_quantity} units. Msg: "${r.message_draft}"`).join('\n') + '\n\n';
      }
    }
    
    if (draftType === 'winback' || draftType === 'all') {
      const winbacks = await sql<any[]>`SELECT id, proposed_discount_percent, message_draft FROM winback_drafts WHERE merchant_id = ${merchantId} AND status = 'pending_approval'`;
      if (winbacks.length) {
        result += 'Pending Win-back Drafts:\n' + winbacks.map(w => `- [ID: ${w.id}] ${w.proposed_discount_percent}% off. Msg: "${w.message_draft}"`).join('\n') + '\n\n';
      }
    }
    
    if (draftType === 'tone' || draftType === 'all') {
      const tones = await sql<any[]>`SELECT id, style_metrics FROM tone_guides WHERE merchant_id = ${merchantId} AND status = 'pending_approval'`;
      if (tones.length) {
        result += 'Pending Tone Guide Updates:\n' + tones.map(t => `- [ID: ${t.id}] Metrics: ${JSON.stringify(t.style_metrics)}`).join('\n') + '\n\n';
      }
    }
    
    return result || 'No pending drafts found.';
  },
  
  approve_draft: async (merchantId: string, args: any) => {
    const { draftId } = args;
    if (draftId.startsWith('rst_')) {
      const ok = await supplierGate.approveAndSend(draftId, merchantId);
      return ok ? `Restock draft ${draftId} approved and sent to supplier.` : `Failed to approve restock draft ${draftId}.`;
    } else if (draftId.startsWith('win_')) {
      const ok = await retentionGate.approveAndSend(draftId, merchantId);
      return ok ? `Win-back draft ${draftId} approved and queued for sending.` : `Failed to approve win-back draft ${draftId}.`;
    } else if (draftId.startsWith('tone_')) {
      await sql`UPDATE tone_guides SET status = 'active' WHERE id = ${draftId} AND merchant_id = ${merchantId}`;
      return `Tone guide ${draftId} approved and is now active.`;
    }
    return `Unknown draft ID format: ${draftId}`;
  },
  
  reject_draft: async (merchantId: string, args: any) => {
    const { draftId } = args;
    if (draftId.startsWith('rst_')) {
      await supplierGate.reject(draftId, merchantId);
    } else if (draftId.startsWith('win_')) {
      await retentionGate.reject(draftId, merchantId);
    } else if (draftId.startsWith('tone_')) {
      await sql`UPDATE tone_guides SET status = 'rejected' WHERE id = ${draftId} AND merchant_id = ${merchantId}`;
    } else {
      return `Unknown draft ID format: ${draftId}`;
    }
    return `Draft ${draftId} rejected successfully.`;
  }
};
