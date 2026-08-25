import { sql, redis } from "@ace/shared/clients";
import { makeThirdPartyRequest } from "./utils.js";
import crypto from "crypto";

export const group3Handlers: Record<string, Function> = {
  view_daily_revenue: async (merchantId: string, args: any) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const result = await sql`
      SELECT COALESCE(SUM(total_amount), 0) as revenue, COUNT(id) as orders
      FROM orders
      WHERE merchant_id = ${merchantId} AND created_at >= ${today} AND status = 'completed'
    `;
    return { success: true, revenue: result[0].revenue, orders: result[0].orders };
  },
  view_weekly_revenue: async (merchantId: string, args: any) => {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const result = await sql`
      SELECT COALESCE(SUM(total_amount), 0) as revenue, COUNT(id) as orders
      FROM orders
      WHERE merchant_id = ${merchantId} AND created_at >= ${weekAgo} AND status = 'completed'
    `;
    return { success: true, revenue: result[0].revenue, orders: result[0].orders };
  },
  check_escrow_balance: async (merchantId: string, args: any) => {
    const result = await sql`
      SELECT balance, currency, last_updated 
      FROM escrow_accounts 
      WHERE merchant_id = ${merchantId}
    `;
    if (!result.length) return { success: false, error: "Escrow account not found" };
    return { success: true, balance: result[0].balance, currency: result[0].currency };
  },
  request_payout: async (merchantId: string, args: { amount: number }) => {
    const { amount } = args;
    const result = await sql`
      UPDATE escrow_accounts 
      SET balance = balance - ${amount} 
      WHERE merchant_id = ${merchantId} AND balance >= ${amount}
      RETURNING balance
    `;
    if (!result.length) return { success: false, error: "Insufficient funds" };
    
    await redis.lpush(`payouts:${merchantId}`, JSON.stringify({ amount, timestamp: new Date(), status: 'pending' }));
    return { success: true, message: \`Payout of \${amount} requested\`, newBalance: result[0].balance };
  },
  verify_bank_transfer: async (merchantId: string, args: { transferId: string }) => {
    const { transferId } = args;
    const result = await sql`
      UPDATE bank_transfers 
      SET status = 'verified', verified_at = NOW() 
      WHERE transfer_id = ${transferId} AND merchant_id = ${merchantId}
      RETURNING amount, order_id
    `;
    if (!result.length) return { success: false, error: "Transfer not found or already verified" };
    await sql`UPDATE orders SET status = 'completed' WHERE id = ${result[0].order_id}`;
    return { success: true, message: "Transfer verified successfully", amount: result[0].amount };
  },
  generate_invoice: async (merchantId: string, args: { customerId: string, items: any[] }) => {
    const { customerId, items } = args;
    const total = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const invoiceId = crypto.randomUUID();
    await sql`
      INSERT INTO invoices (id, merchant_id, customer_id, total, status, created_at)
      VALUES (${invoiceId}, ${merchantId}, ${customerId}, ${total}, 'draft', NOW())
    `;
    await redis.lpush('invoice_pdf_queue', JSON.stringify({ invoiceId, merchantId, customerId, items }));
    return { success: true, invoiceId, message: "Invoice created and PDF generation queued" };
  },
  refund_customer: async (merchantId: string, args: { orderId: string }) => {
    const { orderId } = args;
    const order = await sql`
      SELECT payment_reference, total_amount FROM orders 
      WHERE id = ${orderId} AND merchant_id = ${merchantId}
    `;
    if (!order.length) return { success: false, error: "Order not found" };
    
    const response = await makeThirdPartyRequest('paystack', '/refund', {
      transaction: order[0].payment_reference,
      amount: order[0].total_amount
    });
    
    if (response.status === true) {
      await sql`UPDATE orders SET status = 'refunded' WHERE id = ${orderId}`;
      return { success: true, message: "Refund processed successfully" };
    }
    return { success: false, error: "Failed to process refund with Paystack" };
  },
  log_cash_payment: async (merchantId: string, args: { amount: number, description?: string }) => {
    const { amount, description = "Cash payment" } = args;
    const txId = crypto.randomUUID();
    await sql`
      INSERT INTO cash_transactions (id, merchant_id, amount, description, created_at)
      VALUES (${txId}, ${merchantId}, ${amount}, ${description}, NOW())
    `;
    return { success: true, transactionId: txId, message: "Cash payment logged" };
  },
  set_tax_rate: async (merchantId: string, args: { rate: number }) => {
    const { rate } = args;
    await sql`
      INSERT INTO merchant_settings (merchant_id, tax_rate)
      VALUES (${merchantId}, ${rate})
      ON CONFLICT (merchant_id) DO UPDATE SET tax_rate = EXCLUDED.tax_rate
    `;
    return { success: true, message: \`Tax rate set to \${rate}%\` };
  },
  download_tax_report: async (merchantId: string, args: { month: string }) => {
    const { month } = args;
    const startDate = new Date(\`\${month}-01\`);
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + 1);
    
    const result = await sql`
      SELECT COALESCE(SUM(total_amount), 0) as gross, COALESCE(SUM(tax_amount), 0) as tax
      FROM orders
      WHERE merchant_id = ${merchantId} AND created_at >= ${startDate} AND created_at < ${endDate}
    `;
    const reportId = crypto.randomUUID();
    await redis.setex(\`tax_report:\${reportId}\`, 86400, JSON.stringify(result[0]));
    return { success: true, reportId, data: result[0], message: "Tax report generated" };
  },
  sync_quickbooks_invoices: async (merchantId: string, args: any) => {
    const invoices = await sql`
      SELECT * FROM invoices 
      WHERE merchant_id = ${merchantId} AND status = 'paid' AND synced_to_qb = false
    `;
    const response = await makeThirdPartyRequest('quickbooks', '/sync/invoices', { invoices });
    if (response.success) {
      await sql`UPDATE invoices SET synced_to_qb = true WHERE merchant_id = ${merchantId} AND status = 'paid'`;
      return { success: true, message: \`Synced \${invoices.length} invoices to QuickBooks\` };
    }
    return { success: false, error: "QuickBooks sync failed" };
  },
  sync_xero_transactions: async (merchantId: string, args: any) => {
    const transactions = await sql`
      SELECT * FROM transactions 
      WHERE merchant_id = ${merchantId} AND synced_to_xero = false
    `;
    const response = await makeThirdPartyRequest('xero', '/sync/transactions', { transactions });
    if (response.success) {
      await sql`UPDATE transactions SET synced_to_xero = true WHERE merchant_id = ${merchantId} AND synced_to_xero = false`;
      return { success: true, message: \`Synced \${transactions.length} transactions to Xero\` };
    }
    return { success: false, error: "Xero sync failed" };
  },
  analyze_profit_margins: async (merchantId: string, args: any) => {
    const result = await sql`
      SELECT p.name, 
             AVG(oi.price) as avg_sale_price, 
             AVG(p.cost_price) as cost, 
             (AVG(oi.price) - AVG(p.cost_price)) / NULLIF(AVG(oi.price), 0) * 100 as margin
      FROM order_items oi
      JOIN products p ON p.id = oi.product_id
      JOIN orders o ON o.id = oi.order_id
      WHERE o.merchant_id = ${merchantId}
      GROUP BY p.name
    `;
    return { success: true, margins: result };
  },

  // Marketing Tools
  configure_status_mode: async (merchantId: string, args: { enabled: boolean }) => {
    const { enabled } = args;
    await sql`
      UPDATE marketing_settings 
      SET auto_status_posting = ${enabled} 
      WHERE merchant_id = ${merchantId}
    `;
    return { success: true, message: \`Auto status posting \${enabled ? 'enabled' : 'disabled'}\` };
  },
  post_to_status_now: async (merchantId: string, args: { sku: string }) => {
    const { sku } = args;
    const product = await sql`SELECT * FROM products WHERE merchant_id = ${merchantId} AND sku = ${sku}`;
    if (!product.length) return { success: false, error: "Product not found" };
    
    await redis.rpush('status_post_queue', JSON.stringify({ merchantId, product: product[0], immediate: true }));
    return { success: true, message: \`Product \${sku} queued for immediate status posting\` };
  },
  generate_marketing_copy: async (merchantId: string, args: { sku: string }) => {
    const { sku } = args;
    const product = await sql`SELECT name, description, price FROM products WHERE merchant_id = ${merchantId} AND sku = ${sku}`;
    if (!product.length) return { success: false, error: "Product not found" };
    
    const response = await makeThirdPartyRequest('openai', '/generate/copy', { 
      product: product[0].name, 
      description: product[0].description, 
      price: product[0].price 
    });
    return { success: true, copy: response.copy };
  },
  schedule_status_campaign: async (merchantId: string, args: { skus: string[] }) => {
    const { skus } = args;
    const campaignId = crypto.randomUUID();
    await sql`
      INSERT INTO marketing_campaigns (id, merchant_id, type, target_skus, status)
      VALUES (${campaignId}, ${merchantId}, 'status_week', ${JSON.stringify(skus)}, 'scheduled')
    `;
    await redis.zadd('campaigns_schedule', Date.now(), campaignId);
    return { success: true, campaignId, message: "Status campaign scheduled for the week" };
  },
  analyze_status_views: async (merchantId: string, args: any) => {
    const views = await sql`
      SELECT post_date, view_count, unique_viewers, conversions
      FROM status_analytics
      WHERE merchant_id = ${merchantId} AND post_date >= NOW() - INTERVAL '7 days'
      ORDER BY post_date DESC
    `;
    return { success: true, analytics: views };
  },
  create_flash_sale: async (merchantId: string, args: { percentage: number }) => {
    const { percentage } = args;
    const multiplier = 1 - (percentage / 100);
    
    await sql`
      UPDATE products
      SET sale_price = price * ${multiplier}, on_sale = true
      WHERE merchant_id = ${merchantId}
    `;
    await redis.setex(\`flash_sale:\${merchantId}\`, 86400, "active");
    return { success: true, message: \`Flash sale created with \${percentage}% off\` };
  },
  end_flash_sale: async (merchantId: string, args: any) => {
    await sql`
      UPDATE products
      SET sale_price = NULL, on_sale = false
      WHERE merchant_id = ${merchantId}
    `;
    await redis.del(\`flash_sale:\${merchantId}\`);
    return { success: true, message: "Flash sale ended, prices restored" };
  },
  sync_facebook_catalog: async (merchantId: string, args: any) => {
    const products = await sql`SELECT * FROM products WHERE merchant_id = ${merchantId} AND is_active = true`;
    const response = await makeThirdPartyRequest('facebook', '/catalog/sync', { products });
    if (response.success) {
      await sql`UPDATE marketing_settings SET last_fb_sync = NOW() WHERE merchant_id = ${merchantId}`;
      return { success: true, message: \`Synced \${products.length} products to Facebook Catalog\` };
    }
    return { success: false, error: "Failed to sync Facebook Catalog" };
  },
  sync_instagram_shop: async (merchantId: string, args: any) => {
    const products = await sql`SELECT * FROM products WHERE merchant_id = ${merchantId} AND is_active = true`;
    const response = await makeThirdPartyRequest('instagram', '/shop/sync', { products });
    if (response.success) {
      await sql`UPDATE marketing_settings SET last_ig_sync = NOW() WHERE merchant_id = ${merchantId}`;
      return { success: true, message: \`Synced \${products.length} products to Instagram Shop\` };
    }
    return { success: false, error: "Failed to sync Instagram Shop" };
  },
  run_abandoned_cart_recovery: async (merchantId: string, args: any) => {
    const abandonedCarts = await sql`
      SELECT c.id, c.customer_id, cu.phone_number, c.items
      FROM carts c
      JOIN customers cu ON cu.id = c.customer_id
      WHERE c.merchant_id = ${merchantId} AND c.updated_at < NOW() - INTERVAL '2 hours' AND c.status = 'abandoned'
    `;
    
    for (const cart of abandonedCarts) {
      await redis.lpush('sms_queue', JSON.stringify({
        to: cart.phone_number,
        message: "Hi! You left some items in your cart. Complete your purchase now for 5% off!",
        cartId: cart.id
      }));
    }
    return { success: true, count: abandonedCarts.length, message: "Recovery SMS queued for abandoned carts" };
  }
};
