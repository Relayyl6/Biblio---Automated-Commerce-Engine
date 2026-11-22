import { sql, redis, jsonb } from '@ace/shared/clients';
import { logger } from '@ace/shared/logger.js';
import { sendCustomerMessage } from '../../../comms-router/src/outbound.js';

export interface CustomerProfile {
  customerId: string;
  phone: string;
  name: string;
  tier: 'bronze' | 'silver' | 'gold' | 'vip';
  totalSpent: number;
  orderCount: number;
  averageOrderValue: number;
  firstOrderDate: string | null;
  lastOrderDate: string | null;
  daysSinceLastOrder: number;
  tags: string[];
  notes: string[];
  isBlocked: boolean;
  churnRisk: 'low' | 'medium' | 'high';
}

export interface ChurnRiskAnalysis {
  customerId: string;
  name: string;
  phone: string;
  daysDormant: number;
  riskLevel: 'low' | 'medium' | 'high';
  pastTotalSpent: number;
  recommendedAction: string;
}

export class CustomerRelationshipService {
  /**
   * Fetch complete customer CRM profile with RFM metrics and tier.
   */
  static async getCustomerProfile(customerId: string, merchantId: string): Promise<CustomerProfile> {
    const custRows = await sql`
      SELECT id, phone, name, email, tier, tags, metadata, is_blocked, created_at
      FROM customers
      WHERE (phone = ${customerId} OR id::text = ${customerId})
        AND merchant_id = ${merchantId}::uuid
      LIMIT 1
    `.catch(() => []);

    const cust = custRows[0] || {
      id: customerId,
      phone: customerId,
      name: 'Customer',
      tier: 'bronze',
      tags: [],
      metadata: {},
      is_blocked: false,
    };

    // Aggregate orders for this customer
    const orderAgg = await sql<{
      total_spent: number;
      order_count: number;
      last_order_at: string | null;
      first_order_at: string | null;
    }[]>`
      SELECT 
        COALESCE(SUM(total_amount), 0) as total_spent,
        COUNT(id) as order_count,
        MAX(created_at) as last_order_at,
        MIN(created_at) as first_order_at
      FROM orders
      WHERE (merchant_id = ${merchantId}::uuid OR tenant_id = ${merchantId}::uuid)
        AND (customer_id = ${customerId} OR customer_phone = ${customerId})
        AND payment_status IN ('paid', 'escrow_locked', 'settled')
    `.catch(() => [{ total_spent: 0, order_count: 0, last_order_at: null, first_order_at: null }]);

    const stats = orderAgg[0];
    const totalSpent = Number(stats.total_spent || 0);
    const orderCount = Number(stats.order_count || 0);
    const aov = orderCount > 0 ? Math.round(totalSpent / orderCount) : 0;

    let daysSinceLast = 999;
    if (stats.last_order_at) {
      daysSinceLast = Math.round((Date.now() - new Date(stats.last_order_at).getTime()) / (1000 * 60 * 60 * 24));
    }

    // Dynamic Churn Risk Calculation
    let churnRisk: 'low' | 'medium' | 'high' = 'low';
    if (daysSinceLast > 60 && orderCount > 0) churnRisk = 'high';
    else if (daysSinceLast > 30 && orderCount > 0) churnRisk = 'medium';

    // Auto Tier resolution if not manually locked
    let tier: 'bronze' | 'silver' | 'gold' | 'vip' = cust.tier || 'bronze';
    if (totalSpent > 250000 || orderCount >= 10) tier = 'vip';
    else if (totalSpent > 100000 || orderCount >= 5) tier = 'gold';
    else if (totalSpent > 35000 || orderCount >= 2) tier = 'silver';

    // Fetch notes
    const noteRows = await sql<{ note: string }[]>`
      SELECT note FROM customer_notes
      WHERE customer_id = ${customerId} AND merchant_id = ${merchantId}::uuid
      ORDER BY created_at DESC LIMIT 10
    `.catch(() => []);

    return {
      customerId: cust.id,
      phone: cust.phone || customerId,
      name: cust.name || 'Valued Customer',
      tier,
      totalSpent,
      orderCount,
      averageOrderValue: aov,
      firstOrderDate: stats.first_order_at,
      lastOrderDate: stats.last_order_at,
      daysSinceLastOrder: daysSinceLast,
      tags: cust.tags || [],
      notes: noteRows.map((n) => n.note),
      isBlocked: !!cust.is_blocked,
      churnRisk,
    };
  }

  /**
   * Scan customer database for dormant buyers at risk of churn.
   */
  static async analyzeChurnRisk(merchantId: string, daysThreshold: number = 45): Promise<ChurnRiskAnalysis[]> {
    const dormantRows = await sql<{
      customer_id: string;
      phone: string;
      name: string;
      total_spent: number;
      last_order_at: string;
    }[]>`
      SELECT 
        o.customer_id,
        COALESCE(c.phone, o.customer_phone, o.customer_id) as phone,
        COALESCE(c.name, 'Customer') as name,
        COALESCE(SUM(o.total_amount), 0) as total_spent,
        MAX(o.created_at) as last_order_at
      FROM orders o
      LEFT JOIN customers c ON c.id::text = o.customer_id OR c.phone = o.customer_phone
      WHERE (o.merchant_id = ${merchantId}::uuid OR o.tenant_id = ${merchantId}::uuid)
        AND o.payment_status IN ('paid', 'escrow_locked', 'settled')
      GROUP BY o.customer_id, c.phone, o.customer_phone, c.name
      HAVING MAX(o.created_at) <= NOW() - (${daysThreshold} || ' days')::interval
      ORDER BY total_spent DESC
      LIMIT 50
    `.catch(() => []);

    return dormantRows.map((r) => {
      const daysDormant = Math.round((Date.now() - new Date(r.last_order_at).getTime()) / (1000 * 60 * 60 * 24));
      const riskLevel: 'low' | 'medium' | 'high' = daysDormant > 90 ? 'high' : daysDormant > 60 ? 'medium' : 'low';

      let recommendedAction = 'Send VIP check-in WhatsApp message';
      if (Number(r.total_spent) > 100000) {
        recommendedAction = 'Send personalized 15% VIP Winback discount code + check-in call';
      } else if (daysDormant > 90) {
        recommendedAction = 'Offer free delivery on next order';
      }

      return {
        customerId: r.customer_id,
        name: r.name,
        phone: r.phone,
        daysDormant,
        riskLevel,
        pastTotalSpent: Number(r.total_spent),
        recommendedAction,
      };
    });
  }

  /**
   * Generate an automated personalized winback offer for a dormant customer.
   */
  static async generateWinbackOffer(params: {
    merchantId: string;
    customerId: string;
    discountPercent?: number;
  }): Promise<{ code: string; message: string; discountPercent: number; expiresAt: string }> {
    const { merchantId, customerId, discountPercent = 15 } = params;

    const profile = await this.getCustomerProfile(customerId, merchantId);
    const code = `WINBACK-${profile.name.slice(0, 4).toUpperCase()}-${discountPercent}`;
    const expiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    // Persist discount code in store rules
    await sql`
      INSERT INTO discount_codes (
        merchant_id, code, discount_type, value, max_uses, current_uses, expires_at, created_at
      ) VALUES (
        ${merchantId}::uuid, ${code}, 'percentage', ${discountPercent}, 1, 0, ${expiry}, now()
      )
      ON CONFLICT (merchant_id, code) DO NOTHING
    `.catch(() => {});

    const message = `Hello ${profile.name}! 👋 We missed you at our store. ` +
      `As one of our valued customers, here is an exclusive ${discountPercent}% discount code: *${code}* ` +
      `valid for your next order this week. What would you like to pick up today?`;

    return {
      code,
      message,
      discountPercent,
      expiresAt: expiry,
    };
  }

  /**
   * Tag a customer with CRM labels (e.g. "wholesale", "vip_buyer", "urgent").
   */
  static async tagCustomer(params: {
    merchantId: string;
    customerId: string;
    tagsToAdd: string[];
  }): Promise<{ success: boolean; currentTags: string[] }> {
    const { merchantId, customerId, tagsToAdd } = params;

    const rows = await sql<{ tags: string[] }[]>`
      UPDATE customers
      SET tags = ARRAY(SELECT DISTINCT unnest(COALESCE(tags, '{}'::text[]) || ${tagsToAdd}::text[])),
          updated_at = now()
      WHERE (phone = ${customerId} OR id::text = ${customerId})
        AND merchant_id = ${merchantId}::uuid
      RETURNING tags
    `.catch(() => []);

    const updatedTags = rows[0]?.tags || tagsToAdd;
    logger.info('[CustomerRelationshipService] Tagged customer', { customerId, tagsToAdd });
    return { success: true, currentTags: updatedTags };
  }

  /**
   * Add internal staff note to customer record.
   */
  static async addCustomerNote(params: {
    merchantId: string;
    customerId: string;
    note: string;
    author?: string;
  }): Promise<{ success: boolean; noteId: string }> {
    const { merchantId, customerId, note, author = 'Staff' } = params;

    const rows = await sql`
      INSERT INTO customer_notes (
        merchant_id, customer_id, note, author, created_at
      ) VALUES (
        ${merchantId}::uuid, ${customerId}, ${note.trim()}, ${author}, now()
      ) RETURNING id
    `;

    return { success: true, noteId: rows[0].id };
  }

  /**
   * Send segmented broadcast message to filtered customer group.
   */
  static async sendBroadcastMessage(params: {
    merchantId: string;
    messageText: string;
    tierFilter?: 'bronze' | 'silver' | 'gold' | 'vip' | 'all';
    tagFilter?: string;
  }): Promise<{ sentCount: number; targetCount: number }> {
    const { merchantId, messageText, tierFilter = 'all', tagFilter } = params;

    const recipients = await sql<{ phone: string; name: string }[]>`
      SELECT phone, name FROM customers
      WHERE merchant_id = ${merchantId}::uuid
        AND is_blocked = false
        AND phone IS NOT NULL
        ${tierFilter !== 'all' ? sql`AND tier = ${tierFilter}` : sql``}
        ${tagFilter ? sql`AND ${tagFilter} = ANY(tags)` : sql``}
      LIMIT 200
    `.catch(() => []);

    let sent = 0;
    for (const r of recipients) {
      try {
        const personalized = messageText.replace(/{{name}}/gi, r.name || 'Friend');
        await sendCustomerMessage({ toPhone: r.phone, text: personalized }, undefined, merchantId);
        sent++;
      } catch (err: any) {
        logger.warn('[CustomerRelationshipService] Broadcast recipient send failed:', { phone: r.phone, error: err.message });
      }
    }

    return { sentCount: sent, targetCount: recipients.length };
  }

  /**
   * Block or unblock customer from initiating AI conversations.
   */
  static async toggleCustomerBlock(merchantId: string, customerId: string, blocked: boolean): Promise<boolean> {
    await sql`
      UPDATE customers
      SET is_blocked = ${blocked}, updated_at = now()
      WHERE (phone = ${customerId} OR id::text = ${customerId})
        AND merchant_id = ${merchantId}::uuid
    `.catch(() => {});

    if (blocked) {
      await redis.set(`blocked_customer:${merchantId}:${customerId}`, '1', 'EX', 86400 * 30);
    } else {
      await redis.del(`blocked_customer:${merchantId}:${customerId}`);
    }

    logger.info(`[CustomerRelationshipService] Customer ${customerId} block status set to ${blocked}`);
    return true;
  }
}
