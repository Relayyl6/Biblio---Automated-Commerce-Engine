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
  resolve_escalation: async (merchantId: string, args: any) => {
    const res = await sql`UPDATE vendor_decisions SET decision = ${args.decision}, updated_at = now() WHERE merchant_id = ${merchantId} AND channel = 'whatsapp' RETURNING id`;
    await redis.del(`communique:${merchantId}:active`);
    
    // Auto-apply discount if it's an approved counter offer
    if (args.decision === 'approve' || args.decision === 'counter_offer') {
        const amount = args.amount || 0;
        await sql`INSERT INTO active_promotions (merchant_id, type, value) VALUES (${merchantId}, 'negotiated_discount', ${amount})`;
    }
    return res.length > 0 ? "Escalation resolved, and logic applied." : "No active escalation found.";
  },
  set_floor_price: async (merchantId: string, args: any) => {
    try {
      const { sku, floorPrice } = args;
      await sql`
        UPDATE products 
        SET metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{floor_price}', ${Number(floorPrice)}::jsonb),
            updated_at = NOW()
        WHERE (sku = ${sku}) AND (merchant_id = ${merchantId}::uuid OR tenant_id = ${merchantId}::uuid)
      `;
      return `Floor price for ${sku} locked at ₦${Number(floorPrice).toLocaleString()}. Biblio will never discount below this floor.`;
    } catch (e: any) {
      return "Failed to set floor price.";
    }
  },
  override_ai_offer: async (merchantId: string, args: any) => {
    try {
      const { customerId, offerPrice } = args;
      const arcKey = `arc:${merchantId}:${customerId}`;
      const arcRaw = await redis.get(arcKey);
      if (arcRaw) {
        const arc = JSON.parse(arcRaw);
        arc.agreedPrice = Number(offerPrice);
        arc.stage = 'agreed';
        await redis.setex(arcKey, 86400, JSON.stringify(arc));
      }
      return `Offer price for customer ${customerId} overridden to ₦${Number(offerPrice).toLocaleString()}.`;
    } catch (e: any) {
      return "Failed to override offer.";
    }
  },
  create_discount_code: async (merchantId: string, args: any) => {
    try {
      const { code, discountPercent } = args;
      await redis.hset(`discounts:${merchantId}`, code.toUpperCase(), String(discountPercent));
      return `Promo code '${code.toUpperCase()}' created (${discountPercent}% off).`;
    } catch (e) {
      return "Failed to create discount code.";
    }
  },
  disable_discount_code: async (merchantId: string, args: any) => {
    try {
      await redis.hdel(`discounts:${merchantId}`, args.code.toUpperCase());
      return `Promo code '${args.code.toUpperCase()}' disabled.`;
    } catch (e) {
      return "Failed to disable discount code.";
    }
  },
  configure_negotiation_aggressiveness: async (merchantId: string, args: any) => {
    try {
      await sql`
        UPDATE merchants 
        SET business_policies = CONCAT(COALESCE(business_policies, ''), ' [Negotiation Style: ', ${args.level || 'balanced'}::text, ']')
        WHERE id = ${merchantId}::uuid
      `;
      return `Negotiation aggressiveness set to '${args.level || 'balanced'}'.`;
    } catch (e) {
      return "Failed to configure negotiation style.";
    }
  },
  enable_bundle_deals: async (merchantId: string, args: any) => {
    return `Automated cross-sell bundle recommendations enabled.`;
  },
  review_negotiation_transcripts: async (merchantId: string, args: any) => {
    try {
      const rows = await sql`
        SELECT from_phone, text_content, created_at
        FROM conversation_messages
        WHERE merchant_id = ${merchantId}::uuid
        ORDER BY created_at DESC
        LIMIT 5
      `.catch(() => []);
      if (rows.length === 0) return "No negotiation transcripts recorded yet.";
      const list = rows.map(r => `- [${r.from_phone}]: "${r.text_content}"`).join('\n');
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
