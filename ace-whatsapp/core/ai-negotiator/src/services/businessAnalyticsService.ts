import { sql, redis, jsonb } from '@ace/shared/clients';
import { logger } from '@ace/shared/logger.js';
import Groq from 'groq-sdk';
import { loadNegotiatorEnv } from '@ace/shared/env.js';

const env = loadNegotiatorEnv();
const groq = new Groq({ apiKey: env.GROQ_API_KEY || process.env.GROQ_API_KEY || '' });
const GROQ_MODEL = env.GROQ_MODEL || process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

export interface BusinessHealthScore {
  overallScore: number; // 0 - 100
  grade: 'A+' | 'A' | 'B' | 'C' | 'Needs Attention';
  fulfillmentRateScore: number;
  customerRetentionScore: number;
  revenueVelocityScore: number;
  disputeRateScore: number;
  actionableInsights: string[];
}

export interface PeakHourDistribution {
  hourOfDay: number; // 0 - 23
  timeLabel: string; // "2 PM"
  orderCount: number;
  totalVolume: number;
  isPeak: boolean;
}

export class BusinessAnalyticsService {
  /**
   * Calculate overall Business Health Score (0-100) based on real commerce metrics.
   */
  static async generateBusinessHealthScore(merchantId: string): Promise<BusinessHealthScore> {
    // 1. Fulfillment rate: delivered vs cancelled
    const fulfillmentRows = await sql<{
      total_orders: number;
      completed_orders: number;
      disputed_orders: number;
    }[]>`
      SELECT 
        COUNT(id) as total_orders,
        COUNT(CASE WHEN fulfillment_status = 'delivered' OR payment_status IN ('paid', 'settled') THEN 1 END) as completed_orders,
        COUNT(CASE WHEN payment_status = 'disputed' THEN 1 END) as disputed_orders
      FROM orders
      WHERE (merchant_id = ${merchantId}::uuid OR tenant_id = ${merchantId}::uuid)
        AND created_at >= NOW() - INTERVAL '30 days'
    `.catch(() => [{ total_orders: 0, completed_orders: 0, disputed_orders: 0 }]);

    const stats = fulfillmentRows[0];
    const total = Number(stats.total_orders || 0);
    const completed = Number(stats.completed_orders || 0);
    const disputed = Number(stats.disputed_orders || 0);

    const fulfillmentRate = total > 0 ? (completed / total) * 100 : 85;
    const disputeRate = total > 0 ? (disputed / total) * 100 : 0;

    // 2. Retention rate
    const repeatCustomerRows = await sql<{
      repeat_count: number;
      total_customers: number;
    }[]>`
      SELECT 
        COUNT(CASE WHEN order_count > 1 THEN 1 END) as repeat_count,
        COUNT(1) as total_customers
      FROM (
        SELECT customer_id, COUNT(id) as order_count
        FROM orders
        WHERE (merchant_id = ${merchantId}::uuid OR tenant_id = ${merchantId}::uuid)
          AND created_at >= NOW() - INTERVAL '90 days'
        GROUP BY customer_id
      ) sub
    `.catch(() => [{ repeat_count: 0, total_customers: 0 }]);

    const totalCust = Number(repeatCustomerRows[0]?.total_customers || 0);
    const repeatCust = Number(repeatCustomerRows[0]?.repeat_count || 0);
    const retentionRate = totalCust > 0 ? (repeatCust / totalCust) * 100 : 25;

    // Score calculations
    const fulfillmentScore = Math.min(100, Math.round(fulfillmentRate));
    const retentionScore = Math.min(100, Math.round(retentionRate * 2.5));
    const disputeScore = Math.max(0, Math.round(100 - disputeRate * 10));
    const velocityScore = total >= 30 ? 95 : total >= 10 ? 80 : 65;

    const overall = Math.round(fulfillmentScore * 0.35 + retentionScore * 0.25 + disputeScore * 0.25 + velocityScore * 0.15);

    let grade: 'A+' | 'A' | 'B' | 'C' | 'Needs Attention' = 'B';
    if (overall >= 90) grade = 'A+';
    else if (overall >= 80) grade = 'A';
    else if (overall >= 70) grade = 'B';
    else if (overall >= 55) grade = 'C';
    else grade = 'Needs Attention';

    const insights = [];
    if (retentionRate < 20) insights.push('Run an automated Winback offer campaign to re-engage dormant buyers.');
    if (fulfillmentRate < 80) insights.push('Fulfillment delays detected; consider assigning faster courier riders.');
    if (disputeRate > 5) insights.push('Escrow dispute rate elevated; inspect product description accuracy.');
    if (insights.length === 0) insights.push('Store operations are firing on all cylinders! Keep inventory well stocked.');

    return {
      overallScore: overall,
      grade,
      fulfillmentRateScore: fulfillmentScore,
      customerRetentionScore: retentionScore,
      revenueVelocityScore: velocityScore,
      disputeRateScore: disputeScore,
      actionableInsights: insights,
    };
  }

  /**
   * Analyze peak buying and negotiation hours to optimize status posts and staff shifts.
   */
  static async analyzePeakHours(merchantId: string): Promise<{ peakHours: PeakHourDistribution[]; topPeakHour: string }> {
    const hourRows = await sql<{
      hr: number;
      cnt: number;
      vol: number;
    }[]>`
      SELECT 
        EXTRACT(HOUR FROM created_at)::int as hr,
        COUNT(id)::int as cnt,
        COALESCE(SUM(total_amount), 0)::float as vol
      FROM orders
      WHERE (merchant_id = ${merchantId}::uuid OR tenant_id = ${merchantId}::uuid)
        AND created_at >= NOW() - INTERVAL '60 days'
      GROUP BY EXTRACT(HOUR FROM created_at)
      ORDER BY cnt DESC
    `.catch(() => []);

    const counts = new Map<number, { count: number; volume: number }>();
    for (const r of hourRows) {
      counts.set(r.hr, { count: r.cnt, volume: r.vol });
    }

    const distribution: PeakHourDistribution[] = [];
    let topHour = 14;
    let maxCnt = 0;

    for (let h = 0; h < 24; h++) {
      const data = counts.get(h) || { count: 0, volume: 0 };
      if (data.count > maxCnt) {
        maxCnt = data.count;
        topHour = h;
      }
      const label = h === 0 ? '12 AM' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h - 12} PM`;
      distribution.push({
        hourOfDay: h,
        timeLabel: label,
        orderCount: data.count,
        totalVolume: data.volume,
        isPeak: data.count >= Math.max(3, maxCnt * 0.7),
      });
    }

    const topLabel = topHour === 0 ? '12 AM' : topHour < 12 ? `${topHour} AM` : topHour === 12 ? '12 PM' : `${topHour - 12} PM`;
    return { peakHours: distribution, topPeakHour: topLabel };
  }

  /**
   * Rank top-selling products by revenue and sales volume.
   */
  static async analyzePopularProducts(
    merchantId: string,
    limit: number = 10
  ): Promise<Array<{ sku: string; name: string; unitsSold: number; totalRevenue: number }>> {
    const rows = await sql<{
      sku: string;
      name: string;
      units_sold: number;
      total_revenue: number;
    }[]>`
      SELECT 
        (item->>'sku') as sku,
        COALESCE(item->>'name', item->>'sku') as name,
        COALESCE(SUM((item->>'quantity')::int), 0) as units_sold,
        COALESCE(SUM((item->>'price')::numeric * (item->>'quantity')::int), 0) as total_revenue
      FROM orders o,
      jsonb_array_elements(CASE WHEN jsonb_typeof(o.items) = 'array' THEN o.items ELSE '[]'::jsonb END) as item
      WHERE (o.merchant_id = ${merchantId}::uuid OR o.tenant_id = ${merchantId}::uuid)
        AND o.payment_status IN ('paid', 'escrow_locked', 'settled')
      GROUP BY (item->>'sku'), (item->>'name')
      ORDER BY total_revenue DESC
      LIMIT ${limit}
    `.catch(() => []);

    return rows.map((r) => ({
      sku: r.sku || 'GENERAL-SKU',
      name: r.name || 'Catalog Product',
      unitsSold: Number(r.units_sold),
      totalRevenue: Number(r.total_revenue),
    }));
  }

  /**
   * Generate linear sales forecast based on moving average.
   */
  static async generateSalesForecast(
    merchantId: string,
    daysAhead: number = 14
  ): Promise<{ projectedRevenue: number; projectedOrders: number; dailyAverages: Array<{ date: string; expectedSales: number }> }> {
    const historical = await sql<{ daily_rev: number }[]>`
      SELECT COALESCE(SUM(total_amount), 0) as daily_rev
      FROM orders
      WHERE (merchant_id = ${merchantId}::uuid OR tenant_id = ${merchantId}::uuid)
        AND created_at >= NOW() - INTERVAL '30 days'
        AND payment_status IN ('paid', 'escrow_locked', 'settled')
      GROUP BY DATE(created_at)
    `.catch(() => []);

    const totalRev = historical.reduce((acc, r) => acc + Number(r.daily_rev), 0);
    const avgDailyRev = historical.length > 0 ? totalRev / historical.length : 25000;

    const projectedRevenue = Math.round(avgDailyRev * daysAhead);
    const projectedOrders = Math.round((projectedRevenue / (avgDailyRev / 2 || 10000)));

    const dailyAverages = [];
    for (let i = 1; i <= daysAhead; i++) {
      const d = new Date(Date.now() + i * 86400 * 1000);
      dailyAverages.push({
        date: d.toISOString().split('T')[0],
        expectedSales: Math.round(avgDailyRev),
      });
    }

    return {
      projectedRevenue,
      projectedOrders,
      dailyAverages,
    };
  }
}
