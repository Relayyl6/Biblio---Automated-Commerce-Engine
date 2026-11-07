import { sql } from '@ace/shared/clients.js';
import { AtRiskCustomer } from './types.js';
import { logger } from '@ace/shared/logger.js';

export class ChurnAnalyzer {
  async getAtRiskCustomers(merchantId?: string, daysThreshold: number = 30): Promise<AtRiskCustomer[]> {
    try {
      const isUuid = merchantId ? /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(merchantId) : false;
      if (merchantId && !isUuid) {
        return [];
      }

      const rows = await sql<any[]>`
        SELECT 
          cml.customer_id, 
          cml.merchant_id, 
          cml.customer_id as contact_phone,
          MAX(t.created_at) as last_order_date,
          COUNT(t.id) as total_orders,
          COALESCE(SUM(t.amount), 0) as lifetime_value,
          FLOOR(EXTRACT(EPOCH FROM (NOW() - MAX(t.created_at))) / 86400) as days_since_last_order
        FROM customer_merchant_links cml
        JOIN transactions t ON t.customer_id = cml.customer_id AND t.merchant_id = cml.merchant_id
        WHERE t.status = 'confirmed'
          ${merchantId ? sql`AND cml.merchant_id = ${merchantId}::uuid` : sql``}
        GROUP BY cml.customer_id, cml.merchant_id
        HAVING MAX(t.created_at) <= NOW() - (${daysThreshold} || ' days')::interval
           AND COUNT(t.id) >= 1
      `;

      return rows.map(r => ({
        customerId: r.customer_id,
        merchantId: r.merchant_id,
        contactPhone: r.contact_phone,
        lastOrderDate: r.last_order_date,
        totalOrders: parseInt(r.total_orders, 10),
        lifetimeValue: parseFloat(r.lifetime_value),
        daysSinceLastOrder: parseInt(r.days_since_last_order, 10)
      }));
    } catch (err) {
      logger.error('Failed to run churn analysis', { err, merchantId });
      return [];
    }
  }
}
