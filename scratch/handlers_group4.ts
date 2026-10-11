import { sql, redis } from "@ace/shared/clients";
import { makeThirdPartyRequest } from "./utils.js";

export const group4Handlers: Record<string, Function> = {
  // Analytics Tools
  query_audit_logs: async (merchantId: string, args: { query: string }) => {
    const logs = await sql`
      SELECT * FROM audit_logs 
      WHERE merchant_id = ${merchantId} 
        AND message ILIKE ${'%' + args.query + '%'} 
      ORDER BY created_at DESC 
      LIMIT 100
    `;
    return { success: true, logs };
  },
  generate_sales_forecast: async (merchantId: string, args: any) => {
    const historicalData = await sql`
      SELECT DATE_TRUNC('month', created_at) as month, SUM(total) as revenue 
      FROM orders 
      WHERE merchant_id = ${merchantId} AND status = 'completed'
      GROUP BY month 
      ORDER BY month DESC 
      LIMIT 12
    `;
    const response = await makeThirdPartyRequest("AI_FORECAST", "/api/v1/predict", { data: historicalData });
    return { success: true, forecast: response };
  },
  analyze_peak_hours: async (merchantId: string, args: any) => {
    const peakHours = await sql`
      SELECT EXTRACT(HOUR FROM created_at) as hour, COUNT(*) as message_count 
      FROM messages 
      WHERE merchant_id = ${merchantId} 
      GROUP BY hour 
      ORDER BY message_count DESC 
      LIMIT 5
    `;
    return { success: true, peakHours };
  },
  analyze_popular_products: async (merchantId: string, args: any) => {
    const products = await sql`
      SELECT product_id, COUNT(*) as view_count 
      FROM product_views 
      WHERE merchant_id = ${merchantId} 
      GROUP BY product_id 
      ORDER BY view_count DESC 
      LIMIT 10
    `;
    return { success: true, popularProducts: products };
  },
  get_competitor_pricing: async (merchantId: string, args: { sku: string }) => {
    const response = await makeThirdPartyRequest("COMPETITOR_API", "/prices", { sku: args.sku });
    return { success: true, averagePrice: response.averagePrice, lowestPrice: response.lowestPrice };
  },
  export_sales_data: async (merchantId: string, args: any) => {
    const jobId = `export_sales_${merchantId}_${Date.now()}`;
    await redis.set(`job_status:${jobId}`, "pending");
    await redis.lpush("export_jobs_queue", JSON.stringify({ merchantId, jobId, type: 'sales_data' }));
    return { success: true, message: "Export started successfully in the background", jobId };
  },
  generate_business_health_score: async (merchantId: string, args: any) => {
    const revenueResult = await sql`
      SELECT SUM(total) as sum 
      FROM orders 
      WHERE merchant_id = ${merchantId} AND created_at > NOW() - INTERVAL '30 days'
    `;
    const score = (revenueResult[0]?.sum || 0) > 10000 ? 90 : 70;
    return { success: true, healthScore: score, recommendations: ["Review pricing strategy"] };
  },
  customer_sentiment_analysis: async (merchantId: string, args: any) => {
    const recentMessages = await sql`
      SELECT content 
      FROM messages 
      WHERE merchant_id = ${merchantId} AND direction = 'inbound'
      ORDER BY created_at DESC 
      LIMIT 100
    `;
    const texts = recentMessages.map(m => m.content);
    const sentiment = await makeThirdPartyRequest("AI_SENTIMENT", "/analyze", { texts });
    return { success: true, overallSentiment: sentiment.score, sentimentLabel: sentiment.label };
  },
  inventory_turnover_rate: async (merchantId: string, args: any) => {
    const rate = await sql`
      SELECT p.id, p.name, (COALESCE(SUM(oi.quantity), 0) / NULLIF(p.stock, 0)) as turnover_rate
      FROM products p
      LEFT JOIN order_items oi ON p.id = oi.product_id
      WHERE p.merchant_id = ${merchantId}
      GROUP BY p.id, p.name, p.stock
      ORDER BY turnover_rate DESC NULLS LAST
    `;
    return { success: true, turnoverRates: rate };
  },
  
  // Settings Tools
  update_store_hours: async (merchantId: string, args: { open: string; close: string }) => {
    const result = await sql`
      UPDATE merchants 
      SET settings = jsonb_set(settings, '{storeHours}', ${JSON.stringify({ open: args.open, close: args.close })}::jsonb) 
      WHERE id = ${merchantId} 
      RETURNING settings
    `;
    return { success: true, updatedSettings: result[0].settings };
  },
  update_welcome_message: async (merchantId: string, args: { message: string }) => {
    const result = await sql`
      UPDATE merchants 
      SET settings = jsonb_set(settings, '{welcomeMessage}', ${JSON.stringify(args.message)}::jsonb) 
      WHERE id = ${merchantId} 
      RETURNING settings
    `;
    return { success: true, updatedSettings: result[0].settings };
  },
  update_store_policy: async (merchantId: string, args: { policy: string }) => {
    const result = await sql`
      UPDATE merchants 
      SET settings = jsonb_set(settings, '{storePolicy}', ${JSON.stringify(args.policy)}::jsonb) 
      WHERE id = ${merchantId} 
      RETURNING settings
    `;
    return { success: true, updatedSettings: result[0].settings };
  },
  set_store_language: async (merchantId: string, args: { language: string }) => {
    const result = await sql`
      UPDATE merchants 
      SET settings = jsonb_set(settings, '{language}', ${JSON.stringify(args.language)}::jsonb) 
      WHERE id = ${merchantId} 
      RETURNING settings
    `;
    return { success: true, updatedSettings: result[0].settings };
  },
  toggle_vacation_mode: async (merchantId: string, args: { enabled: boolean }) => {
    const result = await sql`
      UPDATE merchants 
      SET settings = jsonb_set(settings, '{vacationMode}', ${JSON.stringify(args.enabled)}::jsonb) 
      WHERE id = ${merchantId} 
      RETURNING settings
    `;
    return { success: true, updatedSettings: result[0].settings };
  },
  add_staff_member: async (merchantId: string, args: { phone: string }) => {
    const result = await sql`
      INSERT INTO staff (merchant_id, phone, permissions) 
      VALUES (${merchantId}, ${args.phone}, '["read", "write"]'::jsonb) 
      RETURNING *
    `;
    return { success: true, staff: result[0] };
  },
  remove_staff_member: async (merchantId: string, args: { phone: string }) => {
    const result = await sql`
      DELETE FROM staff 
      WHERE merchant_id = ${merchantId} AND phone = ${args.phone} 
      RETURNING *
    `;
    return { success: true, removed: result.length > 0 };
  },
  set_staff_permissions: async (merchantId: string, args: { phone: string, permissions: string[] }) => {
    const result = await sql`
      UPDATE staff 
      SET permissions = ${JSON.stringify(args.permissions)}::jsonb 
      WHERE merchant_id = ${merchantId} AND phone = ${args.phone} 
      RETURNING *
    `;
    return { success: true, staff: result[0] };
  },
  update_business_address: async (merchantId: string, args: { address: string }) => {
    const result = await sql`
      UPDATE merchants 
      SET settings = jsonb_set(settings, '{address}', ${JSON.stringify(args.address)}::jsonb) 
      WHERE id = ${merchantId} 
      RETURNING settings
    `;
    return { success: true, updatedSettings: result[0].settings };
  },
  link_social_accounts: async (merchantId: string, args: { platform: string, handle: string }) => {
    const result = await sql`
      UPDATE merchants 
      SET settings = jsonb_set(settings, array['socials', ${args.platform}], ${JSON.stringify(args.handle)}::jsonb, true) 
      WHERE id = ${merchantId} 
      RETURNING settings
    `;
    return { success: true, updatedSettings: result[0].settings };
  }
};
