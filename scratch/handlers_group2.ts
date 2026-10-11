import { sql, redis } from "@ace/shared/clients";
import { makeThirdPartyRequest } from "./utils.js";

export const group2Handlers: Record<string, Function> = {
  get_customer_profile: async (merchantId: string, args: any) => {
    return await sql`SELECT * FROM customers WHERE id = ${args.customerId} AND merchant_id = ${merchantId}`;
  },
  tag_customer: async (merchantId: string, args: any) => {
    return await sql`
      INSERT INTO customer_tags (customer_id, tag, merchant_id) 
      VALUES (${args.customerId}, ${args.tag}, ${merchantId})
      ON CONFLICT DO NOTHING
    `;
  },
  block_customer: async (merchantId: string, args: any) => {
    return await sql`UPDATE customers SET blocked = true WHERE id = ${args.customerId} AND merchant_id = ${merchantId}`;
  },
  unblock_customer: async (merchantId: string, args: any) => {
    return await sql`UPDATE customers SET blocked = false WHERE id = ${args.customerId} AND merchant_id = ${merchantId}`;
  },
  send_broadcast_message: async (merchantId: string, args: { tag?: string, message: string }) => {
    const jobData = { merchantId, tag: args.tag, message: args.message, timestamp: Date.now() };
    await redis.lpush(`broadcast_queue:${merchantId}`, JSON.stringify(jobData));
    return { success: true, status: 'queued' };
  },
  sync_hubspot_contacts: async (merchantId: string, args: any) => {
    const contacts = await sql`SELECT * FROM customers WHERE merchant_id = ${merchantId}`;
    await makeThirdPartyRequest('HubSpot', '/contacts/batch/sync', { contacts });
    return { success: true, count: contacts.length };
  },
  sync_salesforce_leads: async (merchantId: string, args: any) => {
    const leads = await sql`SELECT * FROM customers WHERE merchant_id = ${merchantId} AND is_lead = true`;
    await makeThirdPartyRequest('Salesforce', '/leads/batch/sync', { leads });
    return { success: true, count: leads.length };
  },
  create_hubspot_ticket: async (merchantId: string, args: any) => {
    const res = await makeThirdPartyRequest('HubSpot', '/tickets/create', { 
      customerId: args.customerId, 
      issue: args.issue, 
      merchantId 
    });
    return { success: true, ticketId: res.id };
  },
  resolve_hubspot_ticket: async (merchantId: string, args: any) => {
    await makeThirdPartyRequest('HubSpot', `/tickets/${args.ticketId}/resolve`, { merchantId });
    return { success: true };
  },
  add_customer_note: async (merchantId: string, args: any) => {
    return await sql`
      INSERT INTO customer_notes (customer_id, note, merchant_id, created_at) 
      VALUES (${args.customerId}, ${args.note}, ${merchantId}, NOW())
    `;
  },
  get_top_customers: async (merchantId: string, args: any) => {
    return await sql`
      SELECT customer_id, SUM(total) as ltv 
      FROM orders 
      WHERE merchant_id = ${merchantId} AND status = 'completed'
      GROUP BY customer_id 
      ORDER BY ltv DESC 
      LIMIT 10
    `;
  },
  offer_loyalty_discount: async (merchantId: string, args: any) => {
    await sql`
      INSERT INTO active_promotions (customer_id, merchant_id, discount_percentage, active) 
      VALUES (${args.customerId}, ${merchantId}, ${args.discountPercentage}, true)
    `;
    return { success: true, message: `Discount of ${args.discountPercentage}% applied for loyalty` };
  },
  schedule_follow_up: async (merchantId: string, args: any) => {
    const followUpDate = new Date();
    followUpDate.setDate(followUpDate.getDate() + args.days);
    await redis.setex(`follow_up:${merchantId}:${args.customerId}`, args.days * 86400, followUpDate.toISOString());
    return { success: true, scheduledDate: followUpDate };
  },
  churn_risk_analysis: async (merchantId: string, args: any) => {
    return await sql`
      SELECT customer_id, MAX(created_at) as last_order_date 
      FROM orders 
      WHERE merchant_id = ${merchantId} 
      GROUP BY customer_id 
      HAVING MAX(created_at) < NOW() - INTERVAL '60 days'
    `;
  },
  resolve_escalation: async (merchantId: string, args: any) => {
    await sql`
      INSERT INTO vendor_decisions (merchant_id, customer_id, decision, amount, resolved_at) 
      VALUES (${merchantId}, ${args.customerId}, ${args.decision}, ${args.amount}, NOW())
    `;
    return { success: true };
  },
  set_floor_price: async (merchantId: string, args: any) => {
    await sql`
      UPDATE products 
      SET floor_price = ${args.floorPrice} 
      WHERE sku = ${args.sku} AND merchant_id = ${merchantId}
    `;
    return { success: true };
  },
  override_ai_offer: async (merchantId: string, args: any) => {
    await sql`
      INSERT INTO active_offers (merchant_id, customer_id, override_amount, valid_until) 
      VALUES (${merchantId}, ${args.customerId}, ${args.amount}, NOW() + INTERVAL '24 hours')
    `;
    return { success: true };
  },
  create_discount_code: async (merchantId: string, args: any) => {
    await sql`
      INSERT INTO active_promotions (merchant_id, code, percentage, active, created_at) 
      VALUES (${merchantId}, ${args.code}, ${args.percentage}, true, NOW())
    `;
    return { success: true };
  },
  disable_discount_code: async (merchantId: string, args: any) => {
    await sql`
      UPDATE active_promotions 
      SET active = false 
      WHERE merchant_id = ${merchantId} AND code = ${args.code}
    `;
    return { success: true };
  },
  configure_negotiation_aggressiveness: async (merchantId: string, args: any) => {
    await sql`
      UPDATE merchant_settings 
      SET negotiation_mode = ${args.mode} 
      WHERE merchant_id = ${merchantId}
    `;
    return { success: true };
  },
  enable_bundle_deals: async (merchantId: string, args: any) => {
    await sql`
      UPDATE merchant_settings 
      SET bundle_deals_enabled = ${args.enabled} 
      WHERE merchant_id = ${merchantId}
    `;
    return { success: true };
  },
  review_negotiation_transcripts: async (merchantId: string, args: any) => {
    return await sql`
      SELECT sender, message, created_at 
      FROM negotiation_transcripts 
      WHERE merchant_id = ${merchantId} AND customer_id = ${args.customerId} 
      ORDER BY created_at ASC
    `;
  },
  approve_custom_quote: async (merchantId: string, args: any) => {
    await sql`
      UPDATE quotes 
      SET status = 'approved', updated_at = NOW() 
      WHERE id = ${args.quoteId} AND merchant_id = ${merchantId}
    `;
    return { success: true };
  },
  reject_custom_quote: async (merchantId: string, args: any) => {
    await sql`
      UPDATE quotes 
      SET status = 'rejected', updated_at = NOW() 
      WHERE id = ${args.quoteId} AND merchant_id = ${merchantId}
    `;
    return { success: true };
  }
};
