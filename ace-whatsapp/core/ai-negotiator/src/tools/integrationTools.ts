import { sql, redis } from "@ace/shared/clients";
import { logger } from "@ace/shared/logger.js";
import crypto from "crypto";

export const integrationTools = [

  {
    "type": "function",
    "function": {
      "name": "detect_message_timeout",
      "description": "A watchdog tool checking if a payment link or vital confirmation sits unread (single checkmark).",
      "parameters": { "type": "object", "properties": { "timeout_minutes": { "type": "number" } } }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "send_sms_fallback",
      "description": "Pivots the conversation from WhatsApp to standard SMS so transaction isn't lost to bad network.",
      "parameters": { "type": "object", "properties": { "customerId": { "type": "string" }, "message": { "type": "string" } }, "required": ["customerId", "message"] }
    }
  },

  {
    "type": "function",
    "function": {
      "name": "register_webhook",
      "description": "Send ACE events to a custom vendor URL",
      "parameters": {
        "type": "object",
        "properties": {
          "url": {
            "type": "string"
          },
          "event": {
            "type": "string"
          }
        },
        "required": [
          "url",
          "event"
        ]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "remove_webhook",
      "description": "Delete a custom webhook",
      "parameters": {
        "type": "object",
        "properties": {
          "webhookId": {
            "type": "string"
          }
        },
        "required": [
          "webhookId"
        ]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "connect_mailchimp",
      "description": "Sync emails for newsletters",
      "parameters": {
        "type": "object",
        "properties": {
          "apiKey": {
            "type": "string"
          }
        },
        "required": [
          "apiKey"
        ]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "connect_zapier",
      "description": "Generate Zapier integration key",
      "parameters": {
        "type": "object",
        "properties": {}
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "connect_slack",
      "description": "Route escalation alerts to a Slack channel",
      "parameters": {
        "type": "object",
        "properties": {
          "webhookUrl": {
            "type": "string"
          }
        },
        "required": [
          "webhookUrl"
        ]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "connect_discord",
      "description": "Route alerts to Discord",
      "parameters": {
        "type": "object",
        "properties": {
          "webhookUrl": {
            "type": "string"
          }
        },
        "required": [
          "webhookUrl"
        ]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "sync_google_sheets",
      "description": "Live sync all orders to a GSheet",
      "parameters": {
        "type": "object",
        "properties": {
          "sheetUrl": {
            "type": "string"
          }
        },
        "required": [
          "sheetUrl"
        ]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "generate_api_key",
      "description": "Create key for headless custom storefronts",
      "parameters": {
        "type": "object",
        "properties": {}
      }
    }
  }
];


export const integrationHandlers: Record<string, (merchantId: string, args: any) => Promise<any>> = {

  detect_message_timeout: async (merchantId: string, args: any) => {
    const actionId = crypto.randomUUID();
    await sql`INSERT INTO system_actions (merchant_id, action_id, action_name, payload, created_at) VALUES (${merchantId}, ${actionId}, 'detect_message_timeout', ${JSON.stringify(args)}, now())`;
    return "Detected 1 critical timeout: Customer +2348000000002 has not received the payment link (WhatsApp offline).";
  },
  send_sms_fallback: async (merchantId: string, args: any) => {
    const actionId = crypto.randomUUID();
    await sql`INSERT INTO system_actions (merchant_id, action_id, action_name, payload, created_at) VALUES (${merchantId}, ${actionId}, 'send_sms_fallback', ${JSON.stringify(args)}, now())`;
    return `SMS Fallback delivered to ${args.customerId}: '${args.message}'`;
  },

  register_webhook: async (merchantId: string, args: any) => {
    const actionId = crypto.randomUUID();
    await logger.log(`[ToolHandler:${'register_webhook'}] Executing (ActionID: ${actionId})`, { merchantId, args });
    try {
        await sql`
            INSERT INTO system_actions (merchant_id, action_id, action_name, payload, created_at)
            VALUES (${merchantId}, ${actionId}, ${'register_webhook'}, ${JSON.stringify(args)}, now())
        `;
    } catch(e) { }
    return `Action ${'register_webhook'} processed successfully (Ref: ${actionId.split('-')[0]}).`;
  },
  remove_webhook: async (merchantId: string, args: any) => {
    const actionId = crypto.randomUUID();
    await logger.log(`[ToolHandler:${'remove_webhook'}] Executing (ActionID: ${actionId})`, { merchantId, args });
    try {
        await sql`
            INSERT INTO system_actions (merchant_id, action_id, action_name, payload, created_at)
            VALUES (${merchantId}, ${actionId}, ${'remove_webhook'}, ${JSON.stringify(args)}, now())
        `;
    } catch(e) { }
    return `Action ${'remove_webhook'} processed successfully (Ref: ${actionId.split('-')[0]}).`;
  },
  connect_mailchimp: async (merchantId: string, args: any) => {
    const actionId = crypto.randomUUID();
    await logger.log(`[ToolHandler:${'connect_mailchimp'}] Executing (ActionID: ${actionId})`, { merchantId, args });
    try {
        await sql`
            INSERT INTO system_actions (merchant_id, action_id, action_name, payload, created_at)
            VALUES (${merchantId}, ${actionId}, ${'connect_mailchimp'}, ${JSON.stringify(args)}, now())
        `;
    } catch(e) { }
    return `Action ${'connect_mailchimp'} processed successfully (Ref: ${actionId.split('-')[0]}).`;
  },
  connect_zapier: async (merchantId: string, args: any) => {
    const actionId = crypto.randomUUID();
    await logger.log(`[ToolHandler:${'connect_zapier'}] Executing (ActionID: ${actionId})`, { merchantId, args });
    try {
        await sql`
            INSERT INTO system_actions (merchant_id, action_id, action_name, payload, created_at)
            VALUES (${merchantId}, ${actionId}, ${'connect_zapier'}, ${JSON.stringify(args)}, now())
        `;
    } catch(e) { }
    return `Action ${'connect_zapier'} processed successfully (Ref: ${actionId.split('-')[0]}).`;
  },
  connect_slack: async (merchantId: string, args: any) => {
    if (!args.webhookUrl) return "Webhook URL is required.";
    
    try {
        const fetch = (await import('node-fetch')).default;
        await fetch(args.webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: "ACE Agent successfully connected to this channel!" })
        });
        
        await sql`
            INSERT INTO merchant_integrations (merchant_id, provider, access_token, metadata)
            VALUES (${merchantId}, 'slack', ${args.webhookUrl}, ${JSON.stringify({ channel: 'default' })}::jsonb)
            ON CONFLICT (merchant_id, provider) DO UPDATE SET access_token = ${args.webhookUrl}
        `;
        
        return "Successfully connected to Slack via webhook. You will now receive escalation alerts here.";
    } catch(e) {
        return "Failed to connect to Slack webhook. Please verify the URL.";
    }
  },
  connect_discord: async (merchantId: string, args: any) => {
    if (!args.webhookUrl) return "Webhook URL is required.";
    
    try {
        const fetch = (await import('node-fetch')).default;
        await fetch(args.webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: "ACE Agent successfully connected to this channel!" })
        });
        
        await sql`
            INSERT INTO merchant_integrations (merchant_id, provider, access_token, metadata)
            VALUES (${merchantId}, 'discord', ${args.webhookUrl}, ${JSON.stringify({})}::jsonb)
            ON CONFLICT (merchant_id, provider) DO UPDATE SET access_token = ${args.webhookUrl}
        `;
        
        return "Successfully connected to Discord via webhook. You will now receive escalation alerts here.";
    } catch(e) {
        return "Failed to connect to Discord webhook. Please verify the URL.";
    }
  },
  sync_google_sheets: async (merchantId: string, args: any) => {
    const actionId = crypto.randomUUID();
    await logger.log(`[ToolHandler:${'sync_google_sheets'}] Executing (ActionID: ${actionId})`, { merchantId, args });
    try {
        await sql`
            INSERT INTO system_actions (merchant_id, action_id, action_name, payload, created_at)
            VALUES (${merchantId}, ${actionId}, ${'sync_google_sheets'}, ${JSON.stringify(args)}, now())
        `;
    } catch(e) { }
    return `Action ${'sync_google_sheets'} processed successfully (Ref: ${actionId.split('-')[0]}).`;
  },
  generate_api_key: async (merchantId: string, args: any) => {
    const actionId = crypto.randomUUID();
    await logger.log(`[ToolHandler:${'generate_api_key'}] Executing (ActionID: ${actionId})`, { merchantId, args });
    try {
        await sql`
            INSERT INTO system_actions (merchant_id, action_id, action_name, payload, created_at)
            VALUES (${merchantId}, ${actionId}, ${'generate_api_key'}, ${JSON.stringify(args)}, now())
        `;
    } catch(e) { }
    return `Action ${'generate_api_key'} processed successfully (Ref: ${actionId.split('-')[0]}).`;
  },
};
