import { sql } from '@ace/shared/clients.js';
import { AtRiskCustomer } from './types.js';
import { logger } from '@ace/shared/logger.js';

export class ChurnAnalyzer {
  async getAtRiskCustomers(merchantId?: string, daysThreshold: number = 30): Promise<AtRiskCustomer[]> {
    try {
      const rows = await sql<any[]>`
        SELECT 
          cml.customer_id, 
          cml.merchant_id, 
          c.phone as contact_phone,
          MAX(o.created_at) as last_order_date,
          COUNT(o.id) as total_orders,
          SUM(o.total_amount) as lifetime_value,
          EXTRACT(DAY FROM (NOW() - MAX(o.created_at))) as days_since_last_order
        FROM customer_merchant_links cml
        JOIN customers c ON cml.customer_id = c.id
        JOIN orders o ON o.customer_id = cml.customer_id AND o.merchant_id = cml.merchant_id
        WHERE o.status IN ('paid', 'delivered')
          ${merchantId ? sql`AND cml.merchant_id = ${merchantId}` : sql``}
        GROUP BY cml.customer_id, cml.merchant_id, c.phone
        HAVING EXTRACT(DAY FROM (NOW() - MAX(o.created_at))) >= ${daysThreshold}
           AND COUNT(o.id) > 1
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
