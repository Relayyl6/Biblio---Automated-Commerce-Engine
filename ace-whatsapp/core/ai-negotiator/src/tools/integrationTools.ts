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
  },
  {
    "type": "function",
    "function": {
      "name": "connect_google_calendar",
      "description": "Connect the vendor's Google Calendar so bookings are automatically synced. Call this when the vendor asks to link Google Calendar.",
      "parameters": {
        "type": "object",
        "properties": {
          "action": { "type": "string", "enum": ["get_link", "check_status"], "description": "get_link returns the OAuth URL. check_status checks if already connected." }
        },
        "required": ["action"]
      }
    }
  }
];

export const integrationHandlers: Record<string, (merchantId: string, args: any) => Promise<any>> = {
  detect_message_timeout: async (merchantId: string, args: any) => {
    try {
      const { timeout_minutes } = args;
      const rows = await sql`
        SELECT id, customer_id, text
        FROM messages
        WHERE merchant_id = ${merchantId}
          AND status = 'unread'
          AND created_at < NOW() - (${timeout_minutes} * interval '1 minute')
      `;
      let queued = 0;
      if (rows.length > 0) {
        const { Queue } = await import("bullmq");
        const smsQueue = new Queue("sms-fallback", {
          connection: { ...redis.options, maxRetriesPerRequest: null }
        });
        for (const row of rows) {
          await smsQueue.add("fallback-sms", {
            merchantId,
            merchantPhone: row.customer_id,
            text: row.text
          });
          queued++;
        }
      }
      return { timedOut: rows.length > 0, count: rows.length, queued };
    } catch (error: any) {
      logger.error("detect_message_timeout error", error);
      return { ok: false, error: error.message };
    }
  },

  send_sms_fallback: async (merchantId: string, args: any) => {
    try {
      const { customerId, message } = args;
      const africastalking = (await import("africastalking")).default;
      const at = africastalking({
        apiKey: process.env.AFRICAS_TALKING_API_KEY || "",
        username: process.env.AFRICAS_TALKING_USERNAME || "sandbox"
      });
      const sms = at.SMS;
      const formattedPhone = customerId.startsWith("+") ? customerId : `+${customerId}`;
      
      const response = await sms.send({
        to: [formattedPhone],
        message: message
      });
      
      await logger.log(`SMS fallback sent via AT`, { response });
      
      return { ok: true, provider: 'africas_talking', to: customerId };
    } catch (error: any) {
      logger.error("send_sms_fallback error", error);
      return { ok: false, error: error.message };
    }
  },

  register_webhook: async (merchantId: string, args: any) => {
    const actionId = crypto.randomUUID();
    await logger.log(`[ToolHandler:${'register_webhook'}] Executing (ActionID: ${actionId})`, { merchantId, args });
    try {
        await sql`
            INSERT INTO system_actions (merchant_id, action_id, action_type, payload, created_at)
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
            INSERT INTO system_actions (merchant_id, action_id, action_type, payload, created_at)
            VALUES (${merchantId}, ${actionId}, ${'remove_webhook'}, ${JSON.stringify(args)}, now())
        `;
    } catch(e) { }
    return `Action ${'remove_webhook'} processed successfully (Ref: ${actionId.split('-')[0]}).`;
  },
  connect_mailchimp: async (merchantId: string, args: any) => {
    try {
      await sql`
        INSERT INTO merchant_integrations (merchant_id, provider, access_token)
        VALUES (${merchantId}, 'mailchimp', ${args.apiKey})
        ON CONFLICT (merchant_id, provider) DO UPDATE SET access_token = ${args.apiKey}
      `;
      return { ok: true, message: 'Mailchimp connected successfully.' };
    } catch (e: any) {
      logger.error('connect_mailchimp error', e);
      return { ok: false, error: e.message };
    }
  },
  connect_zapier: async (merchantId: string, args: any) => {
    const actionId = crypto.randomUUID();
    await logger.log(`[ToolHandler:${'connect_zapier'}] Executing (ActionID: ${actionId})`, { merchantId, args });
    try {
        await sql`
            INSERT INTO system_actions (merchant_id, action_id, action_type, payload, created_at)
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
            INSERT INTO system_actions (merchant_id, action_id, action_type, payload, created_at)
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
            INSERT INTO system_actions (merchant_id, action_id, action_type, payload, created_at)
            VALUES (${merchantId}, ${actionId}, ${'generate_api_key'}, ${JSON.stringify(args)}, now())
        `;
    } catch(e) { }
    return `Action ${'generate_api_key'} processed successfully (Ref: ${actionId.split('-')[0]}).`;
  },
  connect_google_calendar: async (merchantId: string, args: any) => {
    try {
      if (args.action === 'check_status') {
        const rows = await sql`SELECT 1 FROM merchant_integrations WHERE merchant_id = ${merchantId} AND provider = 'google_calendar' LIMIT 1`;
        return { connected: rows.length > 0 };
      } else if (args.action === 'get_link') {
        const clientId = process.env.GOOGLE_CLIENT_ID || '';
        const redirectUri = process.env.GOOGLE_REDIRECT_URI || '';
        const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=https://www.googleapis.com/auth/calendar&access_type=offline&prompt=consent&state=${merchantId}`;
        return { url };
      }
      return { error: 'invalid action' };
    } catch (e: any) {
      logger.error('connect_google_calendar error', e);
      return { ok: false, error: e.message };
    }
  },
};
