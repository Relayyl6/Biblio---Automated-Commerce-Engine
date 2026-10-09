import { sql } from '@ace/shared/clients.js';
import { ProcurementNode, RestockRequest, ChannelType } from './types';

class ProcurementService {
  async registerNode(merchantId: string, node: Omit<ProcurementNode, 'id' | 'createdAt'>): Promise<ProcurementNode> {
    const result = await sql`
      INSERT INTO procurement_nodes (
        merchant_id,
        name,
        channel_type,
        channel_id,
        categories,
        auto_restock_enabled
      ) VALUES (
        ${merchantId},
        ${node.name},
        ${node.channelType},
        ${node.channelId},
        ${node.categories}::text[],
        ${node.autoRestockEnabled}
      )
      RETURNING id, merchant_id as "merchantId", name, channel_type as "channelType", channel_id as "channelId", categories, auto_restock_enabled as "autoRestockEnabled", created_at as "createdAt"
    `;
    
    console.log(`[Supplier Integration] Registered Procurement Node for merchant ${merchantId}: ${node.name} (${node.channelType})`);
    return result[0] as ProcurementNode;
  }

  async getNodesByCategory(merchantId: string, category: string): Promise<ProcurementNode[]> {
    const nodes = await sql`
      SELECT 
        id, merchant_id as "merchantId", name, channel_type as "channelType", channel_id as "channelId", categories, auto_restock_enabled as "autoRestockEnabled", created_at as "createdAt"
      FROM procurement_nodes
      WHERE merchant_id = ${merchantId}
        AND auto_restock_enabled = true
        AND ${category} = ANY(categories)
    `;
    return nodes as ProcurementNode[];
  }

  async broadcastRestockRequest(merchantId: string, request: RestockRequest, category: string): Promise<void> {
    const targetNodes = await this.getNodesByCategory(merchantId, category);
    
    if (targetNodes.length === 0) {
      console.log(`[Supplier Integration] No active procurement nodes found for category ${category}.`);
      return;
    }

    for (const node of targetNodes) {
      const message = `[Auto-Restock Alert] We urgently need ${request.quantityNeeded} units of ${request.sku}. Please confirm availability.`;
      
      // Push directly to Comms Router Outbox instead of console logging mock logic
      await sql`
        INSERT INTO outbox_events (event_type, payload) 
        VALUES ('omnichannel_outbound', ${JSON.stringify({ 
          merchantId: merchantId, 
          channelType: node.channelType,
          channelId: node.channelId, 
          text: message 
        })}::jsonb)
      `;
      
      console.log(`[Comms Router Handoff] Pushed outbox event to ${node.channelType} (${node.channelId})`);
    }
  }
}

export const procurementService = new ProcurementService();
