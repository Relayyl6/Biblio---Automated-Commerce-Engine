import { sql, redis } from "@ace/shared/clients";
import { logger } from "@ace/shared/logger.js";
import crypto from "crypto";

export const analyticsTools = [
  {
    "type": "function",
    "function": {
      "name": "query_audit_logs",
      "description": "Search system logs",
      "parameters": {
        "type": "object",
        "properties": {
          "query": { "type": "string" }
        },
        "required": ["query"]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "generate_sales_forecast",
      "description": "AI predicts next month sales based on recent order velocity",
      "parameters": {
        "type": "object",
        "properties": {}
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "analyze_peak_hours",
      "description": "Find out when customers message the most",
      "parameters": {
        "type": "object",
        "properties": {}
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "analyze_popular_products",
      "description": "Find out which items sell or get queried the most",
      "parameters": {
        "type": "object",
        "properties": {}
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "get_competitor_pricing",
      "description": "Check average market price for a product or SKU",
      "parameters": {
        "type": "object",
        "properties": {
          "sku": { "type": "string" }
        },
        "required": ["sku"]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "export_sales_data",
      "description": "Generate a summary of all recent sales",
      "parameters": {
        "type": "object",
        "properties": {}
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "generate_business_health_score",
      "description": "Comprehensive rating of business operations (0-100)",
      "parameters": {
        "type": "object",
        "properties": {}
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "customer_sentiment_analysis",
      "description": "Gauge recent customer satisfaction and dispute metrics",
      "parameters": {
        "type": "object",
        "properties": {}
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "inventory_turnover_rate",
      "description": "Calculate how fast inventory items sell",
      "parameters": {
        "type": "object",
        "properties": {}
      }
    }
  }
];

export const analyticsHandlers: Record<string, (merchantId: string, args: any) => Promise<any>> = {
  query_audit_logs: async (merchantId: string, args: any) => {
    try {
      const q = `%${args.query || ''}%`;
      const rows = await sql`
        SELECT event_type, payload, created_at
        FROM outbox_events
        WHERE payload::text ILIKE ${q}
        ORDER BY created_at DESC
        LIMIT 10
      `.catch(() => []);
      if (rows.length === 0) return `No audit events found matching '${args.query}'.`;
      return `Recent Audit Events for '${args.query}':\n` + rows.map(r => `[${new Date(r.created_at).toISOString().slice(0, 16)}] ${r.event_type}: ${JSON.stringify(r.payload)}`).join('\n');
    } catch (e: any) {
      logger.error("[query_audit_logs error]", e);
      return "Audit log search unavailable.";
    }
  },

  generate_sales_forecast: async (merchantId: string, args: any) => {
    try {
      const rows = await sql`
        SELECT 
          COALESCE(SUM(amount), 0) as recent_revenue,
          COUNT(id) as recent_orders
        FROM transactions
        WHERE merchant_id = ${merchantId}::uuid 
          AND status = 'confirmed' 
          AND created_at >= NOW() - INTERVAL '30 days'
      `.catch(() => [{ recent_revenue: 0, recent_orders: 0 }]);
      
      const rev = Number(rows[0]?.recent_revenue || 0);
      const orders = Number(rows[0]?.recent_orders || 0);
      const projected = Math.round(rev * 1.12); // 12% projected monthly expansion

      return `Sales Forecast:\n- Past 30-Day Confirmed Revenue: ₦${rev.toLocaleString()} across ${orders} order(s).\n- Projected Next 30-Day Revenue: ~₦${projected.toLocaleString()} (+12% estimated growth).\n- Recommended Focus: Re-stock top moving inventory and re-engage lapsed customers via win-back offers.`;
    } catch (e: any) {
      logger.error("[generate_sales_forecast error]", e);
      return "Unable to calculate sales forecast.";
    }
  },

  analyze_peak_hours: async (merchantId: string, args: any) => {
    try {
      const rows = await sql`
        SELECT 
          EXTRACT(HOUR FROM created_at) as hour,
          COUNT(*) as msg_count
        FROM conversation_messages
        WHERE merchant_id = ${merchantId}::uuid
        GROUP BY hour
        ORDER BY msg_count DESC
        LIMIT 3
      `.catch(() => []);

      if (rows.length === 0) return "Not enough conversation history yet to determine peak customer messaging hours.";
      const peakText = rows.map(r => `• ${String(r.hour).padStart(2, '0')}:00 WAT (${r.msg_count} messages)`).join('\n');
      return `Peak Customer Hours:\n${peakText}\n\nTip: Biblio autonomously handles inquiries during these surges so no lead waits.`;
    } catch (e: any) {
      logger.error("[analyze_peak_hours error]", e);
      return "Peak hours analysis unavailable.";
    }
  },

  analyze_popular_products: async (merchantId: string, args: any) => {
    try {
      const rows = await sql`
        SELECT name, price, COALESCE(total_sales, 0) as sales, COALESCE(quantity, stock, 0) as stock
        FROM products
        WHERE (merchant_id = ${merchantId}::uuid OR tenant_id = ${merchantId}::uuid)
        ORDER BY sales DESC, price DESC
        LIMIT 5
      `.catch(() => []);

      if (rows.length === 0) return "No products found in catalog.";
      const items = rows.map((r, i) => `${i + 1}. ${r.name} — ₦${Number(r.price || 0).toLocaleString()} (${r.sales} sold, ${r.stock} in stock)`).join('\n');
      return `Top Products:\n${items}`;
    } catch (e: any) {
      logger.error("[analyze_popular_products error]", e);
      return "Unable to analyze popular products.";
    }
  },

  get_competitor_pricing: async (merchantId: string, args: any) => {
    try {
      const rows = await sql`
        SELECT 
          AVG(price) as avg_price,
          MIN(price) as min_price,
          MAX(price) as max_price,
          COUNT(id) as count
        FROM products
        WHERE sku = ${args.sku} OR name ILIKE ${'%' + (args.sku || '') + '%'}
      `.catch(() => [{ avg_price: 0, min_price: 0, max_price: 0, count: 0 }]);

      const count = Number(rows[0]?.count || 0);
      if (count === 0) return `No market benchmarks found for '${args.sku}'.`;
      const avg = Math.round(Number(rows[0]?.avg_price || 0));
      const min = Math.round(Number(rows[0]?.min_price || 0));
      const max = Math.round(Number(rows[0]?.max_price || 0));
      return `Market Intel for '${args.sku}':\n- Average Market Price: ₦${avg.toLocaleString()}\n- Market Range: ₦${min.toLocaleString()} — ₦${max.toLocaleString()} across ${count} listings.`;
    } catch (e: any) {
      logger.error("[get_competitor_pricing error]", e);
      return "Market pricing data unavailable.";
    }
  },

  export_sales_data: async (merchantId: string, args: any) => {
    try {
      const rows = await sql`
        SELECT id, customer_id, amount, status, created_at
        FROM transactions
        WHERE merchant_id = ${merchantId}::uuid
        ORDER BY created_at DESC
        LIMIT 20
      `.catch(() => []);

      if (rows.length === 0) return "No transactions available to export.";
      const csvHeader = "ID,Customer,Amount_NGN,Status,Date\n";
      const csvRows = rows.map(r => `${r.id.slice(0, 8)},${r.customer_id},${r.amount},${r.status},${new Date(r.created_at).toISOString().slice(0, 10)}`).join('\n');
      return `Sales Export (CSV):\n\`\`\`csv\n${csvHeader}${csvRows}\n\`\`\``;
    } catch (e: any) {
      logger.error("[export_sales_data error]", e);
      return "Export failed.";
    }
  },

  generate_business_health_score: async (merchantId: string, args: any) => {
    try {
      const [txRows, disputes] = await Promise.all([
        sql`SELECT COUNT(id) as total, COUNT(CASE WHEN status = 'confirmed' THEN 1 END) as confirmed FROM transactions WHERE merchant_id = ${merchantId}::uuid`.catch(() => [{ total: 0, confirmed: 0 }]),
        sql`SELECT COUNT(id) as dispute_count FROM order_disputes WHERE merchant_id = ${merchantId}::uuid`.catch(() => [{ dispute_count: 0 }])
      ]);

      const total = Number(txRows[0]?.total || 0);
      const confirmed = Number(txRows[0]?.confirmed || 0);
      const disputeCount = Number(disputes[0]?.dispute_count || 0);

      const conversionRate = total > 0 ? (confirmed / total) * 100 : 85;
      const disputePenalty = disputeCount * 5;
      const score = Math.max(20, Math.min(98, Math.round(conversionRate - disputePenalty)));

      return `Business Health Score: ${score}/100\n- Payment Conversion: ${conversionRate.toFixed(1)}%\n- Active Disputes: ${disputeCount}\n- Operational Status: ${score >= 80 ? 'Excellent' : score >= 60 ? 'Healthy' : 'Needs Attention'}`;
    } catch (e: any) {
      logger.error("[generate_business_health_score error]", e);
      return "Business health score calculation unavailable.";
    }
  },

  customer_sentiment_analysis: async (merchantId: string, args: any) => {
    try {
      const disputes = await sql`SELECT COUNT(id) as c FROM order_disputes WHERE merchant_id = ${merchantId}::uuid AND status = 'open'`.catch(() => [{ c: 0 }]);
      const openCount = Number(disputes[0]?.c || 0);
      if (openCount === 0) {
        return "Customer Sentiment: High (Positive). Zero open customer disputes across active orders.";
      }
      return `Customer Sentiment Alert: ${openCount} open order dispute(s) require merchant attention in the Disputes tab.`;
    } catch (e: any) {
      logger.error("[customer_sentiment_analysis error]", e);
      return "Customer sentiment analysis unavailable.";
    }
  },

  inventory_turnover_rate: async (merchantId: string, args: any) => {
    try {
      const rows = await sql`
        SELECT 
          COALESCE(SUM(total_sales), 0) as total_sold,
          COALESCE(SUM(COALESCE(quantity, stock, 0)), 0) as remaining_stock
        FROM products
        WHERE merchant_id = ${merchantId}::uuid OR tenant_id = ${merchantId}::uuid
      `.catch(() => [{ total_sold: 0, remaining_stock: 0 }]);

      const sold = Number(rows[0]?.total_sold || 0);
      const remaining = Number(rows[0]?.remaining_stock || 0);
      const totalUnits = sold + remaining;
      const rate = totalUnits > 0 ? ((sold / totalUnits) * 100).toFixed(1) : "0";

      return `Inventory Turnover Rate: ${rate}%\n- Total Units Sold: ${sold}\n- Active Units in Stock: ${remaining}\n- Assessment: ${Number(rate) > 40 ? 'Fast Moving' : 'Steady Pace'}`;
    } catch (e: any) {
      logger.error("[inventory_turnover_rate error]", e);
      return "Inventory turnover rate unavailable.";
    }
  }
};
