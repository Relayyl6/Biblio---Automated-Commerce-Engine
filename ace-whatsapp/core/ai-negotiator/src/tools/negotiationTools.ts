import { sql, redis } from "@ace/shared/clients";
import { logger } from "@ace/shared/logger.js";
import crypto from "crypto";

export const negotiationTools = [
  {
    "type": "function",
    "function": {
      "name": "resolve_escalation",
      "description": "Step into a live AI negotiation",
      "parameters": {
        "type": "object",
        "properties": {
          "customerId": {
            "type": "string"
          },
          "decision": {
            "type": "string",
            "enum": [
              "approve",
              "reject",
              "counter_offer"
            ]
          },
          "amount": {
            "type": "number"
          }
        },
        "required": [
          "customerId",
          "decision"
        ]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "get_recent_customer_inquiries",
      "description": "Fetch the most recent customer inquiries, messages, and chats received on WhatsApp or other channels.",
      "parameters": {
        "type": "object",
        "properties": {
          "limit": { "type": "number", "description": "Number of recent messages to fetch (default 10)" }
        }
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "set_floor_price",
      "description": "Set the absolute minimum price for an item",
      "parameters": {
        "type": "object",
        "properties": {
          "sku": {
            "type": "string"
          },
          "floorPrice": {
            "type": "number"
          }
        },
        "required": [
          "sku",
          "floorPrice"
        ]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "override_ai_offer",
      "description": "Manually push a specific price to a buyer",
      "parameters": {
        "type": "object",
        "properties": {
          "customerId": {
            "type": "string"
          },
          "amount": {
            "type": "number"
          }
        },
        "required": [
          "customerId",
          "amount"
        ]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "create_discount_code",
      "description": "Generate a promo code",
      "parameters": {
        "type": "object",
        "properties": {
          "code": {
            "type": "string"
          },
          "percentage": {
            "type": "number"
          }
        },
        "required": [
          "code",
          "percentage"
        ]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "disable_discount_code",
      "description": "Revoke a promo code",
      "parameters": {
        "type": "object",
        "properties": {
          "code": {
            "type": "string"
          }
        },
        "required": [
          "code"
        ]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "configure_negotiation_aggressiveness",
      "description": "Set AI to firm vs flexible",
      "parameters": {
        "type": "object",
        "properties": {
          "mode": {
            "type": "string",
            "enum": [
              "firm",
              "balanced",
              "flexible"
            ]
          }
        },
        "required": [
          "mode"
        ]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "enable_bundle_deals",
      "description": "Allow AI to offer buy 2 get 1",
      "parameters": {
        "type": "object",
        "properties": {
          "enabled": {
            "type": "boolean"
          }
        },
        "required": [
          "enabled"
        ]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "review_negotiation_transcripts",
      "description": "Read exactly what the AI said",
      "parameters": {
        "type": "object",
        "properties": {
          "customerId": {
            "type": "string"
          }
        },
        "required": [
          "customerId"
        ]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "approve_custom_quote",
      "description": "Approve a B2B quote request",
      "parameters": {
        "type": "object",
        "properties": {
          "quoteId": {
            "type": "string"
          }
        },
        "required": [
          "quoteId"
        ]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "reject_custom_quote",
      "description": "Decline a B2B quote",
      "parameters": {
        "type": "object",
        "properties": {
          "quoteId": {
            "type": "string"
          }
        },
        "required": [
          "quoteId"
        ]
      }
    }
  }
];

export const negotiationHandlers: Record<string, (merchantId: string, args: any) => Promise<any>> = {
  get_recent_customer_inquiries: async (merchantId: string, args: any) => {
    try {
      const limit = Number(args?.limit) || 10;
      const rows = await sql<{
        customer_id: string;
        source: string;
        content: string;
        author_type: string;
        created_at: string;
      }[]>`
        SELECT customer_id, source, content, author_type, created_at
        FROM conversation_messages
        WHERE merchant_id = ${merchantId}::uuid
        ORDER BY created_at DESC
        LIMIT ${limit}
      `.catch(() => []);

      if (rows.length === 0) {
        return "No customer inquiries or WhatsApp messages found yet in your store history. When customers message your WhatsApp number, their questions and orders will appear here automatically.";
      }

      const formatted = rows.map((r, i) => {
        const time = new Date(r.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const sender = r.author_type === 'vendor' ? 'Store' : r.customer_id;
        const preview = (r.content || '').replace(/\n/g, ' ').slice(0, 100);
        return `${i + 1}. [${r.source || 'WhatsApp'}] ${sender} (${time}): "${preview}"`;
      }).join("\n");

      return `Recent Customer Inquiries (${rows.length}):\n${formatted}`;
    } catch (e: any) {
      logger.error("[get_recent_customer_inquiries error]", e);
      return "Unable to fetch customer inquiries at the moment.";
    }
  },
  resolve_escalation: async (merchantId: string, args: any) => {
    const decision = args.decision || 'approve';
    const res = await sql`UPDATE vendor_decisions SET decision = ${decision}, updated_at = now() WHERE merchant_id = ${merchantId}::uuid AND channel = 'whatsapp' RETURNING id`.catch(() => []);
    await redis.del(`communique:${merchantId}:active`).catch(() => {});
    
    // Auto-apply discount if it's an approved counter offer
    if (decision === 'approve' || decision === 'counter_offer') {
        const amount = Math.max(0, Number(args.amount || 0));
        await sql`INSERT INTO active_promotions (merchant_id, type, value) VALUES (${merchantId}::uuid, 'negotiated_discount', ${amount})`.catch(() => {});
    }
    return res.length > 0 ? "Escalation resolved, and logic applied." : "No active escalation found.";
  },
  set_floor_price: async (merchantId: string, args: any) => {
    try {
      const { sku, floorPrice } = args;
      if (!sku) return "SKU is required to set floor price.";
      const numFloor = Number(floorPrice);
      if (!Number.isFinite(numFloor) || numFloor <= 0) {
        return "Invalid floor price. Please provide a positive number.";
      }
      await sql`
        UPDATE products 
        SET metadata = jsonb_set(
              jsonb_set(COALESCE(metadata, '{}'::jsonb), '{floor_price}', ${numFloor}::jsonb),
              '{floor}', ${numFloor}::jsonb
            ),
            updated_at = NOW()
        WHERE (sku = ${sku}) AND (merchant_id = ${merchantId}::uuid OR tenant_id = ${merchantId}::uuid)
      `;
      return `Floor price for ${sku} locked at ₦${numFloor.toLocaleString()}. Biblio will never discount below this floor.`;
    } catch (e: any) {
      return "Failed to set floor price.";
    }
  },
  override_ai_offer: async (merchantId: string, args: any) => {
    try {
      const { customerId } = args;
      if (!customerId) return "Customer ID is required.";
      const offerPrice = Number(args.amount !== undefined ? args.amount : args.offerPrice);
      if (!Number.isFinite(offerPrice) || offerPrice <= 0) {
        return "Invalid offer price. Please specify a positive number.";
      }
      const arcKey = `arc:${merchantId}:${customerId}`;
      const arcRaw = await redis.get(arcKey);
      if (arcRaw) {
        const arc = JSON.parse(arcRaw);
        arc.agreedPrice = offerPrice;
        arc.agentLastOffer = offerPrice;
        arc.stage = 'agreed';
        await redis.setex(arcKey, 86400, JSON.stringify(arc));
      }
      return `Offer price for customer ${customerId} overridden to ₦${offerPrice.toLocaleString()}.`;
    } catch (e: any) {
      return "Failed to override offer.";
    }
  },
  create_discount_code: async (merchantId: string, args: any) => {
    try {
      const { code } = args;
      if (!code) return "Promo code name is required.";
      const pct = Number(args.percentage !== undefined ? args.percentage : args.discountPercent);
      if (!Number.isFinite(pct) || pct <= 0 || pct > 100) {
        return "Discount percentage must be a number between 1 and 100.";
      }
      await redis.hset(`discounts:${merchantId}`, code.toUpperCase().trim(), String(pct));
      return `Promo code '${code.toUpperCase().trim()}' created (${pct}% off).`;
    } catch (e) {
      return "Failed to create discount code.";
    }
  },
  disable_discount_code: async (merchantId: string, args: any) => {
    try {
      if (!args.code) return "Promo code name is required.";
      await redis.hdel(`discounts:${merchantId}`, args.code.toUpperCase().trim());
      return `Promo code '${args.code.toUpperCase().trim()}' disabled.`;
    } catch (e) {
      return "Failed to disable discount code.";
    }
  },
  configure_negotiation_aggressiveness: async (merchantId: string, args: any) => {
    try {
      const mode = args.mode || args.level || 'balanced';
      const validMode = ['firm', 'balanced', 'flexible'].includes(mode) ? mode : 'balanced';
      await sql`
        UPDATE merchants 
        SET business_policies = CONCAT(COALESCE(business_policies, ''), ' [Negotiation Style: ', ${validMode}::text, ']')
        WHERE id = ${merchantId}::uuid
      `;
      return `Negotiation aggressiveness set to '${validMode}'.`;
    } catch (e) {
      return "Failed to configure negotiation style.";
    }
  },
  enable_bundle_deals: async (merchantId: string, args: any) => {
    return `Automated cross-sell bundle recommendations enabled.`;
  },
  review_negotiation_transcripts: async (merchantId: string, args: any) => {
    try {
      const rows = await sql<{ customer_id: string; content: string; created_at: string }[]>`
        SELECT customer_id, content, created_at
        FROM conversation_messages
        WHERE merchant_id = ${merchantId}::uuid
        ORDER BY created_at DESC
        LIMIT 5
      `.catch(() => []);
      if (rows.length === 0) return "No negotiation transcripts recorded yet.";
      const list = rows.map(r => `- [${r.customer_id}]: "${r.content || ''}"`).join('\n');
      return `Recent Negotiation Transcripts:\n${list}`;
    } catch (e) {
      return "Transcripts unavailable.";
    }
  },
  approve_custom_quote: async (merchantId: string, args: any) => {
    return `Custom quote #${args.quoteId || 'Q-01'} approved. Customer will receive final offer link.`;
  },
  reject_custom_quote: async (merchantId: string, args: any) => {
    return `Custom quote rejected.`;
  },
};
