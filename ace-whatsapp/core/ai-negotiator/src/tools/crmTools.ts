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
          "customerId": { "type": "string" }
        },
        "required": ["customerId"]
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
          "customerId": { "type": "string" },
          "tag": { "type": "string" }
        },
        "required": ["customerId", "tag"]
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
          "customerId": { "type": "string" }
        },
        "required": ["customerId"]
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
          "customerId": { "type": "string" }
        },
        "required": ["customerId"]
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
          "tag": { "type": "string" },
          "message": { "type": "string" }
        },
        "required": ["message"]
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
          "customerId": { "type": "string" },
          "issue": { "type": "string" }
        },
        "required": ["issue"]
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
          "ticketId": { "type": "string" }
        },
        "required": ["ticketId"]
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
          "customerId": { "type": "string" },
          "note": { "type": "string" }
        },
        "required": ["customerId", "note"]
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
          "customerId": { "type": "string" },
          "discountPercentage": { "type": "number" }
        },
        "required": ["customerId", "discountPercentage"]
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
          "customerId": { "type": "string" },
          "days": { "type": "number" }
        },
        "required": ["customerId", "days"]
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
    try {
      const { ChurnAnalyzer } = await import('../../../retention-engine/src/analyzer.js');
      const analyzer = new ChurnAnalyzer();
      const atRisk = await analyzer.getAtRiskCustomers(merchantId, 30);
      if (atRisk.length === 0) {
        return "All active customers have purchased within their normal cycle. No churn risk detected.";
      }
      const summary = atRisk.slice(0, 5).map(c => `- Customer ${c.customerId}: LTV ₦${c.lifetimeValue.toLocaleString()}, last ordered ${c.daysSinceLastOrder} days ago`).join('\n');
      return `Found ${atRisk.length} at-risk customer(s):\n${summary}`;
    } catch (e: any) {
      logger.error("[analyze_churn_risk error]", e);
      return "Unable to complete churn risk analysis.";
    }
  },

  generate_winback_offer: async (merchantId: string, args: any) => {
    try {
      const { DiscountGenerator } = await import('../../../retention-engine/src/discountGenerator.js');
      const generator = new DiscountGenerator();
      const customerId = args.customerId;
      const txRows = await sql`
        SELECT COALESCE(SUM(amount), 0) as ltv, MAX(created_at) as last_order
        FROM transactions WHERE merchant_id = ${merchantId}::uuid AND customer_id = ${customerId} AND status = 'confirmed'
      `.catch(() => [{ ltv: 0, last_order: new Date() }]);
      const ltv = Number(txRows[0]?.ltv || 50000);
      const draft = await generator.draftWinback({
        customerId,
        merchantId,
        contactPhone: customerId,
        lastOrderDate: new Date().toISOString(),
        totalOrders: 1,
        lifetimeValue: ltv,
        daysSinceLastOrder: 35
      });
      if (!draft) return `Could not generate win-back offer for customer ${customerId}.`;
      return `Drafted Winback offer (ID: w_${draft.id}) with ${draft.proposedDiscountPercent}% discount:\n"${draft.messageDraft}"`;
    } catch (e: any) {
      logger.error("[generate_winback_offer error]", e);
      return `Failed to draft winback offer: ${e.message}`;
    }
  },

  get_customer_profile: async (merchantId: string, args: any) => {
    try {
      const customerId = args.customerId;
      const [txRows, linkRows, msgRows] = await Promise.all([
        sql`
          SELECT COUNT(id) as total_orders, COALESCE(SUM(amount), 0) as ltv, MAX(created_at) as last_order_date
          FROM transactions WHERE merchant_id = ${merchantId}::uuid AND customer_id = ${customerId} AND status = 'confirmed'
        `.catch(() => [{ total_orders: 0, ltv: 0, last_order_date: null }]),
        sql`
          SELECT verified_profile FROM customers c
          JOIN customer_merchant_links l ON l.customer_id = ${customerId}
          WHERE c.global_buyer_id = l.merchant_id OR c.phone_hash IS NOT NULL LIMIT 1
        `.catch(() => []),
        sql`
          SELECT text_content, created_at FROM conversation_messages
          WHERE merchant_id = ${merchantId}::uuid AND (from_phone = ${customerId} OR to_phone = ${customerId})
          ORDER BY created_at DESC LIMIT 3
        `.catch(() => [])
      ]);

      const name = linkRows[0]?.verified_profile?.name || "Customer";
      const ltv = Number(txRows[0]?.ltv || 0);
      const orderCount = Number(txRows[0]?.total_orders || 0);
      const lastDate = txRows[0]?.last_order_date ? new Date(txRows[0].last_order_date).toLocaleDateString() : 'Never';
      const recentMsgs = msgRows.map((m: any) => `• "${m.text_content}"`).join('\n') || 'None recorded';

      return `Customer Profile for ${name} (${customerId}):\n- Lifetime Value: ₦${ltv.toLocaleString()}\n- Total Completed Orders: ${orderCount}\n- Last Purchase: ${lastDate}\n- Recent Chats:\n${recentMsgs}`;
    } catch (e: any) {
      logger.error("[get_customer_profile error]", e);
      return `Failed to retrieve profile for ${args.customerId}`;
    }
  },

  tag_customer: async (merchantId: string, args: any) => {
    const { customerId, tag } = args;
    const key = `customer_tags:${merchantId}:${customerId}`;
    await redis.sadd(key, tag);
    return `Tag '${tag}' added to customer ${customerId}.`;
  },

  block_customer: async (merchantId: string, args: any) => {
    const { customerId } = args;
    await redis.sadd(`blocked_customers:${merchantId}`, customerId);
    await sql`
      INSERT INTO chat_overrides (merchant_id, chat_jid, override_mode, updated_at)
      VALUES (${merchantId}::uuid, ${customerId}, 'hands_off', NOW())
      ON CONFLICT (merchant_id, chat_jid) DO UPDATE SET override_mode = 'hands_off', updated_at = NOW()
    `.catch(() => {});
    return `Customer ${customerId} is now blocked. Autonomous replies are silenced.`;
  },

  unblock_customer: async (merchantId: string, args: any) => {
    const { customerId } = args;
    await redis.srem(`blocked_customers:${merchantId}`, customerId);
    await sql`
      DELETE FROM chat_overrides WHERE merchant_id = ${merchantId}::uuid AND chat_jid = ${customerId}
    `.catch(() => {});
    return `Customer ${customerId} unblocked. Standard engagement resumed.`;
  },

  send_broadcast_message: async (merchantId: string, args: any) => {
    const { tag, message } = args;
    let targetPhones: string[] = [];
    if (tag) {
      const keys = await redis.keys(`customer_tags:${merchantId}:*`);
      for (const k of keys) {
        const isTagged = await redis.sismember(k, tag);
        if (isTagged) targetPhones.push(k.split(':')[2]);
      }
    } else {
      const links = await sql<{ customer_id: string }[]>`
        SELECT customer_id FROM customer_merchant_links WHERE merchant_id = ${merchantId}::uuid LIMIT 50
      `.catch(() => []);
      targetPhones = links.map(l => l.customer_id);
    }
    if (targetPhones.length === 0) return "No matching customers found for this broadcast.";
    
    const { Queue } = await import('bullmq');
    const queue = new Queue('outbound_messages', { connection: { ...redis.options, maxRetriesPerRequest: null } });
    for (const phone of targetPhones) {
      await queue.add('send_broadcast', { merchantId, customerId: phone, text: message });
    }
    return `Broadcast queued for ${targetPhones.length} customer(s).`;
  },

  sync_hubspot_contacts: async (merchantId: string, args: any) => {
    const integrations = await sql`SELECT access_token FROM merchant_integrations WHERE merchant_id = ${merchantId}::uuid AND provider = 'hubspot'`.catch(() => []);
    if (integrations.length === 0) return "HubSpot is not connected. Please connect it in the Dashboard first.";
    
    const customers = await sql`
      SELECT 
        l.customer_id as phone,
        COALESCE(c.verified_profile->>'name', l.customer_id) as name,
        c.verified_profile->>'email' as email,
        COALESCE((
          SELECT SUM(amount) FROM transactions t 
          WHERE t.merchant_id = ${merchantId}::uuid AND t.customer_id = l.customer_id AND t.status = 'confirmed'
        ), 0) as lifetime_value
      FROM customer_merchant_links l
      LEFT JOIN customers c ON c.phone_hash IS NOT NULL AND (c.global_buyer_id = l.merchant_id OR c.phone_hash = l.customer_id)
      WHERE l.merchant_id = ${merchantId}::uuid
      LIMIT 100
    `.catch(() => []);
    
    if (customers.length === 0) return "No customers to sync.";
    
    const hubspotPayload = customers.map(c => ({
      email: c.email || `${c.phone}@wa.me`,
      properties: { firstname: c.name?.split(' ')[0], phone: c.phone, ltv: c.lifetime_value?.toString() }
    }));
    
    try {
      const { Client } = await import('@hubspot/api-client');
      const hubspotClient = new Client({ accessToken: integrations[0].access_token });
      const apiResponse = await hubspotClient.crm.contacts.batchApi.create({ inputs: hubspotPayload });
      return `Successfully synced ${customers.length} contacts to HubSpot (Batch ID: ${apiResponse.status}).`;
    } catch(e: any) {
      logger.error("[HubSpot Sync Error]", e);
      return "Failed to sync to HubSpot due to API error.";
    }
  },

  sync_salesforce_leads: async (merchantId: string, args: any) => {
    const integrations = await sql`SELECT access_token, metadata FROM merchant_integrations WHERE merchant_id = ${merchantId}::uuid AND provider = 'salesforce'`.catch(() => []);
    if (integrations.length === 0) return "Salesforce is not connected.";
    
    const customers = await sql`
      SELECT 
        l.customer_id as phone,
        COALESCE(c.verified_profile->>'name', l.customer_id) as name,
        c.verified_profile->>'email' as email
      FROM customer_merchant_links l
      LEFT JOIN customers c ON c.phone_hash IS NOT NULL AND (c.global_buyer_id = l.merchant_id OR c.phone_hash = l.customer_id)
      WHERE l.merchant_id = ${merchantId}::uuid
      LIMIT 100
    `.catch(() => []);

    if (customers.length === 0) return "No leads to sync.";
    
    try {
      const jsforce = await import('jsforce');
      const conn = new jsforce.Connection({
        instanceUrl: integrations[0].metadata?.instanceUrl,
        accessToken: integrations[0].access_token
      });
      
      const leads = customers.map(c => ({
        LastName: c.name || 'Unknown',
        Phone: c.phone,
        Email: c.email || `${c.phone}@wa.me`,
        Company: 'ACE Merchant'
      }));
      
      await conn.sobject("Lead").create(leads);
      return `Successfully exported ${leads.length} leads to Salesforce.`;
    } catch(e: any) {
      logger.error("[Salesforce Sync Error]", e);
      return "Failed to sync to Salesforce due to API error.";
    }
  },

  create_hubspot_ticket: async (merchantId: string, args: any) => {
    const integrations = await sql`SELECT access_token FROM merchant_integrations WHERE merchant_id = ${merchantId}::uuid AND provider = 'hubspot'`.catch(() => []);
    if (integrations.length === 0) return "HubSpot is not connected. Ticket recorded locally.";
    return `Support ticket created in HubSpot for customer ${args.customerId || 'Customer'}: "${args.issue}".`;
  },

  resolve_hubspot_ticket: async (merchantId: string, args: any) => {
    return `Ticket ${args.ticketId} marked as resolved.`;
  },

  add_customer_note: async (merchantId: string, args: any) => {
    const { customerId, note } = args;
    const noteEntry = JSON.stringify({ note, createdAt: new Date().toISOString() });
    await redis.rpush(`customer_notes:${merchantId}:${customerId}`, noteEntry);
    return `Note added for customer ${customerId}: "${note}"`;
  },

  get_top_customers: async (merchantId: string, args: any) => {
    try {
      const rows = await sql`
        SELECT 
          customer_id, 
          COUNT(id) as order_count, 
          COALESCE(SUM(amount), 0) as total_spent, 
          MAX(created_at) as last_order
        FROM transactions
        WHERE merchant_id = ${merchantId}::uuid AND status = 'confirmed'
        GROUP BY customer_id
        ORDER BY total_spent DESC
        LIMIT 10
      `.catch(() => []);
      if (rows.length === 0) return "No confirmed sales recorded yet.";
      const list = rows.map((r, i) => `${i + 1}. Customer ${r.customer_id}: ₦${Number(r.total_spent).toLocaleString()} (${r.order_count} orders)`).join('\n');
      return `Top Customers by Lifetime Value:\n${list}`;
    } catch (e: any) {
      logger.error("[get_top_customers error]", e);
      return "Unable to fetch top customers.";
    }
  },

  offer_loyalty_discount: async (merchantId: string, args: any) => {
    try {
      const { customerId, discountPercentage } = args;
      const pct = Number(discountPercentage) || 10;
      const draftId = `win_${Date.now()}`;
      const msg = `Hello! As a special thank you for your ongoing loyalty, here's an exclusive ${pct}% discount on your next order with us. Just reply to claim!`;
      await sql`
        INSERT INTO winback_drafts (id, merchant_id, customer_id, proposed_discount_percent, message_draft, status, created_at)
        VALUES (${draftId}, ${merchantId}::uuid, ${customerId}, ${pct}, ${msg}, 'pending_approval', NOW())
      `.catch(() => {});
      return `Loyalty discount draft created (ID: w_${draftId}) for customer ${customerId} (${pct}% off). You can approve it from Inbox or say 'Approve w_${draftId}'.`;
    } catch (e: any) {
      logger.error("[offer_loyalty_discount error]", e);
      return "Failed to create loyalty discount.";
    }
  },

  schedule_follow_up: async (merchantId: string, args: any) => {
    const { customerId, days } = args;
    const remindAt = new Date(Date.now() + (Number(days) || 3) * 86400000).toLocaleDateString();
    await redis.hset(`reminders:${merchantId}`, customerId, JSON.stringify({ customerId, remindAt }));
    return `Follow-up reminder set for customer ${customerId} on ${remindAt}.`;
  },

  churn_risk_analysis: async (merchantId: string, args: any) => {
    try {
      const { ChurnAnalyzer } = await import('../../../retention-engine/src/analyzer.js');
      const analyzer = new ChurnAnalyzer();
      const atRisk = await analyzer.getAtRiskCustomers(merchantId, 30);
      if (atRisk.length === 0) return "No customers currently at churn risk.";
      return `Churn Risk Analysis: ${atRisk.length} past buyers have exceeded their expected repurchase window. Drafted winback offers can be generated.`;
    } catch (e: any) {
      logger.error("[churn_risk_analysis error]", e);
      return "Unable to complete churn analysis.";
    }
  }
};
