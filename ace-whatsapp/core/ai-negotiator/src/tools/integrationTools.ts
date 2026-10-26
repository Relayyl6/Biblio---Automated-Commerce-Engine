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
      const timeoutMin = Number(timeout_minutes) || 15;
      const rows = await sql<{ id: string; customer_id: string; content: string }[]>`
        SELECT id, customer_id, content
        FROM conversation_messages
        WHERE merchant_id = ${merchantId}::uuid
          AND (metadata->>'status' = 'unread' OR metadata->>'read' = 'false' OR source = 'customer')
          AND created_at < NOW() - (${timeoutMin} * interval '1 minute')
        ORDER BY created_at DESC
        LIMIT 10
      `.catch(() => []);

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
            text: row.content
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
    try {
      const secret = `whsec_${crypto.randomBytes(24).toString('hex')}`;
      const events = Array.isArray(args.event) ? args.event : [args.event || 'order.created'];
      const rows = await sql<{ id: string; url: string; secret: string; events: string[] }[]>`
        INSERT INTO tenant_webhooks (tenant_id, url, secret, events, is_active, created_at, updated_at)
        VALUES (${merchantId}::uuid, ${args.url}, ${secret}, ${events}, true, NOW(), NOW())
        RETURNING id, url, secret, events
      `;
      const row = rows[0];
      return `Webhook registered successfully!
• Webhook ID: ${row.id}
• Endpoint: ${row.url}
• Subscribed Events: ${row.events.join(', ')}
• HMAC Secret: ${row.secret} (Store securely to verify signatures).`;
    } catch (e: any) {
      logger.error("[register_webhook error]", e);
      return `Failed to register webhook: ${e.message}`;
    }
  },

  remove_webhook: async (merchantId: string, args: any) => {
    try {
      const deleted = await sql`
        DELETE FROM tenant_webhooks
        WHERE id = ${args.webhookId}::uuid AND tenant_id = ${merchantId}::uuid
        RETURNING id
      `.catch(() => []);
      if (deleted.length === 0) return `Webhook ${args.webhookId} not found or already removed.`;
      return `Webhook ${args.webhookId} removed successfully.`;
    } catch (e: any) {
      logger.error("[remove_webhook error]", e);
      return `Failed to remove webhook: ${e.message}`;
    }
  },

  connect_mailchimp: async (merchantId: string, args: any) => {
    try {
      await sql`
        INSERT INTO merchant_integrations (merchant_id, provider, access_token, updated_at)
        VALUES (${merchantId}::uuid, 'mailchimp', ${args.apiKey}, NOW())
        ON CONFLICT (merchant_id, provider) DO UPDATE SET access_token = ${args.apiKey}, updated_at = NOW()
      `;
      return { ok: true, message: 'Mailchimp connected successfully.' };
    } catch (e: any) {
      logger.error('connect_mailchimp error', e);
      return { ok: false, error: e.message };
    }
  },

  connect_zapier: async (merchantId: string, _args: any) => {
    try {
      const rawKey = `ace_zap_${crypto.randomBytes(24).toString('hex')}`;
      const keyPrefix = rawKey.slice(0, 12);
      const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
      await sql`
        INSERT INTO api_keys (tenant_id, name, key_prefix, key_hash, key_type, environment, scopes, is_active)
        VALUES (${merchantId}::uuid, 'Zapier Autonomous Webhook Sync', ${keyPrefix}, ${keyHash}, 'zapier', 'production', ARRAY['orders:read', 'orders:write', 'customers:read'], true)
      `;
      return `⚡ Zapier Integration Key Generated:
\`${rawKey}\`

Steps to connect:
1. Open Zapier and search for the 'Biblio Commerce' or 'Webhook by Zapier' app.
2. Select your trigger event (e.g., 'New Verified Order' or 'New Chat Inquiry').
3. Paste this API Key into the authorization header.`;
    } catch (e: any) {
      logger.error("[connect_zapier error]", e);
      return `Failed to generate Zapier key: ${e.message}`;
    }
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
            INSERT INTO merchant_integrations (merchant_id, provider, access_token, metadata, updated_at)
            VALUES (${merchantId}::uuid, 'slack', ${args.webhookUrl}, ${JSON.stringify({ channel: 'default' })}::jsonb, NOW())
            ON CONFLICT (merchant_id, provider) DO UPDATE SET access_token = ${args.webhookUrl}, metadata = ${JSON.stringify({ channel: 'default' })}::jsonb, updated_at = NOW()
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
            INSERT INTO merchant_integrations (merchant_id, provider, access_token, metadata, updated_at)
            VALUES (${merchantId}::uuid, 'discord', ${args.webhookUrl}, ${JSON.stringify({})}::jsonb, NOW())
            ON CONFLICT (merchant_id, provider) DO UPDATE SET access_token = ${args.webhookUrl}, metadata = ${JSON.stringify({})}::jsonb, updated_at = NOW()
        `;
        
        return "Successfully connected to Discord via webhook. You will now receive escalation alerts here.";
    } catch(e) {
        return "Failed to connect to Discord webhook. Please verify the URL.";
    }
  },

  sync_google_sheets: async (merchantId: string, args: any) => {
    try {
      if (!args.sheetUrl) return "Google Sheet URL is required.";
      await sql`
        INSERT INTO merchant_integrations (merchant_id, provider, access_token, metadata, updated_at)
        VALUES (${merchantId}::uuid, 'google_sheets', ${args.sheetUrl}, ${JSON.stringify({ sheet_url: args.sheetUrl, connected_at: new Date().toISOString() })}::jsonb, NOW())
        ON CONFLICT (merchant_id, provider) DO UPDATE SET
          access_token = ${args.sheetUrl},
          metadata = ${JSON.stringify({ sheet_url: args.sheetUrl, updated_at: new Date().toISOString() })}::jsonb,
          updated_at = NOW()
      `;
      return `Successfully connected Google Sheets to your Biblio store!\n• Sheet URL: ${args.sheetUrl}\n• Real-time sync enabled for: Orders, Customers, Inventory, and Payout Records.`;
    } catch (e: any) {
      logger.error("[sync_google_sheets error]", e);
      return `Failed to sync Google Sheets: ${e.message}`;
    }
  },

  generate_api_key: async (merchantId: string, _args: any) => {
    try {
      const rawKey = `ace_live_${crypto.randomBytes(32).toString('hex')}`;
      const keyPrefix = rawKey.slice(0, 13);
      const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
      await sql`
        INSERT INTO api_keys (tenant_id, name, key_prefix, key_hash, key_type, environment, scopes, is_active)
        VALUES (${merchantId}::uuid, 'Developer API Key', ${keyPrefix}, ${keyHash}, 'live', 'production', ARRAY['*'], true)
      `;
      return `🔑 Live API Key Generated:
\`${rawKey}\`

⚠️ Copy this key now! For security reasons, it cannot be displayed again.
Key Prefix: ${keyPrefix}...
Scopes: Full Merchant Engine API Access.`;
    } catch (e: any) {
      logger.error("[generate_api_key error]", e);
      return `Failed to generate API key: ${e.message}`;
    }
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
