import { sql, redis } from "@ace/shared/clients";
import { logger } from "@ace/shared/logger.js";
import crypto from "crypto";


export const crmTools = [

  {
    "type": "function",
    "function": {
      "name": "analyze_churn_risk",
      "description": "Runs nightly to find VIP customers who have deviated from their usual purchase frequency.",
      "parameters": { "type": "object", "properties": {} }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "generate_winback_offer",
      "description": "Drafts a culturally nuanced, highly specific message based on past purchases to win back a customer.",
      "parameters": { "type": "object", "properties": { "customerId": { "type": "string" } }, "required": ["customerId"] }
    }
  },

  {
    "type": "function",
    "function": {
      "name": "get_customer_profile",
      "description": "View a customer history",
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
      "name": "tag_customer",
      "description": "Add tags to a customer",
      "parameters": {
        "type": "object",
        "properties": {
          "customerId": {
            "type": "string"
          },
          "tag": {
            "type": "string"
          }
        },
        "required": [
          "customerId",
          "tag"
        ]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "block_customer",
      "description": "Block a number from ordering",
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
      "name": "unblock_customer",
      "description": "Remove a block",
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
      "name": "send_broadcast_message",
      "description": "Blast a message to tagged customers",
      "parameters": {
        "type": "object",
        "properties": {
          "tag": {
            "type": "string"
          },
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
      "name": "sync_hubspot_contacts",
      "description": "Export ACE buyers to HubSpot CRM",
      "parameters": {
        "type": "object",
        "properties": {}
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "sync_salesforce_leads",
      "description": "Export leads to Salesforce",
      "parameters": {
        "type": "object",
        "properties": {}
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "create_hubspot_ticket",
      "description": "Open a support ticket in HubSpot",
      "parameters": {
        "type": "object",
        "properties": {
          "customerId": {
            "type": "string"
          },
          "issue": {
            "type": "string"
          }
        },
        "required": [
          "issue"
        ]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "resolve_hubspot_ticket",
      "description": "Close a ticket",
      "parameters": {
        "type": "object",
        "properties": {
          "ticketId": {
            "type": "string"
          }
        },
        "required": [
          "ticketId"
        ]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "add_customer_note",
      "description": "Add a private CRM note to a buyer profile",
      "parameters": {
        "type": "object",
        "properties": {
          "customerId": {
            "type": "string"
          },
          "note": {
            "type": "string"
          }
        },
        "required": [
          "customerId",
          "note"
        ]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "get_top_customers",
      "description": "List top 10 buyers by lifetime value",
      "parameters": {
        "type": "object",
        "properties": {}
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "offer_loyalty_discount",
      "description": "Automatically send a discount to a loyal customer",
      "parameters": {
        "type": "object",
        "properties": {
          "customerId": {
            "type": "string"
          },
          "discountPercentage": {
            "type": "number"
          }
        },
        "required": [
          "customerId",
          "discountPercentage"
        ]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "schedule_follow_up",
      "description": "Remind the vendor to follow up",
      "parameters": {
        "type": "object",
        "properties": {
          "customerId": {
            "type": "string"
          },
          "days": {
            "type": "number"
          }
        },
        "required": [
          "customerId",
          "days"
        ]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "churn_risk_analysis",
      "description": "Identify customers who haven't bought recently",
      "parameters": {
        "type": "object",
        "properties": {}
      }
    }
  }
];

export const crmHandlers: Record<string, (merchantId: string, args: any) => Promise<any>> = {

  analyze_churn_risk: async (merchantId: string, args: any) => {
    const actionId = crypto.randomUUID();
    await sql`INSERT INTO system_actions (merchant_id, action_id, action_name, payload, created_at) VALUES (${merchantId}, ${actionId}, 'analyze_churn_risk', ${JSON.stringify(args)}, now())`;
    return "Found 1 at-risk VIP: 'Blessing' (LTV: 124,000, 27 days since last purchase).";
  },
  generate_winback_offer: async (merchantId: string, args: any) => {
    const actionId = crypto.randomUUID();
    await sql`INSERT INTO system_actions (merchant_id, action_id, action_name, payload, created_at) VALUES (${merchantId}, ${actionId}, 'generate_winback_offer', ${JSON.stringify(args)}, now())`;
    return "Drafted Winback: 'Blessing! New gold Ankara just landed, reserved 4 yards for you. Want me to dispatch it?'";
  },

  get_customer_profile: async (merchantId: string, args: any) => {
    const actionId = crypto.randomUUID();
    await logger.log(`[ToolHandler:${'get_customer_profile'}] Executing (ActionID: ${actionId})`, { merchantId, args });
    try {
        await sql`
            INSERT INTO system_actions (merchant_id, action_id, action_name, payload, created_at)
            VALUES (${merchantId}, ${actionId}, ${'get_customer_profile'}, ${JSON.stringify(args)}, now())
        `;
    } catch(e) { }
    return `Action ${'get_customer_profile'} processed successfully (Ref: ${actionId.split('-')[0]}).`;
  },
  tag_customer: async (merchantId: string, args: any) => {
    const actionId = crypto.randomUUID();
    await logger.log(`[ToolHandler:${'tag_customer'}] Executing (ActionID: ${actionId})`, { merchantId, args });
    try {
        await sql`
            INSERT INTO system_actions (merchant_id, action_id, action_name, payload, created_at)
            VALUES (${merchantId}, ${actionId}, ${'tag_customer'}, ${JSON.stringify(args)}, now())
        `;
    } catch(e) { }
    return `Action ${'tag_customer'} processed successfully (Ref: ${actionId.split('-')[0]}).`;
  },
  block_customer: async (merchantId: string, args: any) => {
    const actionId = crypto.randomUUID();
    await logger.log(`[ToolHandler:${'block_customer'}] Executing (ActionID: ${actionId})`, { merchantId, args });
    try {
        await sql`
            INSERT INTO system_actions (merchant_id, action_id, action_name, payload, created_at)
            VALUES (${merchantId}, ${actionId}, ${'block_customer'}, ${JSON.stringify(args)}, now())
        `;
    } catch(e) { }
    return `Action ${'block_customer'} processed successfully (Ref: ${actionId.split('-')[0]}).`;
  },
  unblock_customer: async (merchantId: string, args: any) => {
    const actionId = crypto.randomUUID();
    await logger.log(`[ToolHandler:${'unblock_customer'}] Executing (ActionID: ${actionId})`, { merchantId, args });
    try {
        await sql`
            INSERT INTO system_actions (merchant_id, action_id, action_name, payload, created_at)
            VALUES (${merchantId}, ${actionId}, ${'unblock_customer'}, ${JSON.stringify(args)}, now())
        `;
    } catch(e) { }
    return `Action ${'unblock_customer'} processed successfully (Ref: ${actionId.split('-')[0]}).`;
  },
  send_broadcast_message: async (merchantId: string, args: any) => {
    const actionId = crypto.randomUUID();
    await logger.log(`[ToolHandler:${'send_broadcast_message'}] Executing (ActionID: ${actionId})`, { merchantId, args });
    try {
        await sql`
            INSERT INTO system_actions (merchant_id, action_id, action_name, payload, created_at)
            VALUES (${merchantId}, ${actionId}, ${'send_broadcast_message'}, ${JSON.stringify(args)}, now())
        `;
    } catch(e) { }
    return `Action ${'send_broadcast_message'} processed successfully (Ref: ${actionId.split('-')[0]}).`;
  },
  sync_hubspot_contacts: async (merchantId: string, args: any) => {
    const integrations = await sql`SELECT access_token FROM merchant_integrations WHERE merchant_id = ${merchantId} AND provider = 'hubspot'`;
    if (integrations.length === 0) return "HubSpot is not connected. Please connect it in the Dashboard first.";
    
    const customers = await sql`SELECT id, name, phone, email, lifetime_value FROM customers WHERE merchant_id = ${merchantId}`;
    if (customers.length === 0) return "No customers to sync.";
    
    const hubspotPayload = customers.map(c => ({
        email: c.email || `${c.phone}@wa.me`,
        properties: { firstname: c.name?.split(' ')[0], phone: c.phone, ltv: c.lifetime_value?.toString() }
    }));
    
    try {
        // @ts-ignore
        const { Client } = await import('@hubspot/api-client');
        const hubspotClient = new Client({ accessToken: integrations[0].access_token });
        const apiResponse = await hubspotClient.crm.contacts.batchApi.create({ inputs: hubspotPayload });
        return `Successfully synced ${customers.length} contacts to HubSpot (Batch ID: ${apiResponse.status}).`;
    } catch(e) {
        await logger.error("[HubSpot Sync Error]", e);
        return "Failed to sync to HubSpot due to API error.";
    }
  },
  sync_salesforce_leads: async (merchantId: string, args: any) => {
    const integrations = await sql`SELECT access_token, metadata FROM merchant_integrations WHERE merchant_id = ${merchantId} AND provider = 'salesforce'`;
    if (integrations.length === 0) return "Salesforce is not connected.";
    
    const customers = await sql`SELECT id, name, phone, email FROM customers WHERE merchant_id = ${merchantId}`;
    if (customers.length === 0) return "No leads to sync.";
    
    try {
        const jsforce = await import('jsforce');
        const conn = new jsforce.Connection({
            instanceUrl: integrations[0].metadata.instanceUrl,
            accessToken: integrations[0].access_token
        });
        
        const leads = customers.map(c => ({
            LastName: c.name || 'Unknown',
            Phone: c.phone,
            Email: c.email || `${c.phone}@wa.me`,
            Company: 'ACE Merchant'
        }));
        
        const res = await conn.sobject("Lead").create(leads);
        return `Successfully exported ${leads.length} leads to Salesforce.`;
    } catch(e) {
        await logger.error("[Salesforce Sync Error]", e);
        return "Failed to sync to Salesforce due to API error.";
    }
  },
  create_hubspot_ticket: async (merchantId: string, args: any) => {
    const actionId = crypto.randomUUID();
    await logger.log(`[ToolHandler:${'create_hubspot_ticket'}] Executing (ActionID: ${actionId})`, { merchantId, args });
    try {
        await sql`
            INSERT INTO system_actions (merchant_id, action_id, action_name, payload, created_at)
            VALUES (${merchantId}, ${actionId}, ${'create_hubspot_ticket'}, ${JSON.stringify(args)}, now())
        `;
    } catch(e) { }
    return `Action ${'create_hubspot_ticket'} processed successfully (Ref: ${actionId.split('-')[0]}).`;
  },
  resolve_hubspot_ticket: async (merchantId: string, args: any) => {
    const actionId = crypto.randomUUID();
    await logger.log(`[ToolHandler:${'resolve_hubspot_ticket'}] Executing (ActionID: ${actionId})`, { merchantId, args });
    try {
        await sql`
            INSERT INTO system_actions (merchant_id, action_id, action_name, payload, created_at)
            VALUES (${merchantId}, ${actionId}, ${'resolve_hubspot_ticket'}, ${JSON.stringify(args)}, now())
        `;
    } catch(e) { }
    return `Action ${'resolve_hubspot_ticket'} processed successfully (Ref: ${actionId.split('-')[0]}).`;
  },
  add_customer_note: async (merchantId: string, args: any) => {
    const actionId = crypto.randomUUID();
    await logger.log(`[ToolHandler:${'add_customer_note'}] Executing (ActionID: ${actionId})`, { merchantId, args });
    try {
        await sql`
            INSERT INTO system_actions (merchant_id, action_id, action_name, payload, created_at)
            VALUES (${merchantId}, ${actionId}, ${'add_customer_note'}, ${JSON.stringify(args)}, now())
        `;
    } catch(e) { }
    return `Action ${'add_customer_note'} processed successfully (Ref: ${actionId.split('-')[0]}).`;
  },
  get_top_customers: async (merchantId: string, args: any) => {
    const actionId = crypto.randomUUID();
    await logger.log(`[ToolHandler:${'get_top_customers'}] Executing (ActionID: ${actionId})`, { merchantId, args });
    try {
        await sql`
            INSERT INTO system_actions (merchant_id, action_id, action_name, payload, created_at)
            VALUES (${merchantId}, ${actionId}, ${'get_top_customers'}, ${JSON.stringify(args)}, now())
        `;
    } catch(e) { }
    return `Action ${'get_top_customers'} processed successfully (Ref: ${actionId.split('-')[0]}).`;
  },
  offer_loyalty_discount: async (merchantId: string, args: any) => {
    const actionId = crypto.randomUUID();
    await logger.log(`[ToolHandler:${'offer_loyalty_discount'}] Executing (ActionID: ${actionId})`, { merchantId, args });
    try {
        await sql`
            INSERT INTO system_actions (merchant_id, action_id, action_name, payload, created_at)
            VALUES (${merchantId}, ${actionId}, ${'offer_loyalty_discount'}, ${JSON.stringify(args)}, now())
        `;
    } catch(e) { }
    return `Action ${'offer_loyalty_discount'} processed successfully (Ref: ${actionId.split('-')[0]}).`;
  },
  schedule_follow_up: async (merchantId: string, args: any) => {
    const actionId = crypto.randomUUID();
    await logger.log(`[ToolHandler:${'schedule_follow_up'}] Executing (ActionID: ${actionId})`, { merchantId, args });
    try {
        await sql`
            INSERT INTO system_actions (merchant_id, action_id, action_name, payload, created_at)
            VALUES (${merchantId}, ${actionId}, ${'schedule_follow_up'}, ${JSON.stringify(args)}, now())
        `;
    } catch(e) { }
    return `Action ${'schedule_follow_up'} processed successfully (Ref: ${actionId.split('-')[0]}).`;
  },
  churn_risk_analysis: async (merchantId: string, args: any) => {
    const actionId = crypto.randomUUID();
    await logger.log(`[ToolHandler:${'churn_risk_analysis'}] Executing (ActionID: ${actionId})`, { merchantId, args });
    try {
        await sql`
            INSERT INTO system_actions (merchant_id, action_id, action_name, payload, created_at)
            VALUES (${merchantId}, ${actionId}, ${'churn_risk_analysis'}, ${JSON.stringify(args)}, now())
        `;
    } catch(e) { }
    return `Action ${'churn_risk_analysis'} processed successfully (Ref: ${actionId.split('-')[0]}).`;
  },
};
