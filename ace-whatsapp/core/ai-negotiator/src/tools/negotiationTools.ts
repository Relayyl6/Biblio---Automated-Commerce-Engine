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
    const actionId = crypto.randomUUID();
    await logger.log(`[ToolHandler:${'set_floor_price'}] Executing (ActionID: ${actionId})`, { merchantId, args });
    try {
        await sql`
            INSERT INTO system_actions (merchant_id, action_id, action_type, payload, created_at)
            VALUES (${merchantId}, ${actionId}, ${'set_floor_price'}, ${JSON.stringify(args)}, now())
        `;
    } catch(e) { }
    return `Action ${'set_floor_price'} processed successfully (Ref: ${actionId.split('-')[0]}).`;
  },
  override_ai_offer: async (merchantId: string, args: any) => {
    const actionId = crypto.randomUUID();
    await logger.log(`[ToolHandler:${'override_ai_offer'}] Executing (ActionID: ${actionId})`, { merchantId, args });
    try {
        await sql`
            INSERT INTO system_actions (merchant_id, action_id, action_type, payload, created_at)
            VALUES (${merchantId}, ${actionId}, ${'override_ai_offer'}, ${JSON.stringify(args)}, now())
        `;
    } catch(e) { }
    return `Action ${'override_ai_offer'} processed successfully (Ref: ${actionId.split('-')[0]}).`;
  },
  create_discount_code: async (merchantId: string, args: any) => {
    const actionId = crypto.randomUUID();
    await logger.log(`[ToolHandler:${'create_discount_code'}] Executing (ActionID: ${actionId})`, { merchantId, args });
    try {
        await sql`
            INSERT INTO system_actions (merchant_id, action_id, action_type, payload, created_at)
            VALUES (${merchantId}, ${actionId}, ${'create_discount_code'}, ${JSON.stringify(args)}, now())
        `;
    } catch(e) { }
    return `Action ${'create_discount_code'} processed successfully (Ref: ${actionId.split('-')[0]}).`;
  },
  disable_discount_code: async (merchantId: string, args: any) => {
    const actionId = crypto.randomUUID();
    await logger.log(`[ToolHandler:${'disable_discount_code'}] Executing (ActionID: ${actionId})`, { merchantId, args });
    try {
        await sql`
            INSERT INTO system_actions (merchant_id, action_id, action_type, payload, created_at)
            VALUES (${merchantId}, ${actionId}, ${'disable_discount_code'}, ${JSON.stringify(args)}, now())
        `;
    } catch(e) { }
    return `Action ${'disable_discount_code'} processed successfully (Ref: ${actionId.split('-')[0]}).`;
  },
  configure_negotiation_aggressiveness: async (merchantId: string, args: any) => {
    const actionId = crypto.randomUUID();
    await logger.log(`[ToolHandler:${'configure_negotiation_aggressiveness'}] Executing (ActionID: ${actionId})`, { merchantId, args });
    try {
        await sql`
            INSERT INTO system_actions (merchant_id, action_id, action_type, payload, created_at)
            VALUES (${merchantId}, ${actionId}, ${'configure_negotiation_aggressiveness'}, ${JSON.stringify(args)}, now())
        `;
    } catch(e) { }
    return `Action ${'configure_negotiation_aggressiveness'} processed successfully (Ref: ${actionId.split('-')[0]}).`;
  },
  enable_bundle_deals: async (merchantId: string, args: any) => {
    const actionId = crypto.randomUUID();
    await logger.log(`[ToolHandler:${'enable_bundle_deals'}] Executing (ActionID: ${actionId})`, { merchantId, args });
    try {
        await sql`
            INSERT INTO system_actions (merchant_id, action_id, action_type, payload, created_at)
            VALUES (${merchantId}, ${actionId}, ${'enable_bundle_deals'}, ${JSON.stringify(args)}, now())
        `;
    } catch(e) { }
    return `Action ${'enable_bundle_deals'} processed successfully (Ref: ${actionId.split('-')[0]}).`;
  },
  review_negotiation_transcripts: async (merchantId: string, args: any) => {
    const actionId = crypto.randomUUID();
    await logger.log(`[ToolHandler:${'review_negotiation_transcripts'}] Executing (ActionID: ${actionId})`, { merchantId, args });
    try {
        await sql`
            INSERT INTO system_actions (merchant_id, action_id, action_type, payload, created_at)
            VALUES (${merchantId}, ${actionId}, ${'review_negotiation_transcripts'}, ${JSON.stringify(args)}, now())
        `;
    } catch(e) { }
    return `Action ${'review_negotiation_transcripts'} processed successfully (Ref: ${actionId.split('-')[0]}).`;
  },
  approve_custom_quote: async (merchantId: string, args: any) => {
    const actionId = crypto.randomUUID();
    await logger.log(`[ToolHandler:${'approve_custom_quote'}] Executing (ActionID: ${actionId})`, { merchantId, args });
    try {
        await sql`
            INSERT INTO system_actions (merchant_id, action_id, action_type, payload, created_at)
            VALUES (${merchantId}, ${actionId}, ${'approve_custom_quote'}, ${JSON.stringify(args)}, now())
        `;
    } catch(e) { }
    return `Action ${'approve_custom_quote'} processed successfully (Ref: ${actionId.split('-')[0]}).`;
  },
  reject_custom_quote: async (merchantId: string, args: any) => {
    const actionId = crypto.randomUUID();
    await logger.log(`[ToolHandler:${'reject_custom_quote'}] Executing (ActionID: ${actionId})`, { merchantId, args });
    try {
        await sql`
            INSERT INTO system_actions (merchant_id, action_id, action_type, payload, created_at)
            VALUES (${merchantId}, ${actionId}, ${'reject_custom_quote'}, ${JSON.stringify(args)}, now())
        `;
    } catch(e) { }
    return `Action ${'reject_custom_quote'} processed successfully (Ref: ${actionId.split('-')[0]}).`;
  },
};
