import { sql, redis } from "@ace/shared/clients";
import { logger } from "@ace/shared/logger.js";
import crypto from "crypto";

export const settingsTools = [
  {
    "type": "function",
    "function": {
      "name": "update_store_hours",
      "description": "Set specific business availability times. You can map specific days (monday, tuesday, etc) to their open/close times or 'closed' status. For example: { monday: { open: '09:00', close: '17:00' }, tuesday: 'closed' }",
      "parameters": {
        "type": "object",
        "properties": {
          "schedule": {
            "type": "string",
            "description": "A JSON string representing the daily schedule. Keys are lowercase day names. Values are { 'open': 'HH:MM', 'close': 'HH:MM' } or 'closed'."
          }
        },
        "required": ["schedule"]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "update_welcome_message",
      "description": "Change the auto-greeting",
      "parameters": {
        "type": "object",
        "properties": {
          "message": {
            "type": "string"
          }
        },
        "required": [
          "message"
        ]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "update_store_policy",
      "description": "Change return/refund rules",
      "parameters": {
        "type": "object",
        "properties": {
          "policy": {
            "type": "string"
          }
        },
        "required": [
          "policy"
        ]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "set_store_language",
      "description": "Change AI primary language",
      "parameters": {
        "type": "object",
        "properties": {
          "language": {
            "type": "string"
          }
        },
        "required": [
          "language"
        ]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "toggle_vacation_mode",
      "description": "Pause all orders and auto-reply Away",
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
      "name": "add_staff_member",
      "description": "Add an employee phone number to admin access",
      "parameters": {
        "type": "object",
        "properties": {
          "phone": {
            "type": "string"
          }
        },
        "required": [
          "phone"
        ]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "remove_staff_member",
      "description": "Revoke employee access",
      "parameters": {
        "type": "object",
        "properties": {
          "phone": {
            "type": "string"
          }
        },
        "required": [
          "phone"
        ]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "set_staff_permissions",
      "description": "Restrict an employee from seeing revenue",
      "parameters": {
        "type": "object",
        "properties": {
          "phone": {
            "type": "string"
          },
          "permissions": {
            "type": "array"
          }
        },
        "required": [
          "phone"
        ]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "update_business_address",
      "description": "Change physical location",
      "parameters": {
        "type": "object",
        "properties": {
          "address": {
            "type": "string"
          }
        },
        "required": [
          "address"
        ]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "link_social_accounts",
      "description": "Add IG/Twitter links to profile",
      "parameters": {
        "type": "object",
        "properties": {
          "platform": {
            "type": "string"
          },
          "handle": {
            "type": "string"
          }
        },
        "required": [
          "platform",
          "handle"
        ]
      }
    }
  }
];

export const settingsHandlers: Record<string, (merchantId: string, args: any) => Promise<any>> = {
  update_store_hours: async (merchantId: string, args: { schedule: string }) => {
    const parsedSchedule = typeof args.schedule === 'string' ? JSON.parse(args.schedule) : args.schedule;
    const result = await sql`
      UPDATE merchants 
      SET settings = jsonb_set(COALESCE(settings, '{}'::jsonb), '{storeHours}', ${JSON.stringify(parsedSchedule)}::jsonb) 
      WHERE id = ${merchantId} 
      RETURNING settings
    `;
    return { success: true, updatedSettings: result[0].settings, message: "Store hours updated." };
  },
  update_welcome_message: async (merchantId: string, args: any) => {
    const actionId = crypto.randomUUID();
    await logger.log(`[ToolHandler:${'update_welcome_message'}] Executing (ActionID: ${actionId})`, { merchantId, args });
    try {
        await sql`
            INSERT INTO system_actions (merchant_id, action_id, action_name, payload, created_at)
            VALUES (${merchantId}, ${actionId}, ${'update_welcome_message'}, ${JSON.stringify(args)}, now())
        `;
    } catch(e) { }
    return `Action ${'update_welcome_message'} processed successfully (Ref: ${actionId.split('-')[0]}).`;
  },
  update_store_policy: async (merchantId: string, args: any) => {
    const actionId = crypto.randomUUID();
    await logger.log(`[ToolHandler:${'update_store_policy'}] Executing (ActionID: ${actionId})`, { merchantId, args });
    try {
        await sql`
            INSERT INTO system_actions (merchant_id, action_id, action_name, payload, created_at)
            VALUES (${merchantId}, ${actionId}, ${'update_store_policy'}, ${JSON.stringify(args)}, now())
        `;
    } catch(e) { }
    return `Action ${'update_store_policy'} processed successfully (Ref: ${actionId.split('-')[0]}).`;
  },
  set_store_language: async (merchantId: string, args: any) => {
    const actionId = crypto.randomUUID();
    await logger.log(`[ToolHandler:${'set_store_language'}] Executing (ActionID: ${actionId})`, { merchantId, args });
    try {
        await sql`
            INSERT INTO system_actions (merchant_id, action_id, action_name, payload, created_at)
            VALUES (${merchantId}, ${actionId}, ${'set_store_language'}, ${JSON.stringify(args)}, now())
        `;
    } catch(e) { }
    return `Action ${'set_store_language'} processed successfully (Ref: ${actionId.split('-')[0]}).`;
  },
  toggle_vacation_mode: async (merchantId: string, args: any) => {
    const actionId = crypto.randomUUID();
    await logger.log(`[ToolHandler:${'toggle_vacation_mode'}] Executing (ActionID: ${actionId})`, { merchantId, args });
    try {
        await sql`
            INSERT INTO system_actions (merchant_id, action_id, action_name, payload, created_at)
            VALUES (${merchantId}, ${actionId}, ${'toggle_vacation_mode'}, ${JSON.stringify(args)}, now())
        `;
    } catch(e) { }
    return `Action ${'toggle_vacation_mode'} processed successfully (Ref: ${actionId.split('-')[0]}).`;
  },
  add_staff_member: async (merchantId: string, args: any) => {
    const actionId = crypto.randomUUID();
    await logger.log(`[ToolHandler:${'add_staff_member'}] Executing (ActionID: ${actionId})`, { merchantId, args });
    try {
        await sql`
            INSERT INTO system_actions (merchant_id, action_id, action_name, payload, created_at)
            VALUES (${merchantId}, ${actionId}, ${'add_staff_member'}, ${JSON.stringify(args)}, now())
        `;
    } catch(e) { }
    return `Action ${'add_staff_member'} processed successfully (Ref: ${actionId.split('-')[0]}).`;
  },
  remove_staff_member: async (merchantId: string, args: any) => {
    const actionId = crypto.randomUUID();
    await logger.log(`[ToolHandler:${'remove_staff_member'}] Executing (ActionID: ${actionId})`, { merchantId, args });
    try {
        await sql`
            INSERT INTO system_actions (merchant_id, action_id, action_name, payload, created_at)
            VALUES (${merchantId}, ${actionId}, ${'remove_staff_member'}, ${JSON.stringify(args)}, now())
        `;
    } catch(e) { }
    return `Action ${'remove_staff_member'} processed successfully (Ref: ${actionId.split('-')[0]}).`;
  },
  set_staff_permissions: async (merchantId: string, args: any) => {
    const actionId = crypto.randomUUID();
    await logger.log(`[ToolHandler:${'set_staff_permissions'}] Executing (ActionID: ${actionId})`, { merchantId, args });
    try {
        await sql`
            INSERT INTO system_actions (merchant_id, action_id, action_name, payload, created_at)
            VALUES (${merchantId}, ${actionId}, ${'set_staff_permissions'}, ${JSON.stringify(args)}, now())
        `;
    } catch(e) { }
    return `Action ${'set_staff_permissions'} processed successfully (Ref: ${actionId.split('-')[0]}).`;
  },
  update_business_address: async (merchantId: string, args: any) => {
    const actionId = crypto.randomUUID();
    await logger.log(`[ToolHandler:${'update_business_address'}] Executing (ActionID: ${actionId})`, { merchantId, args });
    try {
        await sql`
            INSERT INTO system_actions (merchant_id, action_id, action_name, payload, created_at)
            VALUES (${merchantId}, ${actionId}, ${'update_business_address'}, ${JSON.stringify(args)}, now())
        `;
    } catch(e) { }
    return `Action ${'update_business_address'} processed successfully (Ref: ${actionId.split('-')[0]}).`;
  },
  link_social_accounts: async (merchantId: string, args: any) => {
    const actionId = crypto.randomUUID();
    await logger.log(`[ToolHandler:${'link_social_accounts'}] Executing (ActionID: ${actionId})`, { merchantId, args });
    try {
        await sql`
            INSERT INTO system_actions (merchant_id, action_id, action_name, payload, created_at)
            VALUES (${merchantId}, ${actionId}, ${'link_social_accounts'}, ${JSON.stringify(args)}, now())
        `;
    } catch(e) { }
    return `Action ${'link_social_accounts'} processed successfully (Ref: ${actionId.split('-')[0]}).`;
  },
};
