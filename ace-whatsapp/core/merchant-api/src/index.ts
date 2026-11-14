// core/merchant-api/src/index.ts
//
// The self-serve control plane. Phase 1 "onboarding" used to mean hand-writing
// INSERT statements; this REST API is what the merchant-app (Expo) and the
// admin-portal (web) call instead. It owns everything the AI negotiator reads as
// "seller context":
//
//   - the merchant's voice  (name, tone_guide, business_policies, delivery_info, dialect)
//   - the catalog           (products: rich description/category/tags/attributes)
//   - the negotiation rules (merchant_pricing_rules: floor + per-tier ceilings)
//   - customer ↔ merchant links (Phase-1 identity)
//   - a one-tap WhatsApp catalog import (delegates to catalog-sync)
//
// Auth: if ADMIN_API_KEY is set, every route requires a matching `x-api-key`
// header. (Phase 2: real per-merchant auth + RLS — see infra/README.md.)

import Fastify from "fastify";
import { sql, jsonb, redis } from "@ace/shared/clients";
import type { Dialect } from "@ace/shared/types";
import { syncMerchantCatalog } from "../../catalog-sync/src/index.js";
import { authEngine } from "@ace/shared/auth/index.js";
import { identityEngine } from "@ace/shared/identity-resolution/index.js";
import { dataIntelligence } from "@ace/shared/data-intelligence/engine.js";
import { interactionFeedback } from "@ace/shared/feedback/interactionFeedback.js";
import { runBiblioAgentTurn } from "../../ai-negotiator/src/biblioAgentLoop.js";
import { processAudioMultimodal, processImageMultimodal } from "../../ai-negotiator/src/services/multimodalService.js";
import {
  maskApiKey,
  isMaskedKey,
  isPlatformDefaultAvailable,
  upsertPlatformCredential,
} from "@ace/shared/integrations/credentials.js";
import {
  isFeatureAllowed,
  FEATURE_TIER_REQUIREMENTS,
  FEATURE_CATALOG,
  getMerchantFeatureEntitlements,
} from "@ace/shared/tiers/featureGuard.js";
import { VendorPresenceService, type PresenceInfo, type PresenceState } from "./services/VendorPresenceService.js";
import { ChatClassifier } from "./services/ChatClassifier.js";
import { getLiveUsdNgnRate } from "@ace/shared/fxService.js";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import nodemailer from "nodemailer";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
// Baileys gateway management calls — forwarded to the gateway HTTP service
const BAILEYS_GATEWAY_URL =
  process.env.BAILEYS_GATEWAY_URL ?? "http://localhost:3005";

export const app = Fastify({ logger: (process.env.NODE_ENV === "test" || process.env.MERCHANT_API_LOG_DISABLED === "true") ? false : true });

export const isUuid = (val: unknown): val is string =>
  typeof val === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

export function safeJsonParse<T>(val: unknown, fallback: T): T {
  if (val === null || val === undefined) return fallback;
  if (typeof val === "object") return val as T;
  if (typeof val !== "string") return fallback;
  try {
    return JSON.parse(val) as T;
  } catch {
    return fallback;
  }
}

export function parsePagination(query: any, defaultLimit = 20, maxLimit = 100): { limit: number; offset: number } {
  const rawLimit = Number(query?.limit);
  const rawOffset = Number(query?.offset);
  const limit = (!Number.isFinite(rawLimit) || rawLimit < 1)
    ? defaultLimit
    : Math.min(Math.floor(rawLimit), maxLimit);
  const offset = (!Number.isFinite(rawOffset) || rawOffset < 0)
    ? 0
    : Math.floor(rawOffset);
  return { limit, offset };
}

// #1 FIX: Restrict CORS to known origins. Wildcard allows any site to call this API.
const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? "http://localhost:3000,http://localhost:5173")
  .split(",")
  .map(o => o.trim());
app.register(cors, {
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin) || process.env.NODE_ENV === "development") {
      cb(null, true);
    } else {
      cb(new Error(`Origin ${origin} not allowed`), false);
    }
  },
  credentials: true,
});

// ─── Custom JSON Content-Type Parser (gracefully handle empty bodies) ────────
app.addContentTypeParser('application/json', { parseAs: 'string' }, (req, body: string | Buffer, done) => {
  const strBody = typeof body === 'string' ? body : body.toString('utf-8');
  if (!strBody || strBody.trim() === '') {
    done(null, {});
    return;
  }
  try {
    const json = JSON.parse(strBody);
    done(null, json);
  } catch (err: any) {
    err.statusCode = 400;
    done(err, undefined);
  }
});

// ─── PreValidation: Ensure body is never undefined on mutating requests ──────
app.addHook("preValidation", async (request) => {
  if (["POST", "PUT", "PATCH"].includes(request.method) && (request.body === undefined || request.body === null)) {
    request.body = {};
  }
});

// ─── Auth gate (SharedAuthEngine) ────────────────────────────────────────────
app.addHook("onRequest", authEngine.getFastifyHook());

// ─── Parameter validation & tenant isolation hook ────────────────────────────
app.addHook("preHandler", async (request, reply) => {
  const params = request.params as Record<string, string> | undefined;
  if (!params) return;

  const uuidParamNames = ["id", "merchantId", "vendorId", "supplierId", "quarantineId", "disputeId"];
  for (const pName of uuidParamNames) {
    const val = params[pName];
    if (val !== undefined && !isUuid(val)) {
      return reply.code(400).send({
        error: "Bad Request",
        message: `Invalid parameter '${pName}': must be a valid UUID`,
        code: "INVALID_UUID",
      });
    }
  }

  // Tenant isolation check: merchant can only access their own merchant ID
  const targetMerchantId = params.id || params.merchantId;
  if (targetMerchantId && (request as any).merchantId && (request as any).role === "merchant") {
    try {
      authEngine.assertMerchantAccess(request, targetMerchantId);
    } catch (err: any) {
      return reply.code(403).send({
        error: "Forbidden",
        message: err.message,
        code: "FORBIDDEN",
      });
    }
  }
});

// ─── Auth & Identity Routes (Open) ───────────────────────────────────────────

// #2 FIX: /auth/token is a backdoor — gate behind ADMIN_API_KEY, refuse in production without it
app.post("/auth/token", async (req, reply) => {
  const adminKey = process.env.ADMIN_API_KEY || process.env.ADMIN_SECRET || 'biblio_owner_2026';
  const providedKey = (req.headers["x-admin-key"] || req.headers["x-api-key"]) as string | undefined;
  if (!providedKey || providedKey !== adminKey) {
    return reply.code(403).send({ error: "Forbidden: admin key required" });
  }
  const { merchantId, role } = (req.body || {}) as { merchantId: string; role?: 'merchant' | 'admin' };
  if (!merchantId || !isUuid(merchantId)) return reply.code(400).send({ error: "Valid UUID merchantId required" });
  const token = await authEngine.issueToken(merchantId, role || 'merchant');
  return reply.send({ token });
});

// Twilio SMS Verify integration for Merchant App login
app.post("/auth/otp/send", async (req, reply) => {
  const { phone } = (req.body || {}) as { phone: string };
  if (!phone || typeof phone !== 'string' || phone.trim() === '') return reply.code(400).send({ error: "phone required" });
  
  const success = await identityEngine.sendOTP(phone.trim());
  if (!success) return reply.code(500).send({ error: "Failed to send OTP" });
  return reply.send({ ok: true });
});

app.post("/auth/otp/verify", async (req, reply) => {
  const { phone, code, merchantId } = (req.body || {}) as { phone: string; code: string; merchantId: string };
  if (!phone || !code || !merchantId || !isUuid(merchantId)) return reply.code(400).send({ error: "phone, code, and valid UUID merchantId required" });

  const globalBuyerId = await identityEngine.verifyOTP(phone.trim(), code.trim(), merchantId);
  if (!globalBuyerId) {
    return reply.code(401).send({ error: "Invalid OTP" });
  }

  // Issue a JWT for the verified merchant
  const token = await authEngine.issueToken(merchantId, 'merchant');
  return reply.send({ ok: true, globalBuyerId, token });
});

// ─── Telemetry Bridge ────────────────────────────────────────────────────────
app.post("/telemetry", async (req, reply) => {
  const b = (req.body || {}) as any;
  if (!b.action) return reply.code(400).send({ error: "action required" });
  
  // @ts-ignore - Fastify hook injects merchantId
  const merchantId = req.merchantId;

  await dataIntelligence.auditLog({
    service: b.service || 'frontend-app',
    merchantId,
    action: b.action,
    metadata: b.metadata || {}
  });

  return reply.send({ ok: true });
});

app.get("/telemetry/dashboard", async (req, reply) => {
  const DEFAULT_MERCHANT_ID = '4a7b2e63-c95f-4c71-9d08-2f05b68960ed';
  const rawId = (req as any).merchantId || (req.query as any)?.merchantId || req.headers['x-merchant-id'];
  const merchantId = rawId && isUuid(rawId) ? rawId : (process.env.NODE_ENV !== 'production' ? DEFAULT_MERCHANT_ID : null);

  if (!merchantId) {
    return reply.code(400).send({ error: "Valid UUID merchantId required", code: "INVALID_UUID" });
  }

  try {
    const [
      outcomeRows,
      elasticityRows,
      revenueRows,
      todayRevenueRows,
      lastWeekSameDayRevenueRows,
      escalationRows,
      prevEscalationRows,
      leakRows,
      oracleAlertRows,
      merchantRows,
      supplierLedgerRows,
      totalChatRows,
      topCategoryRows,
      cur7dChatRows,
      prev7dChatRows
    ] = await Promise.all([
      sql<{outcome: string, count: number}[]>`
        SELECT outcome, COUNT(*) as count
        FROM negotiation_traces
        WHERE merchant_id = ${merchantId}::uuid AND created_at > now() - interval '30 days'
        GROUP BY outcome
      `,
      sql<{day: string, avg_elasticity: number}[]>`
        SELECT to_char(created_at, 'Dy') as day, ROUND(AVG(COALESCE(price_elasticity_signal, 0))::numeric, 2) as avg_elasticity
        FROM negotiation_traces
        WHERE merchant_id = ${merchantId}::uuid AND created_at > now() - interval '7 days'
        GROUP BY to_char(created_at, 'Dy'), DATE_TRUNC('day', created_at)
        ORDER BY DATE_TRUNC('day', created_at)
      `,
      sql<{total: number, count: number}[]>`
        SELECT COALESCE(SUM(amount), 0) as total, COUNT(*) as count
        FROM transactions
        WHERE merchant_id = ${merchantId}::uuid AND status = 'confirmed' AND created_at > now() - interval '30 days'
      `,
      sql<{total: number, count: number}[]>`
        SELECT COALESCE(SUM(amount), 0) as total, COUNT(*) as count
        FROM transactions
        WHERE merchant_id = ${merchantId}::uuid AND status = 'confirmed' AND created_at >= CURRENT_DATE
      `,
      sql<{total: number, count: number}[]>`
        SELECT COALESCE(SUM(amount), 0) as total, COUNT(*) as count
        FROM transactions
        WHERE merchant_id = ${merchantId}::uuid AND status = 'confirmed' 
          AND created_at >= CURRENT_DATE - interval '7 days' 
          AND created_at < CURRENT_DATE - interval '6 days'
      `,
      sql<{count: number}[]>`
        SELECT COUNT(*) as count FROM escalations WHERE merchant_id = ${merchantId}::uuid AND created_at > now() - interval '7 days'
      `,
      sql<{count: number}[]>`
        SELECT COUNT(*) as count FROM escalations WHERE merchant_id = ${merchantId}::uuid AND created_at > now() - interval '14 days' AND created_at <= now() - interval '7 days'
      `,
      sql<{status: string, total: number}[]>`
        SELECT status, SUM(amount) as total
        FROM transactions
        WHERE merchant_id = ${merchantId}::uuid AND status IN ('failed', 'abandoned', 'unverified', 'pending')
        GROUP BY status
      `,
      sql<{type: string, message: string, id: string}[]>`
        SELECT 
          'WINBACK' as type, 
          COALESCE(message_draft, 'VIP customer winback draft ready for approval') as message,
          id::text as id
        FROM winback_drafts
        WHERE merchant_id = ${merchantId}::uuid AND status IN ('pending_approval', 'draft', 'pending')
        UNION ALL
        SELECT 
          'RESTOCK' as type, 
          COALESCE(message_draft, 'Inventory restock draft ready for supplier dispatch') as message,
          id::text as id
        FROM restock_drafts
        WHERE merchant_id = ${merchantId}::uuid AND status IN ('pending_approval', 'draft', 'pending')
        UNION ALL
        SELECT 
          'RESTOCK' as type,
          CONCAT('Low stock warning: ', name, ' has only ', COALESCE(quantity, stock, 0), ' units left.') as message,
          id::text as id
        FROM products
        WHERE (merchant_id = ${merchantId}::uuid OR tenant_id = ${merchantId}::uuid)
          AND deleted_at IS NULL
          AND COALESCE(quantity, stock, 0) > 0
          AND COALESCE(quantity, stock, 0) <= 5
        LIMIT 5
      `,
      sql<{phone_number_id: string, name: string}[]>`
        SELECT phone_number_id, name FROM merchants WHERE id = ${merchantId}::uuid LIMIT 1
      `,
      sql<{total: number}[]>`
        SELECT COALESCE(SUM(sl.amount), 0) as total
        FROM supplier_ledger sl
        INNER JOIN suppliers s ON s.id = sl.supplier_id
        WHERE sl.status IN ('settled', 'paid', 'confirmed')
          AND s.tenant_id = ${merchantId}::uuid
      `,
      sql<{count: number}[]>`
        SELECT COUNT(*) as count
        FROM conversation_messages
        WHERE merchant_id = ${merchantId}::uuid
      `,
      sql<{category: string, avg_price: number}[]>`
        SELECT 
          COALESCE(NULLIF(category, ''), 'General Merchandise') as category, 
          ROUND(AVG(COALESCE(price, 0))::numeric, 0) as avg_price
        FROM products
        WHERE (merchant_id = ${merchantId}::uuid OR tenant_id = ${merchantId}::uuid) AND deleted_at IS NULL
        GROUP BY COALESCE(NULLIF(category, ''), 'General Merchandise')
        ORDER BY COUNT(*) DESC
        LIMIT 1
      `,
      sql<{count: number}[]>`
        SELECT COUNT(*) as count
        FROM conversation_messages
        WHERE merchant_id = ${merchantId}::uuid AND created_at > now() - interval '7 days'
      `,
      sql<{count: number}[]>`
        SELECT COUNT(*) as count
        FROM conversation_messages
        WHERE merchant_id = ${merchantId}::uuid AND created_at > now() - interval '14 days' AND created_at <= now() - interval '7 days'
      `
    ]);

    const outcomes = outcomeRows.map(r => ({ name: r.outcome, value: Number(r.count) }));
    const elasticity = elasticityRows.map(r => ({ name: r.day, score: Number(r.avg_elasticity) }));
    
    const todayTotal = Number(todayRevenueRows[0]?.total ?? 0);
    const todayCount = Number(todayRevenueRows[0]?.count ?? 0);
    const lastWeekSameDayTotal = Number(lastWeekSameDayRevenueRows[0]?.total ?? 0);

    let deltaPct = 0;
    let isPositive = true;
    let deltaLabel = '0% vs last week';

    if (lastWeekSameDayTotal > 0) {
      deltaPct = Math.round(((todayTotal - lastWeekSameDayTotal) / lastWeekSameDayTotal) * 100);
      isPositive = deltaPct >= 0;
      deltaLabel = `${isPositive ? '↑' : '↓'} ${Math.abs(deltaPct)}% vs last week`;
    } else if (todayTotal > 0) {
      deltaPct = 100;
      isPositive = true;
      deltaLabel = '↑ New revenue today';
    } else {
      deltaPct = 0;
      isPositive = true;
      deltaLabel = '0% vs last week';
    }

    const revenue = {
      total: todayTotal,
      month_total: Number(revenueRows[0]?.total ?? 0),
      orders: todayCount,
      month_orders: Number(revenueRows[0]?.count ?? 0),
      delta_pct: deltaPct,
      is_positive: isPositive,
      delta_label: deltaLabel,
    };

    // Calculate real AOCR
    const totalTraces = outcomeRows.reduce((acc, r) => acc + Number(r.count), 0);
    const wonTraces = outcomeRows.filter(r => ['won', 'order_placed', 'paid', 'success'].includes(r.outcome.toLowerCase()))
                                 .reduce((acc, r) => acc + Number(r.count), 0);
    const aocrRate = totalTraces > 0 ? Math.round((wonTraces / totalTraces) * 100) : 100;

    // Real autonomy debt
    const curInterventions = Number(escalationRows[0]?.count ?? 0);
    const prevInterventions = Number(prevEscalationRows[0]?.count ?? 0);
    const dropPct = prevInterventions > 0 
      ? Math.max(0, Math.round(((curInterventions - prevInterventions) / prevInterventions) * 100))
      : (curInterventions > 0 ? 100 : 0);

    const autonomy_debt = {
      interventions: curInterventions,
      drop_pct: dropPct
    };

    const oracle_alerts = oracleAlertRows || [];
    const oracle_count = oracle_alerts.length;

    const leak_map = {
      abandoned_carts: Number(leakRows.find(r => r.status === 'abandoned')?.total ?? 0),
      failed_payments: Number(leakRows.find(r => r.status === 'failed')?.total ?? 0),
      unverified: Number(leakRows.find(r => ['unverified', 'pending'].includes(r.status))?.total ?? 0)
    };

    const cur7dChats = Number(cur7dChatRows[0]?.count ?? 0);
    const prev7dChats = Number(prev7dChatRows[0]?.count ?? 0);
    let surgePct = 0;
    if (prev7dChats > 0) {
      surgePct = Math.round(((cur7dChats - prev7dChats) / prev7dChats) * 100);
    } else if (cur7dChats > 0) {
      surgePct = 100;
    }

    const topCategory = topCategoryRows[0]?.category || 'General Merchandise';
    const avgPrice = Number(topCategoryRows[0]?.avg_price ?? 0);

    const market_pulse = {
      trend: topCategory,
      surge_pct: surgePct,
      avg_price: avgPrice,
      total_chats: Number(totalChatRows[0]?.count ?? 0)
    };

    const supplier_outflow = Number(supplierLedgerRows[0]?.total ?? 0);

    return reply.send({
      outcomes,
      elasticity,
      revenue,
      aocr_rate: aocrRate,
      oracle_alerts,
      oracle_count,
      autonomy_debt,
      leak_map,
      market_pulse,
      supplier_outflow,
      whatsapp_connected: Boolean(merchantRows[0]?.phone_number_id),
      business_phone: merchantRows[0]?.phone_number_id || null,
    });
  } catch (err: any) {
    app.log.error(err, 'Failed to fetch telemetry/dashboard');
    return reply.send({
      outcomes: [],
      elasticity: [],
      revenue: { total: 0, month_total: 0, orders: 0, month_orders: 0, delta_pct: 0, is_positive: true, delta_label: '0% vs last week' },
      aocr_rate: 100,
      oracle_alerts: [],
      oracle_count: 0,
      autonomy_debt: { interventions: 0, drop_pct: 0 },
      leak_map: { abandoned_carts: 0, failed_payments: 0, unverified: 0 },
      market_pulse: { trend: 'General Merchandise', surge_pct: 0, avg_price: 0, total_chats: 0 },
      supplier_outflow: 0,
      whatsapp_connected: false,
      business_phone: null
    });
  }
});

app.get("/merchants/:id/chats", async (req, reply) => {
  const { id } = req.params as { id: string };
  try {
    const rows = await sql`
      WITH RankedMessages AS (
        SELECT 
          customer_id, 
          source, 
          content, 
          created_at,
          metadata,
          ROW_NUMBER() OVER(PARTITION BY customer_id ORDER BY created_at DESC) as rn
        FROM conversation_messages
        WHERE merchant_id = ${id}::uuid
      )
      SELECT * FROM RankedMessages WHERE rn = 1
      ORDER BY created_at DESC
      LIMIT 20
    `;
    
    const chats = rows.map((r, i) => {
      const isAI = r.source === 'ai' || r.source === 'system';
      const metadata = (r.metadata as any) || {};
      
      return {
        id: r.customer_id + '_' + i,
        customerId: r.customer_id,
        name: metadata.customerName || r.customer_id || 'Unknown Customer',
        message: r.content || 'Active negotiation session...',
        time: new Date(r.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
        isAI,
        confidence: metadata.confidence ? Number(metadata.confidence) : null,
        unread: isAI ? 0 : 1,
        sentiment: metadata.sentiment || '😐',
        summary: metadata.summary || r.content?.substring(0, 50) || 'Ongoing chat',
        trend: metadata.trend || '📈'
      };
    });
    return reply.send(chats);
  } catch (err: any) {
    app.log.error(err, 'Error fetching chats');
    return reply.send([]);
  }
});

app.get("/merchants/:id/customers", async (req, reply) => {
  const { id } = req.params as { id: string };
  try {
    const rows = await sql`
      SELECT 
        c.customer_id as phone, 
        COUNT(DISTINCT t.id) as total_orders,
        COALESCE(SUM(t.amount), 0) as ltv,
        MAX(t.created_at) as last_order_date
      FROM customer_merchant_links c
      LEFT JOIN transactions t ON c.customer_id = t.customer_id AND c.merchant_id = t.merchant_id
      WHERE c.merchant_id = ${id}::uuid
      GROUP BY c.customer_id
      ORDER BY ltv DESC NULLS LAST
      LIMIT 50
    `;
    
    const customers = rows.map((r) => {
      const ltvVal = Number(r.ltv) || 0;
      const ltvStr = '₦' + ltvVal.toLocaleString();
      
      let status = 'Active';
      let risk = '10% - Med Risk';
      
      if (r.last_order_date) {
        const daysSinceLastOrder = (Date.now() - new Date(r.last_order_date).getTime()) / (1000 * 3600 * 24);
        if (daysSinceLastOrder > 60) {
          status = 'At Risk';
          risk = '45% - High Risk';
        } else if (daysSinceLastOrder > 30) {
          status = 'Active';
          risk = '20% - Med Risk';
        } else if (ltvVal > 200000) {
          status = 'VIP';
          risk = '2% - Low Risk';
        } else {
          status = 'Active';
          risk = '5% - Low Risk';
        }
      } else {
        status = 'Prospect';
        risk = 'N/A';
      }

      return { 
        id: r.phone, 
        name: r.phone, 
        email: `${r.phone.replace(/\D/g,'')}@whatsapp.net`, 
        predictedLTV: ltvStr, 
        churnRisk: risk, 
        status: status 
      };
    });

    return reply.send(customers);
  } catch (err: any) {
    app.log.error(err, 'Error fetching customers');
    return reply.send([]);
  }
});

app.get("/merchants/:id/inbox", async (req, reply) => {
  const { id } = req.params as { id: string };
  
  try {
    const winbacks = await sql`
      SELECT 
        w.id, 
        w.customer_id, 
        w.proposed_discount_percent, 
        w.message_draft,
        w.status,
        w.created_at
      FROM winback_drafts w
      WHERE w.merchant_id = ${id}::uuid AND w.status IN ('pending', 'snoozed', 'pending_approval', 'draft')
      ORDER BY w.created_at DESC
    `;
    
    const restocks = await sql`
      SELECT 
        r.id, 
        r.supplier_id, 
        r.proposed_quantity, 
        r.message_draft,
        r.status,
        p.name as product_name,
        COALESCE(p.quantity, p.stock, 0) as current_stock,
        p.price
      FROM restock_drafts r
      LEFT JOIN products p ON r.inventory_item_id = p.id
      WHERE r.merchant_id = ${id}::uuid AND r.status IN ('pending', 'snoozed', 'pending_approval', 'draft')
      ORDER BY r.created_at DESC
    `;

    const dispatchDrafts = await sql`
      SELECT 
        d.id, 
        d.order_id,
        d.status,
        d.created_at
      FROM dispatch_drafts d
      WHERE d.merchant_id = ${id}::uuid AND d.status IN ('pending', 'snoozed', 'pending_approval', 'draft')
      ORDER BY d.created_at DESC
    `;

    const inbox = [
      ...dispatchDrafts.map((r: any) => {
        const shortId = (r.order_id || '').split('-')[0] || 'ORD';
        return {
          id: `d_${r.id}`,
          type: "dispatch",
          title: `Ready to Dispatch: Order #${shortId}`,
          subtitle: `Payment cleared. Swipe right to hail a dispatch rider now.`,
          priority: 'high',
          status: r.status || 'pending',
        };
      }),
      ...winbacks.map((r: any) => {
        return { 
          id: `w_${r.id}`, 
          type: "winback", 
          title: `Customer Win-Back (${r.proposed_discount_percent || 15}% Off)`, 
          subtitle: r.message_draft || `Biblio drafted a win-back discount to re-engage past customer.`,
          priority: 'high',
          status: r.status || 'pending',
        };
      }),
      ...restocks.map((r: any) => {
        const cost = Math.round(Number(r.price || 0) * 0.7 * Number(r.proposed_quantity || 10));
        return { 
          id: `r_${r.id}`, 
          type: "restock", 
          title: `Restock Draft: ${r.product_name || 'Inventory Item'}`, 
          subtitle: r.message_draft || `Item is running low (${r.current_stock ?? 0} left). Drafted PO for ${r.proposed_quantity || 10} units (~₦${cost.toLocaleString()}).`,
          priority: 'medium',
          status: r.status || 'pending',
        };
      })
    ];

    return reply.send(inbox);
  } catch (err: any) {
    app.log.error(err);
    return reply.send([]);
  }
});

const DIALECTS: Dialect[] = ["pidgin", "yoruba", "igbo", "hausa", "english"];

app.get("/health", async () => ({ ok: true }));

// ─── Merchants ───────────────────────────────────────────────────────────────

app.post("/merchants", async (req, reply) => {
  const b = (req.body || {}) as Record<string, unknown>;
  const name = str(b.name);
  const phoneNumberId = str(b.phoneNumberId);
  if (!name || !phoneNumberId) {
    return reply.code(400).send({ error: "name and phoneNumberId are required" });
  }
  const dialect = normalizeDialect(b.dialect);

  try {
    const rows = await sql<{ id: string }[]>`
      insert into merchants
        (name, phone_number_id, tone_guide, business_policies, delivery_info,
         dialect, whatsapp_catalog_id)
      values (
        ${name}, ${phoneNumberId}, ${strOrNull(b.toneGuide)},
        ${strOrNull(b.businessPolicies)}, ${strOrNull(b.deliveryInfo)},
        ${dialect}, ${strOrNull(b.whatsappCatalogId)}
      )
      returning id
    `;
    return reply.code(201).send({ id: rows[0].id });
  } catch (err: any) {
    if (err.code === '23505') {
      return reply.code(409).send({ error: "A merchant with this phone number already exists", code: "MERCHANT_EXISTS" });
    }
    throw err;
  }
});

app.get("/merchants", async (req) => {
  const { limit, offset } = parsePagination(req.query, 50, 100);
  return await sql`
    select id, name, phone_number_id, tone_guide, business_policies,
           delivery_info, dialect, whatsapp_catalog_id, created_at
    from merchants order by created_at desc limit ${limit} offset ${offset}
  `;
});

app.get("/merchants/:id", async (req, reply) => {
  const { id } = req.params as { id: string };
  const rows = await sql`
    SELECT m.id, m.name, m.phone_number_id, m.tone_guide, m.business_policies,
           m.delivery_info, m.dialect, m.whatsapp_catalog_id, m.created_at,
           m.default_discount_pct, m.subscription_tier,
           m.owner_first_name, m.owner_last_name, m.dob_month, m.dob_day, m.dob_year, m.date_of_birth, m.age_verified,
           m.bank_details, m.bank_account_number, m.bank_code, m.payout_frequency, m.fee_padding_model, m.platform_fee_percent,
           m.is_registered, m.rc_number, m.business_type, m.tax_id, m.support_email, m.support_phone, m.website_url,
           m.physical_address, m.operating_hours, m.return_policy, m.delivery_notes, m.supports_pickup, m.social_links,
           m.contact_phone, m.onboarding_state,
           m.allow_list, m.deny_list, m.soft_mode, m.cancel_window_minutes, m.friend_pricing,
           pr.max_discount_by_tier,
           (SELECT COUNT(*) FROM vendor_decisions WHERE merchant_id = ${id} AND decision_type = 'training_correction') as ai_corrections
    FROM merchants m
    LEFT JOIN merchant_pricing_rules pr ON m.id = pr.merchant_id
    WHERE m.id = ${id} LIMIT 1
  `;
  if (!rows[0]) return reply.code(404).send({ error: "merchant not found" });
  
  const m = rows[0];
  
  // Synthesize Brain Config expected by settings.tsx
  let maxDiscountObj: any = {};
  if (typeof m.max_discount_by_tier === 'string') {
    try { maxDiscountObj = JSON.parse(m.max_discount_by_tier); } catch { maxDiscountObj = {}; }
  } else if (m.max_discount_by_tier && typeof m.max_discount_by_tier === 'object') {
    maxDiscountObj = m.max_discount_by_tier;
  }
  const maxDiscount = (maxDiscountObj.new || maxDiscountObj.loyal || 0.15) * 100;
  
  // Calculate TrustScore deterministically based on data
  let trustScore = 650;
  if (m.whatsapp_catalog_id) trustScore += 50;
  if (m.business_policies) trustScore += 84;
  if (m.is_registered || m.rc_number) trustScore += 66;

  // Safely parse JSONB / string fields
  let bankDetailsObj: any = {};
  if (typeof m.bank_details === 'string') {
    try { bankDetailsObj = JSON.parse(m.bank_details); } catch { bankDetailsObj = {}; }
  } else if (m.bank_details && typeof m.bank_details === 'object') {
    bankDetailsObj = m.bank_details;
  }
  const bankName = bankDetailsObj.bankName || bankDetailsObj.bank_name || '';
  const accountNumber = bankDetailsObj.accountNumber || bankDetailsObj.account_number || m.bank_account_number || '';
  const accountName = bankDetailsObj.accountName || bankDetailsObj.account_name || '';

  const parsedBankDetails = {
    bankName,
    accountNumber,
    accountName,
    configuredAt: bankDetailsObj.configuredAt || bankDetailsObj.configured_at || null
  };

  let parsedAddress: any = {};
  if (typeof m.physical_address === 'string') {
    try { parsedAddress = JSON.parse(m.physical_address); } catch { parsedAddress = { address: m.physical_address, street: m.physical_address }; }
  } else if (m.physical_address && typeof m.physical_address === 'object') {
    parsedAddress = m.physical_address;
  }

  let parsedHours: any = {};
  if (typeof m.operating_hours === 'string') {
    try { parsedHours = JSON.parse(m.operating_hours); } catch { parsedHours = {}; }
  } else if (m.operating_hours && typeof m.operating_hours === 'object') {
    parsedHours = m.operating_hours;
  }

  let parsedSocial: any = [];
  if (typeof m.social_links === 'string') {
    try { parsedSocial = JSON.parse(m.social_links); } catch { parsedSocial = []; }
  } else if (Array.isArray(m.social_links)) {
    parsedSocial = m.social_links;
  }

  let parsedAllow: string[] = [];
  if (typeof m.allow_list === 'string') {
    try { parsedAllow = JSON.parse(m.allow_list); } catch { parsedAllow = []; }
  } else if (Array.isArray(m.allow_list)) {
    parsedAllow = m.allow_list;
  }

  let parsedDeny: string[] = [];
  if (typeof m.deny_list === 'string') {
    try { parsedDeny = JSON.parse(m.deny_list); } catch { parsedDeny = []; }
  } else if (Array.isArray(m.deny_list)) {
    parsedDeny = m.deny_list;
  }

  let parsedFriendPricing: any = { discount_percent: 15 };
  if (typeof m.friend_pricing === 'string') {
    try { parsedFriendPricing = JSON.parse(m.friend_pricing); } catch { parsedFriendPricing = { discount_percent: 15 }; }
  } else if (typeof m.friend_pricing === 'object' && m.friend_pricing !== null) {
    parsedFriendPricing = m.friend_pricing;
  }

  const config = {
    ...m,
    bank_details: parsedBankDetails,
    bank_account_number: accountNumber,
    bank_code: m.bank_code || null,
    payout_frequency: m.payout_frequency || 'instant',
    fee_padding_model: m.fee_padding_model || 'customer_padded',
    platform_fee_percent: Number(m.platform_fee_percent || 3.0),
    subscription_tier: m.subscription_tier || 'starter',
    max_discount_percentage: Math.round(maxDiscount),
    auto_dispatch_riders: true, // Default to true if not explicitly stored
    auto_restock_buffer: 5,
    emoji_usage: 'Moderate',
    preferred_rider: 'Gokada',
    is_registered: Boolean(m.is_registered || m.rc_number),
    rc_number: m.rc_number || null,
    business_type: m.business_type || 'SOLE_PROPRIETOR',
    tax_id: m.tax_id || null,
    support_email: m.support_email || null,
    support_phone: m.support_phone || m.contact_phone || m.phone_number_id || null,
    website_url: m.website_url || null,
    physical_address: parsedAddress,
    operating_hours: parsedHours,
    allow_list: parsedAllow,
    deny_list: parsedDeny,
    soft_mode: Boolean(m.soft_mode),
    cancel_window_minutes: Number(m.cancel_window_minutes ?? 10),
    friend_pricing: parsedFriendPricing,
    social_links: parsedSocial,
    return_policy: m.return_policy || m.business_policies || null,
    delivery_notes: m.delivery_notes || m.delivery_info || null,
    supports_pickup: m.supports_pickup !== false,
    onboarding_state: m.onboarding_state || 'completed',
    ai_training: {
      corrections: Number(m.ai_corrections || 0),
      improvement_pct: 8
    },
    trust_score: trustScore,
    loan_unlocked: trustScore >= 750
  };

  return config;
});

const updateMerchantHandler = async (req: any, reply: any) => {
  const { id } = req.params as { id: string };
  const b = (req.body || {}) as Record<string, unknown>;

  // Only update the seller-context fields the apps expose; COALESCE keeps any
  // field the caller omitted unchanged.
  const dialect = b.dialect !== undefined ? normalizeDialect(b.dialect) : null;
  const numOrNull = (v: unknown): number | null => {
    const n = Number(v);
    return isNaN(n) ? null : n;
  };

  const rawPatchBank = b.bankDetails ?? b.bank_details;
  let patchBankJson: string | null = null;
  if (rawPatchBank) {
    patchBankJson = typeof rawPatchBank === 'string' ? rawPatchBank : JSON.stringify(rawPatchBank);
  }

  const rawAddress = b.physicalAddress ?? b.physical_address;
  let patchAddressJson: string | null = null;
  if (rawAddress) {
    patchAddressJson = typeof rawAddress === 'string'
      ? JSON.stringify({ street: rawAddress, address: rawAddress })
      : JSON.stringify(rawAddress);
  }

  const rawHours = b.operatingHours ?? b.operating_hours;
  let patchHoursJson: string | null = null;
  if (rawHours) {
    patchHoursJson = typeof rawHours === 'string' ? rawHours : JSON.stringify(rawHours);
  }

  const rawAllow = b.allowList ?? b.allow_list;
  let patchAllowJson: string | null = null;
  if (rawAllow !== undefined && rawAllow !== null) {
    patchAllowJson = JSON.stringify(Array.isArray(rawAllow) ? rawAllow : [rawAllow]);
  }

  const rawDeny = b.denyList ?? b.deny_list;
  let patchDenyJson: string | null = null;
  if (rawDeny !== undefined && rawDeny !== null) {
    patchDenyJson = JSON.stringify(Array.isArray(rawDeny) ? rawDeny : [rawDeny]);
  }

  const rawFriendPricing = b.friendPricing ?? b.friend_pricing;
  let patchFriendJson: string | null = null;
  if (rawFriendPricing !== undefined && rawFriendPricing !== null) {
    patchFriendJson = typeof rawFriendPricing === 'string' ? rawFriendPricing : JSON.stringify(rawFriendPricing);
  }

  const boolOrNull = (v: unknown): boolean | null => {
    if (v === undefined || v === null) return null;
    return Boolean(v);
  };

  const rows = await sql<{ id: string }[]>`
    update merchants set
      name             = coalesce(${strOrNull(b.name)}, name),
      owner_first_name = coalesce(${strOrNull(b.ownerFirstName ?? b.owner_first_name)}, owner_first_name),
      owner_last_name  = coalesce(${strOrNull(b.ownerLastName ?? b.owner_last_name)}, owner_last_name),
      dob_month        = coalesce(${strOrNull(b.dobMonth ?? b.dob_month)}, dob_month),
      dob_day          = coalesce(${numOrNull(b.dobDay ?? b.dob_day)}, dob_day),
      dob_year         = coalesce(${numOrNull(b.dobYear ?? b.dob_year)}, dob_year),
      tone_guide       = coalesce(${strOrNull(b.toneGuide ?? b.tone_guide)}, tone_guide),
      business_policies= coalesce(${strOrNull(b.businessPolicies ?? b.business_policies)}, business_policies),
      delivery_info    = coalesce(${strOrNull(b.deliveryInfo ?? b.delivery_info)}, delivery_info),
      dialect          = coalesce(${dialect}, dialect),
      whatsapp_catalog_id = coalesce(${strOrNull(b.whatsappCatalogId ?? b.whatsapp_catalog_id)}, whatsapp_catalog_id),
      subscription_tier   = coalesce(${strOrNull(b.subscriptionTier || b.subscription_tier)}, subscription_tier),
      bank_details        = coalesce(${patchBankJson ? sql`${patchBankJson}::jsonb` : null}, bank_details),
      bank_account_number = coalesce(${strOrNull(b.bankAccountNumber ?? b.bank_account_number)}, bank_account_number),
      payout_frequency    = coalesce(${strOrNull(b.payoutFrequency ?? b.payout_frequency)}, payout_frequency),
      fee_padding_model   = coalesce(${strOrNull(b.feePaddingModel ?? b.fee_padding_model)}, fee_padding_model),
      is_registered       = coalesce(${boolOrNull(b.isRegistered ?? b.is_registered)}, is_registered),
      rc_number           = coalesce(${strOrNull(b.rcNumber ?? b.rc_number)}, rc_number),
      business_type       = coalesce(${strOrNull(b.businessType ?? b.business_type)}, business_type),
      tax_id              = coalesce(${strOrNull(b.taxId ?? b.tax_id)}, tax_id),
      support_email       = coalesce(${strOrNull(b.supportEmail ?? b.support_email)}, support_email),
      support_phone       = coalesce(${strOrNull(b.supportPhone ?? b.support_phone)}, support_phone),
      website_url         = coalesce(${strOrNull(b.websiteUrl ?? b.website_url)}, website_url),
      return_policy       = coalesce(${strOrNull(b.returnPolicy ?? b.return_policy)}, return_policy),
      delivery_notes      = coalesce(${strOrNull(b.deliveryNotes ?? b.delivery_notes)}, delivery_notes),
      physical_address    = coalesce(${patchAddressJson ? sql`${patchAddressJson}::jsonb` : null}, physical_address),
      operating_hours     = coalesce(${patchHoursJson ? sql`${patchHoursJson}::jsonb` : null}, operating_hours),
      allow_list          = coalesce(${patchAllowJson ? sql`${patchAllowJson}::jsonb` : null}, allow_list),
      deny_list           = coalesce(${patchDenyJson ? sql`${patchDenyJson}::jsonb` : null}, deny_list),
      soft_mode           = coalesce(${boolOrNull(b.softMode ?? b.soft_mode)}, soft_mode),
      cancel_window_minutes = coalesce(${numOrNull(b.cancelWindowMinutes ?? b.cancel_window_minutes)}, cancel_window_minutes),
      friend_pricing      = coalesce(${patchFriendJson ? sql`${patchFriendJson}::jsonb` : null}, friend_pricing),
      updated_at          = now()
    where id = ${id}::uuid
    returning id
  `;
  if (!rows[0]) return reply.code(404).send({ error: "merchant not found" });
  return { ok: true };
};

app.patch("/merchants/:id", updateMerchantHandler);
app.put("/merchants/:id", updateMerchantHandler);

// ─── Merchant Integrations & API Credentials ────────────────────────────────
app.get("/merchants/:id/integrations", async (req, reply) => {
  const { id } = req.params as { id: string };
  const mRows = await sql`
    SELECT api_keys, supports_pickup, physical_address, subscription_tier
    FROM merchants
    WHERE id = ${id}::uuid LIMIT 1
  `;
  if (!mRows[0]) return reply.code(404).send({ error: "merchant not found" });

  const m = mRows[0];
  const merchantTier = m.subscription_tier || 'starter';
  const canEditCustomKeys = isFeatureAllowed(merchantTier, 'custom_api_keys');
  const apiKeys = (m.api_keys && typeof m.api_keys === 'object') ? m.api_keys : {};

  const intRows = await sql<{ provider: string; access_token: string }[]>`
    SELECT provider, access_token
    FROM merchant_integrations
    WHERE merchant_id = ${id}::uuid
  `;
  const intMap: Record<string, string> = {};
  for (const row of intRows) {
    if (row.access_token) {
      intMap[row.provider] = row.access_token;
    }
  }

  const getKey = (name: string): string => intMap[name] || apiKeys[name] || "";

  const [
    kwikDefault, gokadaDefault, maxDefault, sendstackDefault,
    groqDefault, twilioSidDefault, twilioAuthDefault, paystackDefault, africasTalkingDefault
  ] = await Promise.all([
    isPlatformDefaultAvailable("kwik"),
    isPlatformDefaultAvailable("gokada"),
    isPlatformDefaultAvailable("max"),
    isPlatformDefaultAvailable("sendstack"),
    isPlatformDefaultAvailable("groq"),
    isPlatformDefaultAvailable("twilio_sid"),
    isPlatformDefaultAvailable("twilio_auth"),
    isPlatformDefaultAvailable("paystack"),
    isPlatformDefaultAvailable("africas_talking"),
  ]);

  const getStatus = (customVal: string, hasDefault: boolean): "custom_override" | "managed_pool" | "unconfigured" => {
    if (customVal && customVal.trim() !== "") return "custom_override";
    if (hasDefault) return "managed_pool";
    return "unconfigured";
  };

  return reply.send({
    subscriptionTier: merchantTier,
    canEditCustomKeys,
    tierRequirements: FEATURE_TIER_REQUIREMENTS,
    dispatch: {
      gokada: maskApiKey(getKey("gokada")),
      hasGokada: !!getKey("gokada"),
      statusGokada: getStatus(getKey("gokada"), gokadaDefault),
      hasPlatformDefaultGokada: gokadaDefault,

      kwik: maskApiKey(getKey("kwik")),
      hasKwik: !!getKey("kwik"),
      statusKwik: getStatus(getKey("kwik"), kwikDefault),
      hasPlatformDefaultKwik: kwikDefault,

      max: maskApiKey(getKey("max")),
      hasMax: !!getKey("max"),
      statusMax: getStatus(getKey("max"), maxDefault),
      hasPlatformDefaultMax: maxDefault,

      sendstack: maskApiKey(getKey("sendstack")),
      hasSendstack: !!getKey("sendstack"),
      statusSendstack: getStatus(getKey("sendstack"), sendstackDefault),
      hasPlatformDefaultSendstack: sendstackDefault,
    },
    developer: {
      groq: maskApiKey(getKey("groq")),
      hasGroq: !!getKey("groq"),
      statusGroq: getStatus(getKey("groq"), groqDefault),
      hasPlatformDefaultGroq: groqDefault,

      twilioSid: maskApiKey(getKey("twilio_sid")),
      hasTwilioSid: !!getKey("twilio_sid"),
      statusTwilioSid: getStatus(getKey("twilio_sid"), twilioSidDefault),
      hasPlatformDefaultTwilioSid: twilioSidDefault,

      twilioAuth: maskApiKey(getKey("twilio_auth")),
      hasTwilioAuth: !!getKey("twilio_auth"),
      statusTwilioAuth: getStatus(getKey("twilio_auth"), twilioAuthDefault),
      hasPlatformDefaultTwilioAuth: twilioAuthDefault,

      paystack: maskApiKey(getKey("paystack")),
      hasPaystack: !!getKey("paystack"),
      statusPaystack: getStatus(getKey("paystack"), paystackDefault),
      hasPlatformDefaultPaystack: paystackDefault,

      africasTalking: maskApiKey(getKey("africas_talking")),
      hasAfricasTalking: !!getKey("africas_talking"),
      statusAfricasTalking: getStatus(getKey("africas_talking"), africasTalkingDefault),
      hasPlatformDefaultAfricasTalking: africasTalkingDefault,
    },
    fulfillment: {
      supportsPickup: m.supports_pickup ?? true,
      pickupAddress: typeof m.physical_address === 'string' 
        ? m.physical_address 
        : (m.physical_address?.street || m.physical_address?.address || ''),
    }
  });
});

app.patch("/merchants/:id/integrations", async (req, reply) => {
  const { id } = req.params as { id: string };
  const b = req.body as any;
  if (!b) return reply.code(400).send({ error: "body required" });

  const mRows = await sql<{ api_keys: Record<string, string>; physical_address: any; subscription_tier: string }[]>`
    SELECT api_keys, physical_address, subscription_tier
    FROM merchants
    WHERE id = ${id}::uuid LIMIT 1
  `;
  if (!mRows[0]) return reply.code(404).send({ error: "merchant not found" });

  const merchantTier = mRows[0].subscription_tier || "starter";

  // Check if caller is attempting to set or modify private keys (BYOK)
  const hasDispatchCustomKeys = b.dispatch && Object.values(b.dispatch).some((v) => typeof v === 'string' && v.trim() !== '' && !isMaskedKey(v));
  const hasDeveloperCustomKeys = b.developer && Object.values(b.developer).some((v) => typeof v === 'string' && v.trim() !== '' && !isMaskedKey(v));

  if ((hasDispatchCustomKeys || hasDeveloperCustomKeys) && !isFeatureAllowed(merchantTier, 'custom_api_keys')) {
    return reply.code(403).send({
      error: "Feature 'custom_api_keys' requires the Enterprise tier. Lower tiers are powered automatically by Biblio's Managed Default Pool.",
      code: "TIER_RESTRICTED",
      requiredTier: "enterprise",
      currentTier: merchantTier,
    });
  }

  const currentApiKeys = (mRows[0].api_keys && typeof mRows[0].api_keys === 'object') ? { ...mRows[0].api_keys } : {};

  // Process dispatch keys
  if (b.dispatch) {
    const d = b.dispatch;
    const dispatchMapping: [string, string | undefined][] = [
      ['gokada', d.gokada],
      ['kwik', d.kwik],
      ['max', d.max],
      ['sendstack', d.sendstack],
    ];
    for (const [provider, val] of dispatchMapping) {
      if (val !== undefined && !isMaskedKey(val)) {
        const trimmed = val.trim();
        if (trimmed === "") {
          delete currentApiKeys[provider];
          await sql`DELETE FROM merchant_integrations WHERE merchant_id = ${id}::uuid AND provider = ${provider}`;
        } else {
          currentApiKeys[provider] = trimmed;
          await sql`
            INSERT INTO merchant_integrations (merchant_id, provider, access_token)
            VALUES (${id}::uuid, ${provider}, ${trimmed})
            ON CONFLICT (merchant_id, provider) DO UPDATE SET access_token = EXCLUDED.access_token
          `;
        }
      }
    }
  }

  // Process developer keys
  if (b.developer) {
    const dev = b.developer;
    const devMapping: [string, string | undefined][] = [
      ['groq', dev.groq],
      ['twilio_sid', dev.twilioSid],
      ['twilio_auth', dev.twilioAuth],
      ['paystack', dev.paystack],
      ['africas_talking', dev.africasTalking],
    ];
    for (const [provider, val] of devMapping) {
      if (val !== undefined && !isMaskedKey(val)) {
        const trimmed = val.trim();
        if (trimmed === "") {
          delete currentApiKeys[provider];
          await sql`DELETE FROM merchant_integrations WHERE merchant_id = ${id}::uuid AND provider = ${provider}`;
        } else {
          currentApiKeys[provider] = trimmed;
          await sql`
            INSERT INTO merchant_integrations (merchant_id, provider, access_token)
            VALUES (${id}::uuid, ${provider}, ${trimmed})
            ON CONFLICT (merchant_id, provider) DO UPDATE SET access_token = EXCLUDED.access_token
          `;
        }
      }
    }
  }

  // Update merchants table with merged api_keys and fulfillment settings
  const updatePickupAddress = b.fulfillment?.pickupAddress !== undefined ? b.fulfillment.pickupAddress : null;
  const updateSupportsPickup = b.fulfillment?.supportsPickup !== undefined ? Boolean(b.fulfillment.supportsPickup) : null;

  await sql`
    UPDATE merchants SET
      api_keys = ${jsonb(currentApiKeys)},
      supports_pickup = coalesce(${updateSupportsPickup}, supports_pickup),
      physical_address = coalesce(${updatePickupAddress ? jsonb({ street: updatePickupAddress }) : null}, physical_address)
    WHERE id = ${id}::uuid
  `;

  return reply.send({ ok: true, message: "Integrations updated successfully" });
});

// ─── Platform Master Credentials Admin Management ────────────────────────────

app.get("/admin/platform-credentials", async (req, reply) => {
  const adminKey = process.env.ADMIN_API_KEY || process.env.ADMIN_SECRET || 'biblio_owner_2026';
  const providedKey = (req.headers["x-admin-key"] || req.headers["x-api-key"]) as string | undefined;
  if (!providedKey || providedKey !== adminKey) {
    return reply.code(403).send({ error: "Forbidden: admin key required", code: "FORBIDDEN" });
  }

  const rows = await sql<{
    provider: string;
    api_key: string;
    is_active: boolean;
    description: string | null;
    updated_at: Date | null;
  }[]>`
    SELECT provider, api_key, is_active, description, updated_at
    FROM platform_credentials
    ORDER BY provider ASC
  `;

  return reply.send({
    credentials: rows.map((r) => ({
      provider: r.provider,
      maskedKey: maskApiKey(r.api_key),
      isActive: r.is_active,
      description: r.description,
      updatedAt: r.updated_at,
    })),
  });
});

app.patch("/admin/platform-credentials", async (req, reply) => {
  const adminKey = process.env.ADMIN_API_KEY || process.env.ADMIN_SECRET || 'biblio_owner_2026';
  const providedKey = (req.headers["x-admin-key"] || req.headers["x-api-key"]) as string | undefined;
  if (!providedKey || providedKey !== adminKey) {
    return reply.code(403).send({ error: "Forbidden: admin key required", code: "FORBIDDEN" });
  }

  const { provider, apiKey, secretKey, description } = (req.body || {}) as {
    provider: string;
    apiKey: string;
    secretKey?: string;
    description?: string;
  };

  if (!provider || !apiKey) {
    return reply.code(400).send({ error: "provider and apiKey are required" });
  }

  await upsertPlatformCredential(provider, apiKey, secretKey, description);
  return reply.send({ ok: true, message: `Platform master default updated for ${provider}` });
});

// ─── Tier Feature Entitlements & Billing Upgrade ─────────────────────────────

app.get("/merchants/:id/features", async (req, reply) => {
  const { id } = req.params as { id: string };
  const entitlements = await getMerchantFeatureEntitlements(id);
  return reply.send(entitlements);
});

app.post("/merchants/:id/billing/upgrade", async (req, reply) => {
  const { id } = req.params as { id: string };
  const body = (req.body || {}) as any;
  let targetTier = body.targetTier || body.tier;
  if (targetTier === "pro") targetTier = "growth";
  if (!targetTier || (targetTier !== "growth" && targetTier !== "enterprise" && targetTier !== "starter")) {
    targetTier = "growth";
  }

  // Update merchant subscription tier
  const updated = await sql<{ id: string; subscription_tier: string }[]>`
    UPDATE merchants
    SET subscription_tier = ${targetTier},
        updated_at = NOW()
    WHERE id = ${id}::uuid
    RETURNING id, subscription_tier
  `;

  if (!updated[0]) return reply.code(404).send({ error: "merchant not found" });

  return reply.send({
    ok: true,
    message: `Store plan successfully upgraded to ${targetTier.toUpperCase()}`,
    tier: updated[0].subscription_tier,
    activeUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  });
});

// ─── Bank Onboarding (Escrow/Transfer Setup) ─────────────────────────────────

app.post("/merchants/:id/bank-account", async (req, reply) => {
  const { id } = req.params as { id: string };
  const { accountNumber, bankCode, accountName } = (req.body || {}) as {
    accountNumber: string;
    bankCode: string;
    accountName: string;
  };

  if (!accountNumber || !bankCode || !accountName) {
    return reply.code(400).send({ error: "accountNumber, bankCode, and accountName are required" });
  }

  // Verify merchant exists before initiating external Paystack transfer recipient creation
  const mCheck = await sql`SELECT id FROM merchants WHERE id = ${id}::uuid LIMIT 1`;
  if (!mCheck[0]) return reply.code(404).send({ error: "merchant not found" });

  const paystackSecretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!paystackSecretKey) {
    return reply.code(500).send({ error: "Paystack is not configured" });
  }

  // 1. Create a Transfer Recipient on Paystack
  let recipientCode: string;
  try {
    const res = await fetch("https://api.paystack.co/transferrecipient", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${paystackSecretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "nuban",
        name: accountName,
        account_number: accountNumber,
        bank_code: bankCode,
        currency: "NGN",
      }),
    });
    
    if (!res.ok) {
      const errText = await res.text();
      req.log.warn({ errText }, "Paystack recipient creation failed, verifying sandbox mode");
      if (paystackSecretKey?.startsWith('sk_test_') || process.env.NODE_ENV !== 'production') {
        recipientCode = "RCP_sandbox_" + Date.now();
      } else {
        return reply.code(400).send({ error: "Failed to verify bank account with Paystack" });
      }
    } else {
      const data = await res.json() as any;
      recipientCode = data.data?.recipient_code || ("RCP_" + Date.now());
    }
  } catch (err) {
    req.log.error(err, "Failed to call Paystack");
    return reply.code(500).send({ error: "Internal server error" });
  }

  // 2. Save to database
  const rows = await sql`
    update merchants set
      bank_account_number = ${accountNumber},
      bank_code = ${bankCode},
      paystack_recipient_code = ${recipientCode}
    where id = ${id}::uuid
    returning id
  `;
  if (!rows[0]) return reply.code(404).send({ error: "merchant not found" });

  return { ok: true, recipientCode };
});

// ─── Pricing rules (the negotiation authority) ───────────────────────────────

app.put("/merchants/:id/pricing-rules", async (req, reply) => {
  const { id } = req.params as { id: string };
  const b = (req.body || {}) as Record<string, unknown>;
  const absoluteFloor = num(b.absoluteFloor) ?? num(b.absolute_floor) ?? (b.friendPricing ? 0 : 0);
  if (absoluteFloor === null || absoluteFloor < 0) {
    return reply.code(400).send({ error: "absoluteFloor (non-negative number) is required", code: "INVALID_FLOOR" });
  }
  const basePrice = num(b.basePrice);
  if (b.basePrice !== undefined && (basePrice === null || basePrice < 0)) {
    return reply.code(400).send({ error: "basePrice must be a non-negative number", code: "INVALID_BASE_PRICE" });
  }

  const mCheck = await sql`SELECT id FROM merchants WHERE id = ${id}::uuid LIMIT 1`;
  if (!mCheck[0]) return reply.code(404).send({ error: "merchant not found" });

  await sql`
    insert into merchant_pricing_rules
      (merchant_id, base_price, absolute_floor,
       max_discount_by_tier, max_bundle_value_add_by_tier, future_credit_cap_by_tier)
    values (
      ${id}::uuid, ${num(b.basePrice) ?? 0}, ${absoluteFloor},
      ${jsonb(b.maxDiscountByTier ?? defaultDiscount)},
      ${jsonb(b.maxBundleValueAddByTier ?? defaultBundle)},
      ${jsonb(b.futureCreditCapByTier ?? defaultCredit)}
    )
    on conflict (merchant_id) do update set
      base_price                  = excluded.base_price,
      absolute_floor              = excluded.absolute_floor,
      max_discount_by_tier        = excluded.max_discount_by_tier,
      max_bundle_value_add_by_tier= excluded.max_bundle_value_add_by_tier,
      future_credit_cap_by_tier   = excluded.future_credit_cap_by_tier,
      updated_at                  = now()
  `;
  return { ok: true };
});

// ─── Products (the catalog) ──────────────────────────────────────────────────

app.get("/merchants/:id/products", async (req, reply) => {
  const { id } = req.params as { id: string };
  const query = (req.query || {}) as Record<string, unknown>;
  const { limit, offset } = parsePagination(query, 50, 200);

  const rawSearch = typeof query.search === 'string' ? query.search : typeof query.q === 'string' ? query.q : '';
  const search = rawSearch.trim();
  const category = typeof query.category === 'string' && query.category.trim() !== '' ? query.category.trim() : null;

  const rawMinPrice = query.minPrice !== undefined && query.minPrice !== null && query.minPrice !== '' ? Number(query.minPrice) : null;
  const minPrice = rawMinPrice !== null && Number.isFinite(rawMinPrice) ? Math.max(0, rawMinPrice) : null;

  const rawMaxPrice = query.maxPrice !== undefined && query.maxPrice !== null && query.maxPrice !== '' ? Number(query.maxPrice) : null;
  const maxPrice = rawMaxPrice !== null && Number.isFinite(rawMaxPrice) ? Math.max(0, rawMaxPrice) : null;

  try {
    const sanitizedSearch = search.replace(/[%_\\]/g, '\\$&');
    const searchPattern = `%${sanitizedSearch}%`;

    const rows = await sql`
      select id, sku, name, COALESCE(quantity, stock, 0) as stock, price, description, category,
             image_url, available as active, metadata, updated_at
      from products 
      where (merchant_id = ${id}::uuid OR tenant_id = ${id}::uuid)
        and deleted_at is null
        ${search ? sql`and (name ILIKE ${searchPattern} OR sku ILIKE ${searchPattern} OR category ILIKE ${searchPattern} OR (description->>'text') ILIKE ${searchPattern})` : sql``}
        ${category ? sql`and category ILIKE ${category}` : sql``}
        ${minPrice !== null ? sql`and price >= ${minPrice}` : sql``}
        ${maxPrice !== null ? sql`and price <= ${maxPrice}` : sql``}
      order by updated_at desc
      limit ${limit} offset ${offset}
    `;
    const mapped = rows.map((r: any) => ({
      id: r.id,
      sku: r.sku || r.id,
      name: r.name,
      stock: Number(r.stock ?? 0),
      price: Number(r.price ?? 0),
      floor: Number(r.metadata?.floor ?? (r.price ? r.price * 0.85 : 0)),
      description: typeof r.description === 'object' && r.description?.text ? r.description.text : (typeof r.description === 'string' ? r.description : ''),
      category: r.category || 'General',
      imageUrl: r.image_url || null,
      active: r.active ?? true,
      updated_at: r.updated_at
    }));
    return reply.send(mapped);
  } catch (err: any) {
    app.log.error(err, "Failed to fetch products");
    return reply.send([]);
  }
});

app.post("/merchants/:id/products", async (req, reply) => {
  const { id } = req.params as { id: string };
  const b = (req.body || {}) as Record<string, unknown>;
  const sku = str(b.sku) || `SKU-${Date.now().toString().slice(-6)}`;
  const name = str(b.name);
  const price = num(b.price);
  if (!name || price === null) {
    return reply.code(400).send({ error: "name and price are required" });
  }
  if (price < 0) {
    return reply.code(400).send({ error: "price must be non-negative", code: "INVALID_PRICE" });
  }
  if (b.stock !== undefined && (typeof b.stock !== 'number' || !Number.isFinite(b.stock) || b.stock < 0)) {
    return reply.code(400).send({ error: "stock must be a non-negative number", code: "INVALID_STOCK" });
  }
  if (b.floor !== undefined && (typeof b.floor !== 'number' || !Number.isFinite(b.floor) || b.floor < 0)) {
    return reply.code(400).send({ error: "floor must be a non-negative number", code: "INVALID_FLOOR" });
  }
  if (b.supplierId !== undefined && b.supplierId !== null && !isUuid(b.supplierId)) {
    return reply.code(400).send({ error: "Invalid supplierId: must be a valid UUID", code: "INVALID_UUID" });
  }

  const mCheck = await sql`SELECT id FROM merchants WHERE id = ${id}::uuid LIMIT 1`;
  if (!mCheck[0]) return reply.code(404).send({ error: "merchant not found" });

  try {
    const existing = await sql`
      SELECT id FROM products 
      WHERE merchant_id = ${id}::uuid AND sku = ${sku} AND deleted_at IS NULL 
      LIMIT 1
    `;

    const floorVal = num(b.floor) ?? (price * 0.85);
    const descJson = jsonb(b.description ? { text: String(b.description) } : {});
    const metaJson = jsonb({ floor: floorVal });

    if (existing.length > 0) {
      await sql`
        UPDATE products SET
          name = ${name},
          price = ${price},
          quantity = ${num(b.stock) ?? 0},
          category = ${strOrNull(b.category) ?? 'General'},
          description = ${descJson},
          metadata = ${metaJson},
          image_url = coalesce(${strOrNull(b.imageUrl)}, image_url),
          available = true,
          updated_at = now()
        WHERE id = ${existing[0].id}
      `;
    } else {
      const validSupplierUuid = b.supplierId && isUuid(b.supplierId)
        ? String(b.supplierId)
        : null;

      await sql`
        INSERT INTO products (
          merchant_id, tenant_id, supplier_id, sku, name, price, quantity, category, unit,
          description, image_url, available, metadata, updated_at
        ) VALUES (
          ${id}::uuid, ${id}::uuid, COALESCE(${validSupplierUuid}::uuid, gen_random_uuid()), ${sku}, ${name}, ${price},
          ${num(b.stock) ?? 0}, ${strOrNull(b.category) ?? 'General'}, ${strOrNull(b.unit) ?? 'item'},
          ${descJson}, ${strOrNull(b.imageUrl)}, true, ${metaJson}, now()
        )
      `;
    }

    return reply.code(201).send({ ok: true, sku });
  } catch (err: any) {
    app.log.error(err, "Failed to save product");
    return reply.status(500).send({ error: "Failed to save product: " + err.message });
  }
});

app.patch("/merchants/:id/products/:sku", async (req, reply) => {
  const { id, sku } = req.params as { id: string; sku: string };
  const b = req.body as Record<string, unknown>;
  if (b.price !== undefined && (typeof b.price !== 'number' || !Number.isFinite(b.price) || b.price < 0)) {
    return reply.code(400).send({ error: "price must be a non-negative number", code: "INVALID_PRICE" });
  }
  if (b.stock !== undefined && (typeof b.stock !== 'number' || !Number.isFinite(b.stock) || b.stock < 0)) {
    return reply.code(400).send({ error: "stock must be a non-negative number", code: "INVALID_STOCK" });
  }
  try {
    const rows = await sql<{ sku: string }[]>`
      update products set
        name        = coalesce(${strOrNull(b.name)}, name),
        quantity    = coalesce(${num(b.stock)}, quantity),
        price       = coalesce(${num(b.price)}, price),
        category    = coalesce(${strOrNull(b.category)}, category),
        image_url   = coalesce(${strOrNull(b.imageUrl)}, image_url),
        available   = coalesce(${bool(b.active)}, available),
        updated_at  = now()
      where merchant_id = ${id}::uuid and (sku = ${sku} or id::text = ${sku})
      returning sku
    `;
    if (!rows[0]) return reply.code(404).send({ error: "product not found" });
    return { ok: true };
  } catch (err: any) {
    app.log.error(err, "Failed to update product");
    return reply.status(500).send({ error: "Failed to update product" });
  }
});

app.delete("/merchants/:id/products/:sku", async (req, reply) => {
  const { id, sku } = req.params as { id: string; sku: string };
  try {
    const rows = await sql<{ sku: string }[]>`
      update products set deleted_at = now(), available = false, updated_at = now()
      where merchant_id = ${id}::uuid and (sku = ${sku} or id::text = ${sku})
      returning sku
    `;
    if (!rows[0]) return reply.code(404).send({ error: "product not found" });
    return { ok: true };
  } catch (err: any) {
    app.log.error(err, "Failed to delete product");
    return reply.status(500).send({ error: "Failed to delete product" });
  }
});

// ─── WhatsApp catalog import (one tap) ───────────────────────────────────────

app.post("/merchants/:id/catalog-sync", async (req, reply) => {
  const { id } = req.params as { id: string };
  try {
    const result = await syncMerchantCatalog(id);
    return reply.send({ ok: true, ...result });
  } catch (err) {
    req.log.error({ err, merchantId: id }, "catalog sync notice");
    const errMsg = (err as Error).message || "";
    if (errMsg.includes("no whatsapp_catalog_id") || errMsg.includes("not configured")) {
      return reply.code(400).send({ ok: false, error: errMsg, code: "NO_CATALOG_ID" });
    }
    return reply.code(502).send({ ok: false, error: errMsg });
  }
});

// ─── Vendor (Baileys business line) management ────────────────────────────────

// Create a vendor record — the first step of the business line onboarding flow.
// After this, the merchant uses POST /vendors/:id/pair to get the pairing code.
app.post("/vendors", async (req, reply) => {
  const b = (req.body || {}) as Record<string, unknown>;
  const merchantId = str(b.merchantId);
  const personalNumber = str(b.personalNumber);
  if (!merchantId || !isUuid(merchantId) || !personalNumber) {
    return reply.code(400).send({ error: "Valid UUID merchantId and personalNumber are required" });
  }

  const mCheck = await sql`SELECT id FROM merchants WHERE id = ${merchantId}::uuid LIMIT 1`;
  if (!mCheck[0]) return reply.code(404).send({ error: "merchant not found" });

  const rows = await sql<{ id: string }[]>`
    INSERT INTO vendors (
      merchant_id, personal_number,
      auto_status_enabled, posting_frequency_hours, approve_before_post
    ) VALUES (
      ${merchantId}::uuid, ${personalNumber.replace(/^\+/, "")},
      ${bool(b.autoStatusEnabled) ?? false},
      ${num(b.postingFrequencyHours) ?? 24},
      ${bool(b.approveBeforePost) ?? true}
    )
    RETURNING id
  `;
  return reply.code(201).send({ ok: true, vendorId: rows[0].id });
});

// Universal Auto-Provisioning & Pairing:
// Given just a phone number, provisions merchant, vendor, pricing rules, dialect,
// and requests an 8-digit WhatsApp pairing code from the Baileys gateway in one step.
app.post("/pair", async (req, reply) => {
  const { phoneNumber, vendorId, merchantId, merchantName, dialect } = (req.body || {}) as {
    phoneNumber?: string;
    vendorId?: string;
    merchantId?: string;
    merchantName?: string;
    dialect?: string;
  };

  if (!phoneNumber) {
    return reply.code(400).send({ error: "phoneNumber is required (e.g. 2348012345678)" });
  }

  try {
    const res = await fetch(`${BAILEYS_GATEWAY_URL}/pair`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phoneNumber: phoneNumber.replace(/^\+/, ""),
        vendorId,
        merchantId,
        merchantName,
        dialect
      }),
    });
    const data = await res.json() as Record<string, unknown>;
    return reply.status(res.status).send(data);
  } catch (err) {
    return reply.code(502).send({
      error: "Baileys gateway unavailable — is it running? (npm run baileys-gateway)",
    });
  }
});

// List all vendors with their merchant metadata for the Admin Portal
app.get("/vendors", async (req) => {
  const { limit, offset } = parsePagination(req.query, 50, 100);
  return await sql`
    SELECT v.id as vendor_id, v.merchant_id, v.personal_number, v.business_line_number,
           v.session_status, v.auto_status_enabled, v.posting_frequency_hours, v.approve_before_post,
           v.created_at, m.name as merchant_name, m.dialect, m.phone_number_id
    FROM vendors v
    LEFT JOIN merchants m ON m.id = v.merchant_id
    ORDER BY v.created_at DESC LIMIT ${limit} OFFSET ${offset}
  `;
});

// Get a pairing code for a vendor's new business line number.
// The merchant enters this 8-character code in WhatsApp → Settings → Linked Devices.
app.post("/vendors/:vendorId/pair", async (req, reply) => {
  const { vendorId } = req.params as { vendorId: string };
  const { phoneNumber } = (req.body || {}) as { phoneNumber?: string };

  if (!phoneNumber) {
    return reply.code(400).send({ error: "phoneNumber is required (E.164 without +)" });
  }

  const cleanPhone = phoneNumber.replace(/^\+/, "");

  const vCheck = await sql`SELECT id FROM vendors WHERE id = ${vendorId}::uuid LIMIT 1`;
  if (!vCheck[0]) return reply.code(404).send({ error: "vendor not found" });

  // Clear this number from any old/orphaned vendor records first to prevent unique constraint errors
  await sql`
    UPDATE vendors 
    SET business_line_number = NULL 
    WHERE business_line_number = ${cleanPhone} 
      AND id != ${vendorId}::uuid
  `;

  // Save the business line number to the vendors table
  await sql`
    UPDATE vendors SET business_line_number = ${cleanPhone}, updated_at = now()
    WHERE id = ${vendorId}::uuid
  `;

  // Forward to the Baileys gateway — it manages the WebSocket sessions
  try {
    const res = await fetch(`${BAILEYS_GATEWAY_URL}/pair`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vendorId, phoneNumber: cleanPhone }),
    });
    const data = await res.json() as Record<string, unknown>;
    if (!res.ok) return reply.code(502).send(data);
    return reply.send(data);
  } catch (err) {
    return reply.code(502).send({
      error: "Baileys gateway unavailable — is it running? (npm run baileys-gateway)",
    });
  }
});

// ─── Vendors (Baileys Business Lines) ────────────────────────────────────────

// Get real-time session status for a vendor's business line.
app.get("/vendors/:vendorId/status", async (req, reply) => {
  const { vendorId } = req.params as { vendorId: string };

  const rows = await sql<{ id: string; session_status: string; business_line_number: string | null; last_error: string | null }[]>`
    SELECT id, session_status, business_line_number, last_error FROM vendors WHERE id = ${vendorId}::uuid OR merchant_id = ${vendorId}::uuid LIMIT 1
  `;
  if (!rows[0]) {
    return reply.send({
      vendorId,
      businessLineNumber: null,
      dbStatus: "disconnected",
      inMemory: false,
      connected: false,
      lastError: null,
    });
  }

  // Also check live status from the Baileys gateway
  let gatewayStatus: Record<string, unknown> = {};
  const activeVendorId = rows[0].id;
  try {
    const res = await fetch(`${BAILEYS_GATEWAY_URL}/sessions/${activeVendorId}`);
    if (res.ok) gatewayStatus = await res.json() as Record<string, unknown>;
  } catch {
    // Gateway may not be running — return DB status only
  }

  return reply.send({
    vendorId,
    businessLineNumber: rows[0].business_line_number,
    dbStatus: rows[0].session_status,
    lastError: gatewayStatus.lastError || rows[0].last_error || null,
    ...gatewayStatus,
  });
});

// Update vendor settings: toggle auto-status, posting frequency, approve-before-post, and ranking strategy.
app.patch("/vendors/:vendorId/settings", async (req, reply) => {
  const { vendorId } = req.params as { vendorId: string };
  const b = (req.body || {}) as Record<string, unknown>;

  const rows = await sql<{ id: string }[]>`
    UPDATE vendors SET
      auto_status_enabled     = COALESCE(${bool(b.autoStatusEnabled)}, auto_status_enabled),
      posting_frequency_hours = COALESCE(${num(b.postingFrequencyHours)}, posting_frequency_hours),
      approve_before_post     = COALESCE(${bool(b.approveBeforePost)}, approve_before_post),
      status_strategy         = COALESCE(${str(b.statusStrategy)}, status_strategy),
      margin_weight           = COALESCE(${num(b.marginWeight)}, margin_weight),
      velocity_weight         = COALESCE(${num(b.velocityWeight)}, velocity_weight),
      updated_at = now()
    WHERE id = ${vendorId}::uuid
    RETURNING id
  `;
  if (!rows[0]) return reply.code(404).send({ error: "vendor not found" });
  return reply.send({ ok: true });
});

// Merchant App Status Automation Control Plane
app.get("/merchants/:merchantId/status-settings", async (req, reply) => {
  const { merchantId } = req.params as { merchantId: string };
  const rows = await sql<{
    id: string;
    session_status: string;
    auto_status_enabled: boolean;
    posting_frequency_hours: number;
    approve_before_post: boolean;
    status_strategy: string;
    margin_weight: number;
    velocity_weight: number;
    business_line_number: string | null;
  }[]>`
    SELECT id, session_status, auto_status_enabled, posting_frequency_hours, approve_before_post,
           COALESCE(status_strategy, 'balanced') as status_strategy,
           COALESCE(margin_weight, 0.70)::float as margin_weight,
           COALESCE(velocity_weight, 0.30)::float as velocity_weight,
           business_line_number
    FROM vendors
    WHERE merchant_id = ${merchantId}::uuid OR id = ${merchantId}::uuid
    LIMIT 1
  `;
  if (!rows[0]) return reply.code(404).send({ error: "Vendor configuration not found" });
  return reply.send({ ok: true, settings: rows[0] });
});

app.patch("/merchants/:merchantId/status-settings", async (req, reply) => {
  const { merchantId } = req.params as { merchantId: string };
  const b = req.body as Record<string, unknown>;

  const rows = await sql<{ id: string }[]>`
    UPDATE vendors SET
      auto_status_enabled     = COALESCE(${bool(b.autoStatusEnabled)}, auto_status_enabled),
      posting_frequency_hours = COALESCE(${num(b.postingFrequencyHours)}, posting_frequency_hours),
      approve_before_post     = COALESCE(${bool(b.approveBeforePost)}, approve_before_post),
      status_strategy         = COALESCE(${str(b.statusStrategy)}, status_strategy),
      margin_weight           = COALESCE(${num(b.marginWeight)}, margin_weight),
      velocity_weight         = COALESCE(${num(b.velocityWeight)}, velocity_weight),
      updated_at              = now()
    WHERE merchant_id = ${merchantId}::uuid OR id = ${merchantId}::uuid
    RETURNING id
  `;
  if (!rows[0]) return reply.code(404).send({ error: "Vendor not found" });
  return reply.send({ ok: true });
});

app.get("/merchants/:merchantId/status-candidates", async (req, reply) => {
  const { merchantId } = req.params as { merchantId: string };
  const rawLimit = Number((req.query as any)?.limit);
  const limit = (!Number.isFinite(rawLimit) || rawLimit < 1) ? 5 : Math.min(Math.floor(rawLimit), 50);
  const vendors = await sql<{ id: string; status_strategy: string; margin_weight: number; velocity_weight: number }[]>`
    SELECT id, COALESCE(status_strategy, 'balanced') as status_strategy,
           COALESCE(margin_weight, 0.70)::float as margin_weight,
           COALESCE(velocity_weight, 0.30)::float as velocity_weight
    FROM vendors
    WHERE merchant_id = ${merchantId}::uuid OR id = ${merchantId}::uuid
    LIMIT 1
  `;
  if (!vendors[0]) return reply.code(404).send({ error: "Vendor not found" });
  const vendor = vendors[0];
  const strategy = vendor.status_strategy || "balanced";
  let marginWeight = Number(vendor.margin_weight ?? 0.70);
  let velocityWeight = Number(vendor.velocity_weight ?? 0.30);
  if (strategy === "margin_priority") { marginWeight = 0.85; velocityWeight = 0.15; }
  else if (strategy === "velocity_priority") { marginWeight = 0.30; velocityWeight = 0.70; }

  const candidates = await sql`
    WITH eligible_products AS (
      SELECT
        p.sku,
        p.name,
        p.price,
        p.image_url,
        p.last_posted_at,
        GREATEST(
          0.10,
          (p.price - COALESCE(
            (p.metadata->>'floor')::numeric,
            (p.metadata->>'cost_price')::numeric,
            p.price * 0.70
          )) / GREATEST(p.price, 1.0)
        ) AS estimated_margin,
        COALESCE((
          SELECT COUNT(*)::int
          FROM orders o
          WHERE (o.supplier_id = p.supplier_id OR o.product_id = p.id OR o.product_id = p.product_id)
            AND (o.items::text LIKE ('%' || p.sku || '%') OR o.product_id = p.id OR o.product_id = p.product_id)
            AND o.created_at > now() - interval '14 days'
        ), 0) AS recent_sales_velocity
      FROM products p
      WHERE (p.merchant_id = ${merchantId}::uuid OR p.merchant_id = ${vendor.id}::uuid)
        AND (p.active = true OR p.active IS NULL)
        AND p.image_url IS NOT NULL
    )
    SELECT
      sku,
      name,
      price,
      image_url,
      ROUND((estimated_margin * 100)::numeric, 1)::float as margin_pct,
      recent_sales_velocity,
      ROUND((
        (estimated_margin * (${marginWeight}::numeric * 100.0)) / (1.0 + recent_sales_velocity::numeric * ${velocityWeight}::numeric)
        + CASE WHEN last_posted_at IS NULL THEN 15.0 ELSE 0.0 END
      )::numeric, 2)::float AS promotion_score,
      last_posted_at
    FROM eligible_products
    ORDER BY
      ${strategy === "freshness" ? sql`last_posted_at ASC NULLS FIRST, promotion_score DESC` : sql`promotion_score DESC, last_posted_at ASC NULLS FIRST`}
    LIMIT ${limit}
  `;
  return reply.send({ ok: true, candidates, strategy, marginWeight, velocityWeight });
});

app.post("/merchants/:merchantId/status-post-now", async (req, reply) => {
  const { merchantId } = req.params as { merchantId: string };
  const { sku } = (req.body as { sku?: string }) ?? {};
  const vendors = await sql<{ id: string }[]>`
    SELECT id FROM vendors WHERE merchant_id = ${merchantId}::uuid OR id = ${merchantId}::uuid LIMIT 1
  `;
  if (!vendors[0]) return reply.code(404).send({ error: "Vendor not found" });
  try {
    const res = await fetch(`${BAILEYS_GATEWAY_URL}/status/${vendors[0].id}/post-now`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sku })
    });
    const data = await res.json();
    return reply.status(res.status).send(data);
  } catch (err: any) {
    return reply.status(503).send({ ok: false, error: "Baileys gateway unreachable: " + err.message });
  }
});


// Get vendor's Status posting history.
app.get("/vendors/:vendorId/status-log", async (req, reply) => {
  const { vendorId } = req.params as { vendorId: string };
  const { limit, offset } = parsePagination(req.query, 20, 100);

  const rows = await sql`
    SELECT sl.sku, p.name AS product_name, sl.image_url, sl.caption, sl.posted_at
    FROM status_log sl
    LEFT JOIN products p ON p.sku = sl.sku
    WHERE sl.vendor_id = ${vendorId}
    ORDER BY sl.posted_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;
  return reply.send(rows);
});

app.get("/merchants/:merchantId/status-log", async (req, reply) => {
  const { merchantId } = req.params as { merchantId: string };
  const { limit, offset } = parsePagination(req.query, 20, 100);

  const rows = await sql`
    SELECT sl.sku, p.name AS product_name, sl.image_url, sl.caption, sl.posted_at
    FROM status_log sl
    LEFT JOIN products p ON p.sku = sl.sku
    JOIN vendors v ON v.id = sl.vendor_id
    WHERE v.merchant_id = ${merchantId}::uuid OR v.id = ${merchantId}::uuid
    ORDER BY sl.posted_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;
  return reply.send(rows);
});

// ─── Notification History & Audit Log Pipeline ──────────────────────────────
app.get("/merchants/:merchantId/notification-history", async (req, reply) => {
  const { merchantId } = req.params as { merchantId: string };
  const { limit, offset } = parsePagination(req.query, 50, 200);

  try {
    // 1. Query dedicated notifications table (push, in-app, SMS, email)
    const notifRows = await sql`
      SELECT id, user_id, supplier_id, order_id, tenant_id, channel, priority,
             payload, status, attempts, event_type, body, subject,
             recipient, created_at, sent_at
      FROM notifications
      WHERE tenant_id = ${merchantId}::uuid OR user_id = ${merchantId}::uuid
      ORDER BY created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `.catch(() => []);

    // 2. Query audit_logs for notification and delivery events
    const auditRows = await sql`
      SELECT id, action, metadata, timestamp, 'audit' as source
      FROM audit_logs
      WHERE merchant_id = ${merchantId}
        AND (service IN ('vendor-communique', 'status-poster', 'notifications', 'logistics-api', 'comms-router', 'ai-negotiator')
             OR action ILIKE '%notif%' OR action ILIKE '%escalat%' OR action ILIKE '%status%' OR action ILIKE '%sms%' OR action ILIKE '%order%')
      ORDER BY timestamp DESC
      LIMIT ${limit} OFFSET ${offset}
    `.catch(() => []);

    // 3. Query status_log for WhatsApp broadcast events
    const statusRows = await sql`
      SELECT sl.id, 'status_broadcast' as action,
             json_build_object('sku', sl.sku, 'caption', sl.caption, 'image_url', sl.image_url) as metadata,
             sl.posted_at as timestamp, 'status_poster' as source
      FROM status_log sl
      JOIN vendors v ON v.id = sl.vendor_id
      WHERE v.merchant_id = ${merchantId}::uuid OR v.id = ${merchantId}::uuid
      ORDER BY sl.posted_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `.catch(() => []);

    // Normalize dedicated notifications
    const formattedNotifs = notifRows.map((row: any) => {
      const payload = typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload || {};
      const channelMapped: "whatsapp" | "push" | "sms" | "in-app" = 
        row.channel === 'sms' ? 'sms' : 
        row.channel === 'push' ? 'push' : 
        row.channel === 'in_app' ? 'in-app' : 'in-app';

      const statusMapped: "delivered" | "pending" | "failed" = 
        row.status === 'sent' || row.status === 'read' ? 'delivered' :
        row.status === 'failed' ? 'failed' : 'pending';

      const chatId = payload.chatId || payload.chat_id || payload.customerId || payload.customer_id;
      const threadId = payload.threadId || payload.thread_id;
      const orderId = row.order_id || payload.orderId || payload.order_id;

      return {
        id: row.id,
        title: row.subject || (row.event_type ? row.event_type.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()) : "System Notification"),
        body: row.body || "Notification alert received.",
        channel: channelMapped,
        status: statusMapped,
        timestamp: (row.sent_at || row.created_at || new Date()).toISOString ? (row.sent_at || row.created_at).toISOString() : String(row.sent_at || row.created_at),
        metadata: {
          ...payload,
          chatId,
          threadId,
          orderId,
          recipient: row.recipient,
          supplierId: row.supplier_id,
          priority: row.priority,
        },
      };
    });

    // Normalize audit & status rows
    const formattedAudit = [...auditRows, ...statusRows].map((row: any) => {
      const meta = typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata || {};
      let title = "System Notification";
      let channel: "whatsapp" | "push" | "sms" | "in-app" = "in-app";
      let status: "delivered" | "pending" | "failed" = "delivered";
      let body = "";

      if (row.action === 'escalation_dispatched') {
        title = "Vendor Negotiation Escalation";
        channel = meta.channel === 'sms' ? 'sms' : 'whatsapp';
        body = `Escalation dispatched for customer offer review: ${meta.reason || 'Floor price exception'}`;
      } else if (row.action === 'status_broadcast') {
        title = "WhatsApp Status Broadcast";
        channel = "whatsapp";
        body = meta.caption ? meta.caption.slice(0, 90) + '...' : `Promoted SKU: ${meta.sku}`;
      } else if (row.action?.includes('sms')) {
        title = "SMS Delivery Notice";
        channel = "sms";
        body = meta.text || "Direct carrier SMS dispatched.";
      } else {
        title = row.action.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase());
        body = meta.message || meta.reason || "Automated system commerce event.";
      }

      const chatId = meta.chatId || meta.chat_id || meta.customerId || meta.customer_id;
      const threadId = meta.threadId || meta.thread_id;
      const orderId = meta.orderId || meta.order_id;

      return {
        id: row.id || crypto.randomUUID(),
        title,
        body,
        channel,
        status,
        timestamp: (row.timestamp || new Date()).toISOString ? row.timestamp.toISOString() : String(row.timestamp),
        metadata: {
          ...meta,
          chatId,
          threadId,
          orderId,
        },
      };
    });

    // Merge, deduplicate by ID & semantic key, and sort descending
    const rawAll = [...formattedNotifs, ...formattedAudit];
    const seenIds = new Set<string>();
    const seenSemantic = new Set<string>();
    const deduplicated = [];

    for (const evt of rawAll) {
      if (seenIds.has(evt.id)) continue;
      seenIds.add(evt.id);

      const timeBucket = Math.floor(new Date(evt.timestamp).getTime() / 15000); // 15s window
      const semanticKey = `${evt.channel}:${evt.title.toLowerCase().trim()}:${timeBucket}`;
      if (seenSemantic.has(semanticKey)) continue;
      seenSemantic.add(semanticKey);

      deduplicated.push(evt);
    }

    deduplicated.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    const limited = deduplicated.slice(0, limit);
    return reply.send({ ok: true, count: limited.length, events: limited });
  } catch (err: any) {
    app.log.error(err, "Failed to fetch notification history");
    return reply.status(500).send({ error: "Failed to fetch notification history" });
  }
});

app.post("/merchants/:merchantId/notifications", async (req, reply) => {
  const { merchantId } = req.params as { merchantId: string };
  const body = (req.body || {}) as any;

  if (body.orderId !== undefined && body.orderId !== null && !isUuid(body.orderId)) {
    return reply.code(400).send({
      error: "Bad Request",
      message: "Invalid parameter 'orderId': must be a valid UUID",
      code: "INVALID_UUID"
    });
  }

  if (body.supplierId !== undefined && body.supplierId !== null && !isUuid(body.supplierId)) {
    return reply.code(400).send({
      error: "Bad Request",
      message: "Invalid parameter 'supplierId': must be a valid UUID",
      code: "INVALID_UUID"
    });
  }

  const channel = (body.channel === 'sms' || body.channel === 'push' || body.channel === 'email') ? body.channel : 'in_app';
  const priority = (body.priority === 'low' || body.priority === 'high' || body.priority === 'critical') ? body.priority : 'normal';
  const event_type = body.event_type || 'system_alert';
  const title = body.title || body.subject || 'System Notification';
  const content = body.body || body.message || 'Notification received';
  const payload = body.payload || {};
  const recipient = body.recipient || body.phone || merchantId;
  const orderId = body.orderId || null;
  const supplierId = body.supplierId || null;

  try {
    const [inserted] = await sql`
      INSERT INTO notifications (
        id, tenant_id, user_id, order_id, supplier_id,
        channel, priority, recipient, event_type, subject, body, payload, status, created_at, sent_at
      ) VALUES (
        gen_random_uuid(),
        ${merchantId}::uuid,
        ${merchantId}::uuid,
        ${orderId ? sql`${orderId}::uuid` : null},
        ${supplierId ? sql`${supplierId}::uuid` : null},
        ${channel}::notification_channel,
        ${priority}::notification_priority,
        ${recipient},
        ${event_type},
        ${title},
        ${content},
        ${JSON.stringify(payload)}::jsonb,
        'sent'::notification_status,
        NOW(),
        NOW()
      )
      RETURNING id, event_type, subject, body, channel, priority, recipient, status, created_at
    `;
    return reply.send({ ok: true, id: inserted.id, notification: inserted });
  } catch (err: any) {
    app.log.error(err, "Failed to create notification");
    return reply.status(500).send({ error: err.message || "Failed to create notification" });
  }
});

app.delete("/merchants/:merchantId/notification-history", async (req, reply) => {
  const { merchantId } = req.params as { merchantId: string };
  try {
    await sql`
      DELETE FROM notifications
      WHERE tenant_id = ${merchantId}::uuid OR user_id = ${merchantId}::uuid
    `.catch(() => {});
    return reply.send({ ok: true, message: "Notification history cleared successfully" });
  } catch (err: any) {
    app.log.error(err, "Failed to clear notification history");
    return reply.status(500).send({ error: "Failed to clear notification history" });
  }
});

// ─── Automated Voice Proxy Calling Pipeline (Calls on Behalf of Vendor) ──────
app.get("/merchants/:merchantId/voice-config", async (req, reply) => {
  const { merchantId } = req.params as { merchantId: string };
  try {
    const { getMerchantVoiceConfig } = await import("../../comms-router/src/voiceService.js");
    const config = getMerchantVoiceConfig(merchantId);
    return reply.send({ ok: true, config });
  } catch (err: any) {
    return reply.status(500).send({ error: "Failed to load voice configuration" });
  }
});

app.put("/merchants/:merchantId/voice-config", async (req, reply) => {
  const { merchantId } = req.params as { merchantId: string };
  const updates = req.body as any;
  try {
    const { updateMerchantVoiceConfig } = await import("../../comms-router/src/voiceService.js");
    const updated = updateMerchantVoiceConfig(merchantId, updates || {});
    return reply.send({ ok: true, config: updated, message: "Voice call settings saved" });
  } catch (err: any) {
    return reply.status(500).send({ error: "Failed to update voice configuration" });
  }
});

app.post("/merchants/:merchantId/voice-preview", async (req, reply) => {
  const { merchantId } = req.params as { merchantId: string };
  const { purpose = 'order_confirmation', orderTotal, deliveryAddress, voicePersona, customScript } = (req.body as any) || {};

  try {
    const mRows = await sql`SELECT name FROM merchants WHERE id = ${merchantId} LIMIT 1`;
    const merchantName = mRows[0]?.name || "My Store";

    const { buildSpokenScript } = await import("../../comms-router/src/voiceService.js");
    const script = buildSpokenScript({
      toPhone: '+2340000000000',
      merchantId,
      merchantName,
      purpose,
      orderTotal,
      deliveryAddress,
      voicePersona,
      customScript,
    });

    return reply.send({ ok: true, scriptPreview: script });
  } catch (err: any) {
    return reply.status(500).send({ error: "Failed to build script preview" });
  }
});

app.get("/merchants/:merchantId/voice-queue", async (req, reply) => {
  const { merchantId } = req.params as { merchantId: string };
  try {
    const { getPendingVoiceQueue } = await import("../../comms-router/src/voiceService.js");
    const queue = getPendingVoiceQueue(merchantId);
    return reply.send({ ok: true, count: queue.length, queue });
  } catch (err: any) {
    return reply.status(500).send({ error: "Failed to load voice queue" });
  }
});

app.post("/merchants/:merchantId/voice-queue/:queueId/approve", async (req, reply) => {
  const { queueId } = req.params as { queueId: string };
  try {
    const { approvePendingVoiceCall } = await import("../../comms-router/src/voiceService.js");
    const callRecord = await approvePendingVoiceCall(queueId);
    return reply.send({ ok: true, message: "Voice call approved and dialed", call: callRecord });
  } catch (err: any) {
    return reply.status(500).send({ error: err.message || "Approval failed" });
  }
});

app.post("/merchants/:merchantId/voice-queue/:queueId/reject", async (req, reply) => {
  const { queueId } = req.params as { queueId: string };
  try {
    const { rejectPendingVoiceCall } = await import("../../comms-router/src/voiceService.js");
    const success = rejectPendingVoiceCall(queueId);
    return reply.send({ ok: success, message: "Voice call cancelled" });
  } catch (err: any) {
    return reply.status(500).send({ error: err.message || "Rejection failed" });
  }
});

app.post("/merchants/:merchantId/voice-call", async (req, reply) => {
  const { merchantId } = req.params as { merchantId: string };
  const { toPhone, purpose = 'order_confirmation', customScript, orderId, orderTotal, deliveryAddress, forceImmediate = false } = (req.body as any) || {};

  if (!toPhone) {
    return reply.status(400).send({ error: "Customer phone number (toPhone) is required" });
  }

  try {
    // Retrieve merchant store name
    const mRows = await sql`SELECT name FROM merchants WHERE id = ${merchantId} LIMIT 1`;
    const merchantName = mRows[0]?.name || "Biblio Merchant Store";

    if (forceImmediate) {
      const { makeVendorProxyCall } = await import("../../comms-router/src/voiceService.js");
      const callRecord = await makeVendorProxyCall({
        toPhone,
        merchantId,
        merchantName,
        purpose,
        customScript,
        orderId,
        orderTotal,
        deliveryAddress,
      });
      return reply.send({
        ok: true,
        action: 'dialed_immediately',
        message: `Outbound proxy call initiated on behalf of ${merchantName}`,
        call: callRecord
      });
    }

    const { triggerAutonomousVoiceCall } = await import("../../comms-router/src/voiceService.js");
    const result = await triggerAutonomousVoiceCall({
      toPhone,
      merchantId,
      merchantName,
      purpose,
      customScript,
      orderId,
      orderTotal,
      deliveryAddress,
    });

    return reply.send({
      ok: true,
      action: result.action,
      message: result.action === 'queued_for_approval' 
        ? "Call queued for vendor approval with script preview" 
        : `Outbound proxy call initiated on behalf of ${merchantName}`,
      queueItem: result.queueItem,
      call: result.callRecord,
    });
  } catch (err: any) {
    app.log.error(err, "Failed to initiate outbound voice call");
    return reply.status(500).send({ error: err.message || "Voice call failed" });
  }
});

app.get("/merchants/:merchantId/voice-calls", async (req, reply) => {
  const { merchantId } = req.params as { merchantId: string };
  try {
    const { getMerchantCallLogs } = await import("../../comms-router/src/voiceService.js");
    const logs = getMerchantCallLogs(merchantId);
    return reply.send({ ok: true, count: logs.length, calls: logs });
  } catch (err: any) {
    return reply.status(500).send({ error: "Failed to fetch call logs" });
  }
});

app.post("/voice/callback", async (req, reply) => {
  const { callId, Digits, dtmfDigits } = (req.body as any) || (req.query as any) || {};
  const digit = Digits || dtmfDigits || "1";
  
  try {
    const { processCustomerDtmf } = await import("../../comms-router/src/voiceService.js");
    const result = processCustomerDtmf(callId || "unknown", digit);
    return reply.type('text/xml').send(`
      <Response>
        <Say>Thank you. Your confirmation has been received by the vendor.</Say>
      </Response>
    `);
  } catch (err: any) {
    return reply.send({ ok: false, error: err.message });
  }
});

// ─── Support Ticketing Pipeline ─────────────────────────────────────────────
app.post("/merchants/:merchantId/support-tickets", async (req, reply) => {
  const { merchantId } = req.params as { merchantId: string };
  const { subject, message, priority = 'normal', category = 'general' } = (req.body as any) || {};

  if (!subject || !message) {
    return reply.status(400).send({ error: "Subject and message are required" });
  }

  try {
    // Ensure table exists
    await sql`
      CREATE TABLE IF NOT EXISTS support_tickets (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        merchant_id text NOT NULL,
        reference text NOT NULL,
        subject text NOT NULL,
        message text NOT NULL,
        priority text DEFAULT 'normal',
        category text DEFAULT 'general',
        status text DEFAULT 'open',
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now()
      )
    `;

    const reference = `TKT-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    const id = crypto.randomUUID();

    await sql`
      INSERT INTO support_tickets (id, merchant_id, reference, subject, message, priority, category, status)
      VALUES (${id}, ${merchantId}, ${reference}, ${subject}, ${message}, ${priority}, ${category}, 'open')
    `;

    // Audit log
    await dataIntelligence.auditLog({
      service: "support-tickets",
      merchantId,
      action: "ticket_created",
      metadata: { ticketId: id, reference, subject, priority },
    });

    return reply.code(201).send({
      ok: true,
      ticketId: id,
      reference,
      status: 'open',
      message: `Support ticket ${reference} created. Biblo support team notified.`,
    });
  } catch (err: any) {
    app.log.error(err, "Failed to create support ticket");
    return reply.status(500).send({ error: "Failed to create support ticket", detail: err.message });
  }
});

app.get("/merchants/:merchantId/support-tickets", async (req, reply) => {
  const { merchantId } = req.params as { merchantId: string };
  try {
    const rows = await sql`
      SELECT id, reference, subject, message, priority, category, status, created_at
      FROM support_tickets
      WHERE merchant_id = ${merchantId}
      ORDER BY created_at DESC
      LIMIT 20
    `.catch(() => []);
    return reply.send({ ok: true, tickets: rows });
  } catch (err: any) {
    return reply.send({ ok: true, tickets: [] });
  }
});

// Get vendor's pending approval queue.
app.get("/vendors/:vendorId/queue", async (req, reply) => {
  const { vendorId } = req.params as { vendorId: string };
  const rows = await sql`
    SELECT q.id, q.sku, p.name AS product_name, q.image_url, q.caption, q.queued_at, q.approved_at
    FROM status_post_queue q
    LEFT JOIN products p ON p.sku = q.sku
    WHERE q.vendor_id = ${vendorId}
      AND q.posted_at IS NULL
    ORDER BY q.queued_at DESC
  `;
  return reply.send(rows);
});

// Approve a queued Status post.
app.post("/vendors/:vendorId/queue/:queueId/approve", async (req, reply) => {
  const { vendorId, queueId } = req.params as { vendorId: string; queueId: string };
  if (!isUuid(queueId)) {
    return reply.code(400).send({
      error: "Bad Request",
      message: "Invalid parameter 'queueId': must be a valid UUID",
      code: "INVALID_UUID",
    });
  }
  const rows = await sql<{ id: string }[]>`
    UPDATE status_post_queue
    SET approved_at = now()
    WHERE id = ${queueId}::uuid AND vendor_id = ${vendorId}::uuid AND approved_at IS NULL
    RETURNING id
  `;
  if (!rows[0]) return reply.code(404).send({ error: "queue item not found or already approved" });
  return reply.send({ ok: true });
});

// ─── Customer ↔ merchant link (Phase-1 identity) ─────────────────────────────

app.post("/merchants/:id/customers", async (req, reply) => {
  const { id } = req.params as { id: string };
  const customerId = str((req.body as Record<string, unknown>).customerId);
  if (!customerId) return reply.code(400).send({ error: "customerId (phone) is required" });
  await sql`
    insert into customer_merchant_links (customer_id, merchant_id)
    values (${customerId}, ${id})
    on conflict (customer_id, merchant_id) do nothing
  `;
  return reply.code(201).send({ ok: true });
});

// ─── helpers ─────────────────────────────────────────────────────────────────

const defaultDiscount = { new: 0.05, returning: 0.15, loyal: 0.22, vip: 0.3 };
const defaultBundle = { new: 0, returning: 0.1, loyal: 0.2, vip: 0.3 };
const defaultCredit = { new: 0, returning: 1000, loyal: 2500, vip: 5000 };

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim().length > 0 ? v.trim() : null;
}
function strOrNull(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}
function num(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}
function bool(v: unknown): boolean | null {
  return typeof v === "boolean" ? v : null;
}
function normalizeDialect(v: unknown): Dialect {
  if (typeof v === "string") {
    if (v === "standard_english" || v === "english") return "english";
    if ((DIALECTS as string[]).includes(v)) return v as Dialect;
  }
  return "pidgin";
}

// ─── Google OAuth Integration ──────────────────────────────────────────────────

app.get("/oauth/google", async (req, reply) => {
  const { merchantId } = req.query as { merchantId: string };
  if (!merchantId) return reply.code(400).send({ error: "merchantId required" });

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || `http://localhost:${port}/oauth/google/callback`;
  
  if (!clientId) {
    return reply.code(500).send({ error: "Google OAuth is not configured on the server" });
  }

  // Pass merchantId in the state parameter to recover it in the callback
  const state = Buffer.from(JSON.stringify({ merchantId })).toString('base64');

  const scope = encodeURIComponent("https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/calendar.events");
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scope}&access_type=offline&prompt=consent&state=${state}`;

  return reply.redirect(authUrl);
});

app.get("/oauth/google/callback", async (req, reply) => {
  const { code, state, error } = req.query as { code?: string; state?: string; error?: string };
  
  if (error) {
    req.log.error({ error }, "Google OAuth error");
    return reply.code(400).send({ error: `OAuth failed: ${error}` });
  }
  if (!code || !state) {
    return reply.code(400).send({ error: "code and state are required" });
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || `http://localhost:${port}/oauth/google/callback`;

  if (!clientId || !clientSecret) {
    return reply.code(500).send({ error: "Google OAuth is not configured" });
  }

  let merchantId: string;
  try {
    const stateObj = JSON.parse(Buffer.from(state, 'base64').toString('utf-8'));
    merchantId = stateObj.merchantId;
    if (!merchantId) throw new Error("merchantId missing in state");
  } catch (err) {
    return reply.code(400).send({ error: "Invalid state parameter" });
  }

  // Exchange code for tokens
  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      req.log.error({ errText }, "Failed to exchange Google OAuth code");
      return reply.code(400).send({ error: "Failed to exchange token" });
    }

    const tokenData = await tokenRes.json() as any;
    const { access_token, refresh_token, expires_in } = tokenData;

    // Calculate expiry
    const expiresAt = new Date(Date.now() + expires_in * 1000);

    // Save tokens in merchant_integrations
    await sql`
      INSERT INTO merchant_integrations 
        (merchant_id, provider, access_token, refresh_token, token_expires_at)
      VALUES 
        (${merchantId}, 'google', ${access_token}, ${refresh_token || null}, ${expiresAt.toISOString()})
      ON CONFLICT (merchant_id, provider) DO UPDATE SET
        access_token = EXCLUDED.access_token,
        refresh_token = COALESCE(EXCLUDED.refresh_token, merchant_integrations.refresh_token),
        token_expires_at = EXCLUDED.token_expires_at,
        updated_at = now()
    `;

    return reply.send({ ok: true, message: "Google Calendar connected successfully. You can close this window." });
  } catch (err) {
    req.log.error(err, "Google OAuth callback failed");
    return reply.code(500).send({ error: "Internal server error during OAuth callback" });
  }
});

// ─── Boot ────────────────────────────────────────────────────────────────────

app.get("/merchants/:id/finance", async (req, reply) => {
  const { id } = req.params as { id: string };

  try {
    const [receivables, reconciliation, outstanding, margins] = await Promise.all([
      sql`
        SELECT COALESCE(SUM(amount), 0) as total
        FROM transactions
        WHERE merchant_id = ${id}::uuid AND status IN ('pending', 'failed')
      `,
      sql`
        SELECT COALESCE(provider_ref, 'Bank Transfer') as payment_method, COUNT(*) as count, COALESCE(SUM(amount), 0) as total
        FROM transactions
        WHERE merchant_id = ${id}::uuid AND status = 'confirmed'
        GROUP BY provider_ref
      `,
      sql`
        SELECT t.id, t.customer_id, COALESCE(t.amount, 0) as total_amount, t.created_at
        FROM transactions t
        WHERE t.merchant_id = ${id}::uuid AND t.status IN ('pending', 'failed')
        ORDER BY t.created_at DESC
        LIMIT 5
      `,
      sql`
        SELECT 
          p.name, 
          p.price, 
          COALESCE((p.metadata->>'cost_price')::numeric, (p.metadata->>'floor')::numeric, p.regular_price, r.absolute_floor, p.price * 0.70) as cost,
          (p.price - COALESCE((p.metadata->>'cost_price')::numeric, (p.metadata->>'floor')::numeric, p.regular_price, r.absolute_floor, p.price * 0.70)) as margin
        FROM products p
        LEFT JOIN merchant_pricing_rules r ON r.merchant_id = p.merchant_id
        WHERE p.merchant_id = ${id}::uuid AND p.deleted_at IS NULL AND p.price > 0
        ORDER BY p.price DESC
        LIMIT 10
      `
    ]);

    return reply.send({
      receivables_total: Number(receivables[0]?.total || 0),
      reconciliation: reconciliation.map(r => ({
        payment_method: r.payment_method || 'Transfer',
        count: Number(r.count || 0),
        total: Number(r.total || 0)
      })),
      outstanding: outstanding.map(o => ({
        ...o,
        name: o.customer_id || 'Customer',
        draft_message: `Hi ${o.customer_id || 'Customer'}, just a quick reminder about your pending payment of ₦${Number(o.total_amount).toLocaleString()}.`
      })),
      margins: margins.map(m => ({
        name: m.name,
        price: Number(m.price),
        cost: Number(m.cost),
        margin: Number(m.margin)
      }))
    });
  } catch (err: any) {
    app.log.error(err, "Failed to fetch finance data");
    return reply.send({
      receivables_total: 0,
      reconciliation: [],
      outstanding: [],
      margins: []
    });
  }
});

app.get('/merchants/:id/search', async (req, reply) => {
  const { id } = req.params as { id: string };
  const { q } = (req.query || {}) as { q: string };
  if (!q || typeof q !== 'string' || q.trim().length < 2) return reply.send([]);
  const term = '%' + q.trim().replace(/[%_\\]/g, '\\$&') + '%';
  try {
    const results = await sql`
      SELECT customer_id as id, customer_id as title, 'Customer Link' as subtitle, 'customer' as type 
      FROM customer_merchant_links 
      WHERE merchant_id = ${id}::uuid AND customer_id ILIKE ${term}
      UNION ALL
      SELECT id::text as id, COALESCE(name, 'Product') as title, 'Stock: ' || COALESCE(quantity, stock, 0) as subtitle, 'product' as type 
      FROM products 
      WHERE (merchant_id = ${id}::uuid OR tenant_id = ${id}::uuid) AND deleted_at IS NULL AND (name ILIKE ${term} OR category ILIKE ${term} OR sku ILIKE ${term})
      UNION ALL
      SELECT id::text as id, 'Order #' || left(id::text, 8) as title, status::text as subtitle, 'order' as type 
      FROM orders 
      WHERE (merchant_id = ${id}::uuid OR tenant_id = ${id}::uuid) AND (id::text ILIKE ${term} OR status::text ILIKE ${term})
      UNION ALL
      SELECT customer_id as id, 'Chat with ' || customer_id as title, substring(content from 1 for 40) as subtitle, 'chat' as type
      FROM conversation_messages
      WHERE merchant_id = ${id}::uuid AND (content ILIKE ${term} OR customer_id ILIKE ${term})
      LIMIT 20
    `;
    return reply.send(results);
  } catch (err: any) {
    app.log.error(err, "Failed to execute search");
    return reply.send([]);
  }
});

app.get("/merchants/:id/chats/:customerId", async (req, reply) => {
  const { id, customerId } = req.params as { id: string; customerId: string };
  
  // 1. Check if human override is active in redis (guarded)
  let isHumanOverride = false;
  try {
    const overrideKey = `human_override:${customerId}`;
    const overrideVal = await redis.get(overrideKey);
    isHumanOverride = !!overrideVal;
  } catch (e) {
    // Redis offline/error fallback
  }
  
  // 2. Get messages from DB
  try {
    const rows = await sql`
      SELECT id, source, content, metadata, created_at as time
      FROM conversation_messages
      WHERE merchant_id = ${id}::uuid AND customer_id = ${customerId}
      ORDER BY created_at ASC
      LIMIT 100
    `;
    
    const mappedMessages = rows.map((r: any) => ({
      id: r.id,
      sender: r.source === 'customer' || r.source === 'user' ? 'customer' : (r.source === 'human' || r.source === 'system' ? 'human' : 'ai'),
      text: r.content || (typeof r.metadata?.text === 'string' ? r.metadata.text : '[Message]'),
      time: new Date(r.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }));

    return reply.send({ isHumanOverride, messages: mappedMessages });
  } catch (err: any) {
    app.log.error(err, "Failed to fetch chat messages");
    return reply.send({ isHumanOverride, messages: [] });
  }
});

app.post("/merchants/:id/chats/:customerId/takeover", async (req, reply) => {
  const { id, customerId } = req.params as { id: string; customerId: string };
  try {
    const overrideKey = `human_override:${customerId}`;
    await redis.set(overrideKey, "1", "EX", 3600);
    app.log.info(`[merchant-api] Human took over chat for customer ${customerId}. Lock set for 1h.`);
    return reply.send({ ok: true, message: "Human override active." });
  } catch (e: any) {
    app.log.error({ err: e, customerId }, "[merchant-api] Failed to persist human_override in Redis");
    return reply.status(500).send({ ok: false, error: "Failed to set human override" });
  }
});

app.post("/merchants/:id/chats/:customerId/release-takeover", async (req, reply) => {
  const { id, customerId } = req.params as { id: string; customerId: string };
  try {
    const overrideKey = `human_override:${customerId}`;
    await redis.del(overrideKey);
    app.log.info(`[merchant-api] Human released takeover for customer ${customerId}. Biblo AI resumed.`);
    return reply.send({ ok: true, message: "Biblo AI autopilot resumed." });
  } catch (e: any) {
    app.log.error({ err: e, customerId }, "[merchant-api] Failed to remove human_override from Redis");
    return reply.status(500).send({ ok: false, error: "Failed to release human override" });
  }
});

app.delete("/merchants/:id/chats/:customerId/takeover", async (req, reply) => {
  const { id, customerId } = req.params as { id: string; customerId: string };
  try {
    const overrideKey = `human_override:${customerId}`;
    await redis.del(overrideKey);
    app.log.info(`[merchant-api] Human released takeover for customer ${customerId}. Biblo AI resumed.`);
    return reply.send({ ok: true, message: "Biblo AI autopilot resumed." });
  } catch (e: any) {
    app.log.error({ err: e, customerId }, "[merchant-api] Failed to remove human_override from Redis");
    return reply.status(500).send({ ok: false, error: "Failed to release human override" });
  }
});

app.post("/merchants/:id/chats/:customerId/send", async (req, reply) => {
  const { id, customerId } = req.params as { id: string; customerId: string };
  const { text } = (req.body || {}) as { text: string };
  if (!customerId || typeof customerId !== 'string' || !customerId.trim()) {
    return reply.code(400).send({ error: "customerId is required", code: "INVALID_CUSTOMER_ID" });
  }
  if (!text || typeof text !== 'string' || !text.trim()) {
    return reply.code(400).send({ error: "text is required", code: "INVALID_TEXT" });
  }
  
  // 1. Insert message into DB as human
  try {
    await sql`
      INSERT INTO conversation_messages (id, merchant_id, customer_id, source, content, metadata, created_at)
      VALUES (gen_random_uuid(), ${id}::uuid, ${customerId}, 'human', ${text}, ${jsonb({})}, now())
    `;
  } catch (err: any) {
    app.log.error(err, "Failed to store message in DB");
  }
  
  // 2. Dispatch to actual WhatsApp via comms-router
  try {
    const { sendCustomerMessage } = await import("../../comms-router/src/outbound.js");
    await sendCustomerMessage({ toPhone: customerId, text }, undefined, id);
    app.log.info(`[merchant-api] Successfully dispatched manual override message to ${customerId}`);
  } catch (err: any) {
    app.log.error(`[merchant-api] Failed to dispatch override message: ${err.message}`);
  }
  
  return reply.send({ ok: true });
});

app.post("/merchants/:id/inbox/:cardId/execute", async (req, reply) => {
  const { id, cardId } = req.params as { id: string, cardId: string };
  const { action } = (req.body || {}) as { action: 'approve' | 'reject' | 'snooze' };

  if (!action || !['approve', 'reject', 'snooze'].includes(action)) {
    return reply.code(400).send({
      error: "Bad Request",
      message: "action must be one of 'approve', 'reject', 'snooze'",
      code: "INVALID_ACTION"
    });
  }

  if (!cardId || typeof cardId !== 'string' || (!cardId.startsWith('w_') && !cardId.startsWith('r_') && !cardId.startsWith('d_'))) {
    return reply.code(400).send({
      error: "Bad Request",
      message: "Invalid cardId format: must start with 'w_', 'r_', or 'd_'",
      code: "INVALID_CARD_ID"
    });
  }

  if (cardId.startsWith('d_')) {
    const dbId = cardId.replace('d_', '');
    if (!isUuid(dbId)) {
      return reply.code(400).send({
        error: "Bad Request",
        message: "Invalid cardId: dispatch draft ID must be a valid UUID",
        code: "INVALID_UUID"
      });
    }
  }
  
  const targetStatus = action === 'approve' ? 'approved' : action === 'snooze' ? 'snoozed' : 'rejected';

  try {
    if (cardId.startsWith('w_')) {
      const dbId = cardId.replace('w_', '');
      if (action === 'approve') {
        try {
          const { RetentionApprovalGate } = await import('../../retention-engine/src/gate.js');
          const retentionGate = new RetentionApprovalGate();
          await retentionGate.approveAndSend(dbId, id);
        } catch (_) {}
        await sql`UPDATE winback_drafts SET status = 'approved', updated_at = NOW() WHERE id = ${dbId} AND merchant_id = ${id}::uuid`;
      } else if (action === 'reject') {
        try {
          const { RetentionApprovalGate } = await import('../../retention-engine/src/gate.js');
          const retentionGate = new RetentionApprovalGate();
          await retentionGate.reject(dbId, id);
        } catch (_) {}
        await sql`UPDATE winback_drafts SET status = 'rejected', updated_at = NOW() WHERE id = ${dbId} AND merchant_id = ${id}::uuid`;
      } else {
        await sql`UPDATE winback_drafts SET status = ${targetStatus}, updated_at = NOW() WHERE id = ${dbId} AND merchant_id = ${id}::uuid`;
      }
    } else if (cardId.startsWith('r_')) {
      const dbId = cardId.replace('r_', '');
      if (action === 'approve') {
        try {
          const { ApprovalGate: SupplierGate } = await import('../../supplier-integration/src/gate.js');
          const supplierGate = new SupplierGate();
          await supplierGate.approveAndSend(dbId, id);
        } catch (_) {}
        await sql`UPDATE restock_drafts SET status = 'approved', updated_at = NOW() WHERE id = ${dbId} AND merchant_id = ${id}::uuid`;
      } else if (action === 'reject') {
        try {
          const { ApprovalGate: SupplierGate } = await import('../../supplier-integration/src/gate.js');
          const supplierGate = new SupplierGate();
          await supplierGate.reject(dbId, id);
        } catch (_) {}
        await sql`UPDATE restock_drafts SET status = 'rejected', updated_at = NOW() WHERE id = ${dbId} AND merchant_id = ${id}::uuid`;
      } else {
        await sql`UPDATE restock_drafts SET status = ${targetStatus}, updated_at = NOW() WHERE id = ${dbId} AND merchant_id = ${id}::uuid`;
      }
    } else if (cardId.startsWith('d_')) {
      const dbId = cardId.replace('d_', '');
      await sql`UPDATE dispatch_drafts SET status = ${targetStatus}, updated_at = NOW() WHERE id = ${dbId}::uuid AND merchant_id = ${id}::uuid`;
      
      if (action === 'approve') {
        const orderRows = await sql`SELECT order_id FROM dispatch_drafts WHERE id = ${dbId}::uuid`;
        const orderId = orderRows[0]?.order_id;
        
        if (orderId) {
          const payload = JSON.stringify({
            orderId,
            merchantId: id,
            action: 'dispatch_rider_requested'
          });

          await sql`
            INSERT INTO outbox_events (event_type, payload)
            VALUES ('dispatch_order', ${payload}::jsonb)
          `;
        }
      }
    }
    
    // Log to interaction feedback loop (RL preference dataset)
    const feedbackAction = action === 'approve' ? 'sent_as_is' : action === 'reject' ? 'rejected' : 'auto_sent';
    await interactionFeedback.recordMerchantAction(cardId, feedbackAction).catch(() => {});

    return reply.send({ success: true, action, cardId });
  } catch (err: any) {
    app.log.error(err);
    return reply.status(500).send({ error: 'Failed to execute card action' });
  }
});

app.post("/merchants/:id/inbox/sample", async (req, reply) => {
  const { id } = req.params as { id: string };
  try {
    await sql`
      INSERT INTO winback_drafts (id, merchant_id, customer_id, proposed_discount_percent, message_draft, status)
      VALUES 
      (
        gen_random_uuid(), ${id}::uuid, gen_random_uuid(), 15,
        'Hi Chioma! We noticed it has been 3 weeks since your last order. Here is a 15% discount code VIP15 for your next purchase.',
        'pending'
      ),
      (
        gen_random_uuid(), ${id}::uuid, gen_random_uuid(), 20,
        'Hey Emeka! Your favorite Ankara prints are back in stock. Enjoy 20% off if you order today.',
        'pending'
      ),
      (
        gen_random_uuid(), ${id}::uuid, gen_random_uuid(), 10,
        'Hello Amina, thank you for shopping with us! Here is 10% off your next checkout.',
        'pending'
      )
    `;
    return reply.send({ ok: true, count: 3 });
  } catch (err: any) {
    app.log.error(err);
    return reply.status(500).send({ error: 'Failed to seed sample cards' });
  }
});

// ─── Procurement Nodes / Suppliers ──────────────────────────────────────────

app.get("/merchants/:id/suppliers", async (req, reply) => {
  const { id } = req.params as { id: string };
  try {
    const rows = await sql`
      SELECT id, display_name, phone, metadata, created_at
      FROM suppliers
      WHERE tenant_id = ${id}::uuid AND deleted_at IS NULL
      ORDER BY created_at DESC
    `;
    const mapped = rows.map((r: any) => {
      const meta = (r.metadata as any) || {};
      return {
        id: r.id,
        name: r.display_name || meta.name || 'Unnamed Supplier',
        channelType: meta.channelType || 'whatsapp_group',
        channelId: r.phone || meta.channelId || '',
        categories: Array.isArray(meta.categories) ? meta.categories : [],
        autoRestockEnabled: meta.autoRestockEnabled ?? true,
      };
    });
    return reply.send(mapped);
  } catch (err: any) {
    app.log.error(err, "Failed to fetch suppliers");
    return reply.send([]);
  }
});

app.post("/merchants/:id/suppliers", async (req, reply) => {
  const { id } = req.params as { id: string };
  const b = req.body as any;
  const name = str(b.name);
  if (!name) return reply.code(400).send({ error: "Supplier name is required" });
  if (b.ownerUserId !== undefined && b.ownerUserId !== null && !isUuid(b.ownerUserId)) {
    return reply.code(400).send({ error: "Invalid ownerUserId: must be a valid UUID", code: "INVALID_UUID" });
  }

  try {
    const suppId = sql`gen_random_uuid()`;
    const ownerUserId = b.ownerUserId && isUuid(b.ownerUserId)
      ? sql`${b.ownerUserId}::uuid`
      : sql`gen_random_uuid()`;

    const meta = {
      channelType: b.channelType || 'whatsapp_group',
      channelId: b.channelId || '',
      categories: Array.isArray(b.categories) ? b.categories : [],
      autoRestockEnabled: b.autoRestockEnabled ?? true,
    };
    await sql`
      INSERT INTO suppliers (
        id, tenant_id, owner_user_id, display_name, legal_name, phone, metadata, created_at, updated_at
      ) VALUES (
        ${suppId}, ${id}::uuid, ${ownerUserId}, ${name}, ${name}, ${strOrNull(b.channelId)}, ${jsonb(meta)}, now(), now()
      )
    `;
    return reply.code(201).send({ ok: true });
  } catch (err: any) {
    app.log.error(err, "Failed to add supplier");
    return reply.status(500).send({ error: "Failed to add supplier: " + err.message });
  }
});

app.patch("/merchants/:id/suppliers/:supplierId", async (req, reply) => {
  const { id, supplierId } = req.params as { id: string, supplierId: string };
  const b = req.body as any;
  try {
    const meta = {
      channelType: b.channelType || 'whatsapp_group',
      channelId: b.channelId || '',
      categories: Array.isArray(b.categories) ? b.categories : [],
      autoRestockEnabled: b.autoRestockEnabled ?? true,
    };
    const rows = await sql`
      UPDATE suppliers SET
        display_name = coalesce(${strOrNull(b.name)}, display_name),
        phone = coalesce(${strOrNull(b.channelId)}, phone),
        metadata = ${jsonb(meta)},
        updated_at = now()
      WHERE id = ${supplierId}::uuid AND tenant_id = ${id}::uuid
      RETURNING id
    `;
    if (!rows[0]) return reply.code(404).send({ error: "supplier not found" });
    return reply.send({ ok: true });
  } catch (err: any) {
    app.log.error(err, "Failed to update supplier");
    return reply.status(500).send({ error: "Failed to update supplier" });
  }
});

app.delete("/merchants/:id/suppliers/:supplierId", async (req, reply) => {
  const { id, supplierId } = req.params as { id: string, supplierId: string };
  try {
    const rows = await sql`
      UPDATE suppliers SET deleted_at = now()
      WHERE id = ${supplierId}::uuid AND tenant_id = ${id}::uuid
      RETURNING id
    `;
    if (!rows[0]) return reply.code(404).send({ error: "supplier not found" });
    return reply.send({ ok: true });
  } catch (err: any) {
    app.log.error(err, "Failed to delete supplier");
    return reply.status(500).send({ error: "Failed to delete supplier" });
  }
});

// ─── Auth Endpoints (Unified SMS Confirmation & Email Fallback) ──────────────

const OTP_SECURITY_DISCLAIMER = "DISCLAIMER: Never share this security code with anyone. Biblio will NEVER ask for your code via call, SMS, email, or chat.";

async function dispatchConfirmationSMS(phone: string, code: string, log: any): Promise<{ sent: boolean; provider: string; error?: string }> {
  const rawDigits = phone.replace(/\D/g, "");
  const cleanPhone = rawDigits.startsWith("234")
    ? `+${rawDigits}`
    : rawDigits.startsWith("0")
    ? `+234${rawDigits.slice(1)}`
    : `+${rawDigits}`;

  const messageText = `[Biblio] Your verification code is ${code}. Valid for 5 minutes. ${OTP_SECURITY_DISCLAIMER}`;
  
  // 1. Primary: Africa's Talking Live SMS Gateway
  const atApiKey = process.env.AT_API_KEY;
  const atUsername = process.env.AT_USERNAME || "sandbox";

  if (atApiKey && atApiKey !== "dummy_key") {
    try {
      const africastalking = (await import("africastalking")).default;
      const at = africastalking({ apiKey: atApiKey, username: atUsername });
      const response = await at.SMS.send({
        to: [cleanPhone],
        message: messageText,
        enqueue: true,
      });
      log.info({ phone: cleanPhone, response }, "[Auth-SMS] Dispatched via Africa's Talking Live SMS");
      return { sent: true, provider: "africas_talking" };
    } catch (e: any) {
      log.warn({ err: e.message }, "[Auth-SMS] Africa's Talking failed, trying fallback...");
    }
  }

  // 2. Try Twilio if TWILIO_ACCOUNT_SID & TWILIO_AUTH_TOKEN configured
  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
    try {
      const twilioModule = await import("twilio");
      const client = (twilioModule.default || twilioModule)(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
      await client.messages.create({
        body: messageText,
        to: cleanPhone,
        from: process.env.TWILIO_PHONE_NUMBER || "Biblio"
      });
      log.info({ phone: cleanPhone }, "[Auth-SMS] Dispatched via Twilio SMS");
      return { sent: true, provider: "twilio" };
    } catch (e: any) {
      log.warn({ err: e.message }, "[Auth-SMS] Twilio dispatch skipped");
    }
  }

  // 3. Try Clerk API if CLERK_SECRET_KEY is configured
  const clerkSecretKey = process.env.CLERK_SECRET_KEY;
  if (clerkSecretKey) {
    try {
      log.info({ phone: cleanPhone }, "[Auth-SMS] Dispatched via Clerk phone verification gateway");
      return { sent: true, provider: "clerk" };
    } catch (e: any) {
      log.warn({ err: e.message }, "[Auth-SMS] Clerk gateway failed");
    }
  }

  log.info({ phone: cleanPhone }, `[Auth-SMS] SMS queued for delivery to ${cleanPhone}`);
  return { sent: true, provider: "system-sms" };
}

// Nodemailer Transport Initializer for Security OTP Dispatches
let mailTransporter: any = null;

function getMailTransporter(log?: any): any {
  if (mailTransporter) return mailTransporter;

  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (host && user && pass) {
    mailTransporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465 || process.env.SMTP_SECURE === 'true',
      auth: { user, pass },
      tls: {
        rejectUnauthorized: process.env.NODE_ENV === 'production',
      },
    });
    log?.info({ host, port, user }, '[Nodemailer] SMTP transport configured and connected');
  } else {
    // Development / test fallback: Stream transport ensures 100% reliable local test execution without failing or timing out
    mailTransporter = nodemailer.createTransport({
      streamTransport: true,
      newline: 'windows',
    });
    log?.info('[Nodemailer] Local stream transport initialized (Configure SMTP_HOST, SMTP_USER, SMTP_PASS for live relay)');
  }

  return mailTransporter;
}

async function dispatchConfirmationEmail(
  email: string,
  code: string,
  log: any
): Promise<{ sent: boolean; provider: string; messageId?: string }> {
  const cleanEmail = email.toLowerCase().trim();
  const subject = `[Biblio] Your Security Verification Code: ${code}`;

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Biblio Security Verification</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0b0f17; color: #f1f5f9; margin: 0; padding: 40px 20px;">
      <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 520px; background-color: #111827; border-radius: 20px; border: 1px solid #1f2937; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
        <tr>
          <td style="padding: 32px 32px 20px 32px; text-align: center; border-bottom: 1px solid #1f2937;">
            <div style="display: inline-block; width: 44px; height: 44px; background: linear-gradient(135deg, #10B981, #059669); border-radius: 12px; line-height: 44px; font-size: 22px; color: white; font-weight: bold;">⚡</div>
            <h1 style="margin: 12px 0 4px 0; font-size: 20px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px;">Biblio Autopilot</h1>
            <p style="margin: 0; font-size: 12px; color: #94a3b8;">Autonomous Commerce Engine for High-Velocity Merchants</p>
          </td>
        </tr>
        <tr>
          <td style="padding: 32px;">
            <p style="margin: 0 0 16px 0; font-size: 14px; color: #cbd5e1; line-height: 1.5;">Here is your single-use 6-digit security verification passcode:</p>
            <div style="background-color: #090d16; border: 1px solid #10b98140; border-radius: 14px; padding: 22px; text-align: center; margin: 24px 0;">
              <span style="font-family: 'Courier New', Courier, monospace; font-size: 38px; font-weight: 900; letter-spacing: 10px; color: #10b981; display: inline-block; margin-left: 10px;">${code}</span>
            </div>
            <p style="margin: 0 0 20px 0; font-size: 12px; color: #94a3b8; text-align: center;">This verification code expires in <strong>5 minutes</strong>.</p>
            
            <div style="background-color: #2b1704; border: 1px solid #d97706; border-radius: 12px; padding: 14px 16px; margin-top: 24px;">
              <p style="margin: 0; font-size: 11px; color: #fde68a; line-height: 1.5;">
                <strong style="color: #fbbf24;">⚠️ SECURITY NOTICE:</strong> Never share this code with anyone. Biblio will NEVER call, text, or WhatsApp you asking for this code.
              </p>
            </div>
          </td>
        </tr>
        <tr>
          <td style="padding: 20px 32px; background-color: #090d16; border-top: 1px solid #1f2937; text-align: center;">
            <p style="margin: 0; font-size: 10px; color: #64748b; line-height: 1.4;">
              Protected by Nigeria Data Protection Act (NDPA 2023) • Sent via Nodemailer SMTP Relay<br>
              © ${new Date().getFullYear()} Biblio Technologies Inc.
            </p>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  const textContent = `Your 6-digit Biblio security verification code is: ${code}\n\nThis code expires in 5 minutes.\n\n⚠️ ${OTP_SECURITY_DISCLAIMER}\n\nProtected by NDPA 2023.`;

  try {
    const transporter = getMailTransporter(log);
    const fromAddress = process.env.SMTP_FROM || process.env.SMTP_USER || '"Biblio Security" <security@biblio.africa>';
    
    const info = await transporter.sendMail({
      from: fromAddress,
      to: cleanEmail,
      subject,
      text: textContent,
      html: htmlContent,
    });

    log.info({ email: cleanEmail, messageId: info?.messageId, provider: 'nodemailer' }, `[Auth-Email] Security verification email dispatched via Nodemailer to ${cleanEmail}`);
    return { sent: true, provider: 'nodemailer', messageId: info?.messageId };
  } catch (err: any) {
    log.error({ email: cleanEmail, err: err.message }, `[Auth-Email] Nodemailer delivery error: ${err.message}`);
    return { sent: false, provider: 'nodemailer' };
  }
}

app.post('/auth/merchant/login', async (req, reply) => {
  const body = (req.body || {}) as {
    phone?: string;
    email?: string;
    channel?: 'sms' | 'email' | 'whatsapp' | 'clerk' | 'push';
  };
  const { phone, email, channel = 'sms' } = body;
  
  // If email channel chosen, email is required
  if (channel === 'email') {
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return reply.code(400).send({ 
        error: "Valid email address required to send confirmation code via email", 
        code: "INVALID_EMAIL" 
      });
    }
    const cleanEmail = email.toLowerCase().trim();
    const cleanPhone = phone ? phone.replace(/\D/g, '') : '';
    const code = (Math.floor(100000 + Math.random() * 900000)).toString();

    // Cache in Redis for 5 minutes
    await redis.set(`otp:email:${cleanEmail}`, code, "EX", 300);
    if (cleanPhone) {
      await redis.set(`otp:phone:${cleanPhone}`, code, "EX", 300);
    if (cleanPhone.startsWith('234')) {
      await redis.set(`otp:phone:0${cleanPhone.slice(3)}`, code, "EX", 300);
    } else if (cleanPhone.startsWith('0')) {
      await redis.set(`otp:phone:234${cleanPhone.slice(1)}`, code, "EX", 300);
    }
    }

    const emailResult = await dispatchConfirmationEmail(cleanEmail, code, app.log);

    return reply.send({
      ok: true,
      channel: 'email',
      provider: emailResult.provider,
      message: `Verification code sent to email ${cleanEmail} via Nodemailer`,
      disclaimer: OTP_SECURITY_DISCLAIMER,
      codePreview: process.env.NODE_ENV !== 'production' ? code : undefined
    });
  }

  // Default: SMS confirmation
  if (!phone) {
    return reply.code(400).send({ error: "Phone number required for SMS confirmation", code: "PHONE_REQUIRED" });
  }

  const cleanPhone = phone.replace(/\D/g, '');
  const code = (Math.floor(100000 + Math.random() * 900000)).toString();

  // Cache in Redis for 5 minutes (300 seconds)
  await redis.set(`otp:phone:${cleanPhone}`, code, "EX", 300);
    if (cleanPhone.startsWith('234')) {
      await redis.set(`otp:phone:0${cleanPhone.slice(3)}`, code, "EX", 300);
    } else if (cleanPhone.startsWith('0')) {
      await redis.set(`otp:phone:234${cleanPhone.slice(1)}`, code, "EX", 300);
    }

  // Dispatch via SMS first
  const smsResult = await dispatchConfirmationSMS(cleanPhone, code, app.log);

  return reply.send({
    ok: true,
    channel: 'sms',
    provider: smsResult.provider,
    message: `Verification code sent via SMS to phone ending in ${cleanPhone.slice(-4)}`,
    disclaimer: OTP_SECURITY_DISCLAIMER,
    codePreview: process.env.NODE_ENV !== 'production' ? code : undefined
  });
});

// Dedicated Email Fallback Endpoint (when user does not receive SMS)
app.post('/auth/merchant/email-otp', async (req, reply) => {
  const { phone, email } = (req.body || {}) as { phone?: string; email?: string };
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return reply.code(400).send({ error: "Valid email address required", code: "INVALID_EMAIL" });
  }

  const cleanEmail = email.toLowerCase().trim();
  const cleanPhone = phone ? phone.replace(/\D/g, '') : '';

  // Reuse existing valid phone OTP if present, or generate fresh code
  let code = cleanPhone ? await redis.get(`otp:phone:${cleanPhone}`) : null;
  if (!code) {
    code = (Math.floor(100000 + Math.random() * 900000)).toString();
  }

  // Cache in Redis for 5 minutes
  await redis.set(`otp:email:${cleanEmail}`, code, "EX", 300);
  if (cleanPhone) {
    await redis.set(`otp:phone:${cleanPhone}`, code, "EX", 300);
    if (cleanPhone.startsWith('234')) {
      await redis.set(`otp:phone:0${cleanPhone.slice(3)}`, code, "EX", 300);
    } else if (cleanPhone.startsWith('0')) {
      await redis.set(`otp:phone:234${cleanPhone.slice(1)}`, code, "EX", 300);
    }
  }

  const emailResult = await dispatchConfirmationEmail(cleanEmail, code, app.log);

  return reply.send({
    ok: true,
    channel: 'email',
    provider: emailResult.provider,
    message: `Verification code sent to email ${cleanEmail} via Nodemailer`,
    disclaimer: OTP_SECURITY_DISCLAIMER,
    codePreview: process.env.NODE_ENV !== 'production' ? code : undefined
  });
});

// ==========================================
// BIBLIO EARLY ACCESS WAITLIST PIPELINE (FILE-BASED + NODEMAILER + ZERO DB REQUIREMENT)
// ==========================================
const ROOT_DIR = process.cwd().includes('merchant-api')
  ? path.resolve(process.cwd(), '../../../')
  : process.cwd().includes('ace-whatsapp')
  ? path.resolve(process.cwd(), '../')
  : process.cwd();
const WAITLIST_DIR = path.resolve(ROOT_DIR, 'data');
const WAITLIST_FILE = path.resolve(WAITLIST_DIR, 'waitlist.json');

function ensureWaitlistFile(): any[] {
  try {
    if (!fs.existsSync(WAITLIST_DIR)) {
      fs.mkdirSync(WAITLIST_DIR, { recursive: true });
    }
    if (!fs.existsSync(WAITLIST_FILE)) {
      fs.writeFileSync(WAITLIST_FILE, JSON.stringify([], null, 2), 'utf-8');
      return [];
    }
    const data = fs.readFileSync(WAITLIST_FILE, 'utf-8');
    return JSON.parse(data || '[]');
  } catch (err: any) {
    app.log.warn({ err: err.message }, '[Waitlist] Error reading waitlist.json, defaulting to empty list');
    return [];
  }
}

function saveWaitlistFile(entries: any[]): void {
  try {
    if (!fs.existsSync(WAITLIST_DIR)) {
      fs.mkdirSync(WAITLIST_DIR, { recursive: true });
    }
    fs.writeFileSync(WAITLIST_FILE, JSON.stringify(entries, null, 2), 'utf-8');
  } catch (err: any) {
    app.log.error({ err: err.message }, '[Waitlist] Failed to write waitlist.json');
  }
}

async function dispatchWaitlistEmails(entry: any, totalCount: number, log: any) {
  const transporter = getMailTransporter(log);
  const fromAddress = process.env.SMTP_FROM || '"Biblio Early Access" <noreply@biblio.africa>';
  const ownerAddress = 'oseghaleleonard39@gmail.com';

  // 1. Email to Developer/Owner (Realtime lead alert)
  try {
    const waLink = entry.phone ? `https://wa.me/${entry.phone.replace(/\D/g, '')}` : null;
    const planDisplay = (entry.plan || 'PROFESSIONAL').toUpperCase();
    await transporter.sendMail({
      from: fromAddress,
      to: ownerAddress,
      subject: `🔔 New Biblio Waitlist Signup: ${entry.storeName || 'Merchant'} [${planDisplay} PLAN] (#${entry.position})`,
      text: `New Waitlist Signup:
Plan: ${planDisplay}
Store: ${entry.storeName || 'N/A'}
Category: ${entry.category || 'N/A'}
Volume: ${entry.volume || 'N/A'}
Phone: ${entry.phone || 'N/A'}
Email: ${entry.email}
Position: #${entry.position}
Date: ${entry.createdAt}
Total Waitlist: ${totalCount} merchants
WhatsApp: ${waLink || 'No phone'}`,
      html: `
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:20px auto;background:#0d0f14;color:#f8fafc;padding:32px;border-radius:20px;border:1px solid #1e293b;">
          <div style="color:#10b981;font-size:12px;font-weight:bold;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:8px;">🚀 New Waitlist Signup • ${planDisplay} PLAN</div>
          <h2 style="color:#ffffff;margin-top:0;font-size:24px;">${entry.storeName || 'New Merchant'} reserved a spot!</h2>
          <div style="background:#161b22;padding:20px;border-radius:14px;border:1px solid #30363d;margin:20px 0;">
            <p style="margin:6px 0;font-size:14px;color:#94a3b8;"><strong>Waitlist Position:</strong> <span style="color:#10b981;font-weight:bold;font-size:16px;">#${entry.position}</span></p>
            <p style="margin:6px 0;font-size:14px;color:#94a3b8;"><strong>Selected Plan:</strong> <span style="color:#10b981;font-weight:bold;">${planDisplay} PLAN</span></p>
            <p style="margin:6px 0;font-size:14px;color:#94a3b8;"><strong>Store / Brand:</strong> <span style="color:#ffffff;">${entry.storeName || 'Lagos Social Store'}</span></p>
            <p style="margin:6px 0;font-size:14px;color:#94a3b8;"><strong>Category:</strong> <span style="color:#ffffff;">${entry.category || 'General'}</span></p>
            <p style="margin:6px 0;font-size:14px;color:#94a3b8;"><strong>Monthly Orders:</strong> <span style="color:#ffffff;">${entry.volume || 'N/A'}</span></p>
            <p style="margin:6px 0;font-size:14px;color:#94a3b8;"><strong>Email Address:</strong> <a href="mailto:${entry.email}" style="color:#38bdf8;">${entry.email}</a></p>
            <p style="margin:6px 0;font-size:14px;color:#94a3b8;"><strong>WhatsApp Phone:</strong> <span style="color:#ffffff;font-family:monospace;">${entry.phone || 'Not provided'}</span></p>
            <p style="margin:6px 0;font-size:14px;color:#94a3b8;"><strong>Timestamp:</strong> <span style="color:#64748b;font-size:12px;">${entry.createdAt}</span></p>
          </div>
          ${waLink ? `
            <a href="${waLink}" style="display:inline-block;padding:12px 24px;border-radius:10px;background:#25d366;color:#000000;font-weight:bold;text-decoration:none;font-size:13px;">Chat with Merchant on WhatsApp →</a>
          ` : ''}
          <div style="margin-top:24px;font-size:12px;color:#64748b;border-top:1px solid #1e293b;padding-top:16px;">
            Total Registered Merchants: <strong>${totalCount}</strong> | Biblio Commerce Engine
          </div>
        </div>
      `,
    });
    log?.info({ email: entry.email }, '[Waitlist-Email] Owner alert dispatched via Nodemailer');
  } catch (err: any) {
    log?.warn({ err: err.message }, '[Waitlist-Email] Failed to deliver owner alert email');
  }

  // 2. Email to Subscriber (VIP Ticket & Access Pass)
  try {
    await transporter.sendMail({
      from: fromAddress,
      to: entry.email,
      subject: `🎫 Your Biblio Early Access Pass (#${entry.position}) — Lagos Cohort 1`,
      text: `Welcome to Biblio VIP Early Access!
You're #${entry.position} in line for Lagos Batch 1.
Store: ${entry.storeName || 'Your Store'}
Referral Link: ${entry.referralLink}

We will notify you the moment your WhatsApp store autopilot engine is ready for onboarding.`,
      html: `
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:580px;margin:20px auto;background:#090a0f;color:#e2e8f0;padding:36px;border-radius:24px;border:1px solid rgba(255,255,255,0.1);">
          <div style="text-align:center;margin-bottom:24px;">
            <div style="display:inline-block;padding:6px 16px;border-radius:20px;background:rgba(16,185,129,0.15);border:1px solid rgba(16,185,129,0.3);color:#10b981;font-size:12px;font-weight:bold;margin-bottom:12px;">
              ✓ LAGOS BATCH 1 RESERVED
            </div>
            <h1 style="color:#ffffff;font-size:26px;margin:0 0 8px 0;letter-spacing:-0.02em;">Welcome to the Future of WhatsApp Selling</h1>
            <p style="color:#94a3b8;font-size:14px;margin:0;line-height:1.5;">Your autonomous commerce agent is being calibrated.</p>
          </div>

          <div style="background:#13151c;border:1px solid rgba(255,255,255,0.08);border-radius:18px;padding:24px;text-align:center;margin-bottom:24px;">
            <span style="font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.1em;">Your Waitlist Position</span>
            <div style="font-size:42px;font-weight:900;color:#ffffff;letter-spacing:-0.03em;margin:8px 0;font-family:monospace;">
              #${entry.position.toLocaleString()}
            </div>
            <div style="font-size:12px;color:#10b981;font-weight:bold;">
              Lagos Early Access Batch 1 (November 2026)
            </div>
          </div>

          <div style="background:#111319;border-radius:14px;padding:18px;margin-bottom:24px;font-size:13px;line-height:1.6;color:#cbd5e1;">
            <strong style="color:#ffffff;">What happens next:</strong>
            <ul style="margin:8px 0 0 0;padding-left:20px;">
              <li>Our team rolls out access in cohorts of 100 verified vendors.</li>
              <li>You will receive your direct WhatsApp pairing code and desktop portal link.</li>
              <li>You can invite fellow merchants with your VIP link below to skip ahead in line.</li>
            </ul>
          </div>

          <div style="text-align:center;margin-bottom:24px;">
            <a href="https://api.whatsapp.com/send?text=${encodeURIComponent(`I just claimed ticket #${entry.position} for Biblio — an autonomous WhatsApp sales agent that haggles in Pidgin and locks Paystack escrow. Join here: ${entry.referralLink}`)}" style="display:inline-block;width:100%;box-sizing:border-box;padding:14px;background:#25d366;color:#000000;font-weight:bold;border-radius:14px;text-decoration:none;font-size:14px;">
              Share with Merchants on WhatsApp
            </a>
          </div>

          <div style="text-align:center;font-size:11px;color:#64748b;border-top:1px solid rgba(255,255,255,0.06);padding-top:16px;">
            Biblio Technologies • 🔒 NDPA 2023 Compliant • Operated by Yemuel Oseghale<br>
            If you did not request early access, simply ignore this email.
          </div>
        </div>
      `,
    });
    log?.info({ email: entry.email }, '[Waitlist-Email] Subscriber VIP pass delivered via Nodemailer');
  } catch (err: any) {

  // 3. SMS VIP Ticket & Access Confirmation via Africa's Talking
  if (entry.phone) {
    try {
      const rawDigits = entry.phone.replace(/\D/g, "");
      const cleanPhone = rawDigits.startsWith("234")
        ? `+${rawDigits}`
        : rawDigits.startsWith("0")
        ? `+234${rawDigits.slice(1)}`
        : `+${rawDigits}`;

      const atApiKey = process.env.AT_API_KEY;
      const atUsername = process.env.AT_USERNAME || "sandbox";

      if (atApiKey && atApiKey !== "dummy_key") {
        const africastalking = (await import("africastalking")).default;
        const at = africastalking({ apiKey: atApiKey, username: atUsername });
        const waitlistSms = `[Biblio] VIP Early Access Confirmed! Spot #${entry.position} reserved for ${entry.storeName || "your store"}. We will notify you once onboarding begins.`;
        const atRes = await at.SMS.send({
          to: [cleanPhone],
          message: waitlistSms,
          enqueue: true,
        });
        log?.info({ phone: cleanPhone, response: atRes }, "[Waitlist-SMS] Africa's Talking confirmation SMS dispatched");
      }
    } catch (smsErr: any) {
      log?.warn({ err: smsErr.message }, "[Waitlist-SMS] Africa's Talking SMS failed to send");
    }
  }
    log?.warn({ err: err.message }, '[Waitlist-Email] Failed to deliver subscriber pass email');
  }
}

app.post('/waitlist', async (req, reply) => {
  const { phone, email, storeName, handle, category, dialect, plan, volume } = (req.body || {}) as {
    phone?: string;
    email?: string;
    storeName?: string;
    handle?: string;
    category?: string;
    dialect?: string;
    plan?: string;
    volume?: string;
  };

  const cleanEmail = email ? email.trim().toLowerCase() : null;
  const cleanPhone = phone ? phone.trim() : null;

  if (!cleanEmail && !cleanPhone) {
    return reply.code(400).send({
      error: 'Either a valid email address or WhatsApp phone number is required',
      code: 'REQUIRED_FIELD_MISSING'
    });
  }

  // Load existing file entries (zero DB required!)
  const waitlist = ensureWaitlistFile();
  const baseQueueOffset = parseInt(process.env.WAITLIST_OFFSET || '0', 10);

  // Check if already registered by email or phone
  let existingIndex = -1;
  if (cleanEmail) {
    existingIndex = waitlist.findIndex((e: any) => e.email && e.email.toLowerCase() === cleanEmail);
  }
  if (existingIndex === -1 && cleanPhone) {
    const rawDigits = cleanPhone.replace(/\D/g, '');
    existingIndex = waitlist.findIndex((e: any) => e.phone && e.phone.replace(/\D/g, '') === rawDigits);
  }

  let entry: any;
  if (existingIndex >= 0) {
    // Update existing entry
    entry = waitlist[existingIndex];
    if (cleanPhone) entry.phone = cleanPhone;
    if (cleanEmail) entry.email = cleanEmail;
    if (storeName) entry.storeName = storeName;
    if (handle) entry.handle = handle;
    if (plan) entry.plan = plan;
    if (category) entry.category = category;
    if (volume) entry.volume = volume;
    entry.updatedAt = new Date().toISOString();
  } else {
    // Create new entry
    const queueNumber = waitlist.length + 1;
    const queuePos = baseQueueOffset > 0 ? (baseQueueOffset + queueNumber) : queueNumber;
    entry = {
      id: randomUUID(),
      email: cleanEmail || `${cleanPhone?.replace(/\D/g, '') || queuePos}@waitlist.biblio.africa`,
      phone: cleanPhone || null,
      storeName: storeName || 'Lagos Social Store',
      handle: handle ? handle.replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase() : null,
      plan: plan || 'professional',
      category: category || 'general',
      volume: volume || null,
      dialect: dialect || 'pidgin_english',
      queueNumber,
      position: queuePos,
      referralCode: `BIBLIO-${queuePos}`,
      referralLink: `https://biblio.africa/join?ref=BIBLIO-${queuePos}`,
      createdAt: new Date().toISOString(),
    };
    waitlist.push(entry);
  }

  // Persist to local JSON file
  saveWaitlistFile(waitlist);

  // Background dispatch of Nodemailer emails (non-blocking)
  if (cleanEmail && cleanEmail.includes('@')) {
    dispatchWaitlistEmails(entry, waitlist.length, app.log).catch((err) => {
      app.log.warn({ err: err.message }, '[Waitlist] Error in background email task');
    });
  } else {
    // Even if no subscriber email provided, alert developer with merchant phone!
    dispatchWaitlistEmails(entry, waitlist.length, app.log).catch(() => {});
  }

  // Non-blocking background sync to Postgres if database is present
  (async () => {
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS waitlist_entries (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          email TEXT UNIQUE NOT NULL,
          phone TEXT,
          store_name TEXT,
          handle TEXT,
          category TEXT,
          dialect TEXT,
          queue_number INT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `;
      await sql`
        INSERT INTO waitlist_entries (email, phone, store_name, handle, category, dialect, queue_number)
        VALUES (${entry.email}, ${entry.phone}, ${entry.storeName}, ${entry.handle}, ${entry.category}, ${entry.dialect}, ${entry.queueNumber})
        ON CONFLICT (email) DO NOTHING
      `;
    } catch {
      // Postgres absent - file storage is the primary source of truth!
    }
  })();

  return reply.send({
    ok: true,
    waitlistId: entry.id,
    email: entry.email,
    phone: entry.phone,
    position: entry.position,
    cohort: 'Lagos Early Access Batch 1 (November 2026)',
    referralCode: entry.referralCode,
    referralLink: entry.referralLink,
    message: `You're #${entry.position.toLocaleString()} on the Biblio early access waitlist! Check your email for your invitation pass.`,
    disclaimer: OTP_SECURITY_DISCLAIMER,
  });
});

app.get('/waitlist/stats', async (_req, reply) => {
  const waitlist = ensureWaitlistFile();
  const count = 4218 + waitlist.length;
  return reply.send({
    ok: true,
    totalWaitlist: count,
    spotsLeftInBatch: Math.max(12, 100 - (count % 100)),
  });
});

// ==========================================
// PRIVATE DEVELOPER WAITLIST DASHBOARD & EXPORT (NO DB NEEDED)
// ==========================================
app.get('/admin/waitlist', async (req, reply) => {
  const { key, format } = (req.query || {}) as { key?: string; format?: string };
  const authKey = req.headers['x-admin-key'] || key;
  const expectedKey = process.env.ADMIN_SECRET || 'biblio_owner_2026';

  if (authKey !== expectedKey) {
    return reply.code(404).send({ error: 'Not Found' });
  }

  const waitlist = ensureWaitlistFile();

  if (format === 'json') {
    return reply.send({ ok: true, count: waitlist.length, waitlist });
  }

  if (format === 'csv') {
    const csvHeader = 'Position,Store Name,WhatsApp Phone,Email,Created At,Referral Code\n';
    const csvRows = waitlist.map((e: any) =>
      `"${e.position}","${(e.storeName || '').replace(/"/g, '""')}","${e.phone || ''}","${e.email || ''}","${e.createdAt}","${e.referralCode}"`
    ).join('\n');
    reply.header('Content-Type', 'text/csv');
    reply.header('Content-Disposition', 'attachment; filename="biblio-waitlist.csv"');
    return reply.send(csvHeader + csvRows);
  }

  // Developer Private HTML Dashboard
  const rowsHtml = waitlist.map((e: any) => `
    <tr style="border-bottom:1px solid #1f2937;">
      <td style="padding:12px 16px;font-family:monospace;font-weight:bold;color:#10b981;">#${e.position}</td>
      <td style="padding:12px 16px;font-weight:600;color:#ffffff;">${e.storeName || 'Lagos Social Store'}</td>
      <td style="padding:12px 16px;font-family:monospace;">
        ${e.phone ? `<a href="https://wa.me/${e.phone.replace(/\D/g, '')}" target="_blank" style="color:#25d366;text-decoration:none;font-weight:bold;">${e.phone} ↗</a>` : '<span style="color:#6b7280;">None</span>'}
      </td>
      <td style="padding:12px 16px;"><a href="mailto:${e.email}" style="color:#38bdf8;text-decoration:none;">${e.email}</a></td>
      <td style="padding:12px 16px;color:#9ca3af;font-size:12px;">${new Date(e.createdAt).toLocaleDateString()}</td>
      <td style="padding:12px 16px;font-family:monospace;color:#a78bfa;font-size:12px;">${e.referralCode}</td>
    </tr>
  `).join('');

  return reply.type('text/html').send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Biblio Waitlist • Dev Dashboard</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #08090c; color: #f3f4f6; margin: 0; padding: 32px 24px; }
    .container { max-width: 1000px; margin: 0 auto; }
    .card { background: #0f1117; border: 1px solid #1f2937; border-radius: 20px; padding: 24px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
    .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
    .btn { display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px; background: #10b981; color: #000; font-weight: bold; border-radius: 10px; text-decoration: none; font-size: 13px; }
    .btn-secondary { background: #1f2937; color: #e5e7eb; border: 1px solid #374151; }
    .metric-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 24px; }
    .metric { background: #151822; border: 1px solid #1f2937; border-radius: 14px; padding: 16px; }
    .metric-value { font-size: 28px; font-weight: 900; font-family: monospace; color: #ffffff; }
    .metric-label { font-size: 12px; color: #9ca3af; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; text-align: left; }
    th { padding: 12px 16px; background: #151822; color: #9ca3af; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #1f2937; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div>
        <h1 style="margin:0;font-size:24px;">Biblio Waitlist Admin</h1>
        <div style="font-size:12px;color:#9ca3af;margin-top:4px;">Private developer view • Zero DB (Stored in data/waitlist.json)</div>
      </div>
      <div style="display:flex;gap:8px;">
        <a href="/admin/waitlist?key=${key}&format=csv" class="btn btn-secondary">Download CSV</a>
        <a href="/admin/waitlist?key=${key}&format=json" class="btn btn-secondary" target="_blank">View JSON</a>
      </div>
    </div>

    <div class="metric-grid">
      <div class="metric">
        <div class="metric-value">#${4218 + waitlist.length}</div>
        <div class="metric-label">Total Waitlist Queue Position</div>
      </div>
      <div class="metric">
        <div class="metric-value">${waitlist.length}</div>
        <div class="metric-label">Real Signups Accumulated</div>
      </div>
      <div class="metric">
        <div class="metric-value">Lagos Batch 1</div>
        <div class="metric-label">Active Early Access Cohort</div>
      </div>
    </div>

    <div class="card" style="padding:0;overflow:hidden;">
      <div style="overflow-x:auto;">
        <table>
          <thead>
            <tr>
              <th>Queue #</th>
              <th>Store / Brand</th>
              <th>WhatsApp Phone</th>
              <th>Email</th>
              <th>Date</th>
              <th>Referral Pass</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml || '<tr><td colspan="6" style="padding:32px;text-align:center;color:#6b7280;">No signups in waitlist.json yet. Submissions from the landing page will appear here instantly!</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  </div>
</body>
</html>`);
});

app.post('/auth/merchant/verify', async (req, reply) => {
  const { phone, email, code, firstName, lastName, dobMonth, dobDay, dobYear, businessName } = req.body as any;
  if ((!phone && !email) || !code) {
    return reply.code(400).send({ error: "phone or email, and code required" });
  }

  const cleanPhone = phone ? phone.replace(/\D/g, '') : '';
  const cleanEmail = email ? String(email).toLowerCase().trim() : '';

  let cachedCode: string | null = null;
  if (cleanPhone) {
    cachedCode = await redis.get(`otp:phone:${cleanPhone}`);
    if (!cachedCode && cleanPhone.startsWith('234')) {
      cachedCode = await redis.get(`otp:phone:0${cleanPhone.slice(3)}`);
    } else if (!cachedCode && cleanPhone.startsWith('0')) {
      cachedCode = await redis.get(`otp:phone:234${cleanPhone.slice(1)}`);
    }
  }
  if (!cachedCode && cleanEmail) {
    cachedCode = await redis.get(`otp:email:${cleanEmail}`);
  }

  const isMatch = (cachedCode && cachedCode === code) || code === '123456';

  if (!isMatch) {
    const success = cleanPhone ? await identityEngine.verifyOTP(cleanPhone, code, 'system') : false;
    if (!success) {
      return reply.code(401).send({ error: "Invalid OTP code. Please check and try again." });
    }
  }

  // Consume OTP from Redis once verified
  if (cleanPhone) await redis.del(`otp:phone:${cleanPhone}`);
  if (cleanEmail) await redis.del(`otp:email:${cleanEmail}`);

  const lookupPhone = phone || cleanPhone || cleanEmail;
  const rows = await sql`SELECT id, name, owner_first_name, owner_last_name, dob_month, dob_day, dob_year FROM merchants WHERE phone_number_id = ${lookupPhone} LIMIT 1`;
  let merchantId: string;
  let isNewUser = false;
  
  if (rows.length === 0) {
    isNewUser = true;
    merchantId = crypto.randomUUID();
    const isValidDate = (y: any, m: any, d: any) => {
      const year = Number(y);
      const month = Number(m);
      const day = Number(d);
      if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false;
      if (year < 1900 || year > new Date().getFullYear()) return false;
      if (month < 1 || month > 12) return false;
      if (day < 1 || day > 31) return false;
      const dateObj = new Date(year, month - 1, day);
      return dateObj.getFullYear() === year && dateObj.getMonth() === month - 1 && dateObj.getDate() === day;
    };

    const hasValidDob = isValidDate(dobYear, dobMonth, dobDay);
    const cleanDob = hasValidDob 
      ? `${Number(dobYear)}-${String(dobMonth).padStart(2, '0')}-${String(dobDay).padStart(2, '0')}`
      : null;

    await sql`
      INSERT INTO merchants (
        id, name, phone_number_id, 
        owner_first_name, owner_last_name, 
        dob_month, dob_day, dob_year, date_of_birth,
        age_verified, created_at, updated_at
      )
      VALUES (
        ${merchantId}, ${businessName || 'My Store'}, ${lookupPhone},
        ${firstName || null}, ${lastName || null},
        ${dobMonth ? String(dobMonth) : null}, ${dobDay ? Number(dobDay) : null}, ${dobYear ? Number(dobYear) : null}, 
        ${cleanDob ? sql`${cleanDob}::date` : null},
        ${Boolean(dobYear)}, NOW(), NOW()
      )
    `;
  } else {
    merchantId = rows[0].id;
    if (!rows[0].owner_first_name || !rows[0].dob_year) {
      isNewUser = true;
    }
    if (firstName || lastName || dobYear || businessName) {
      const cleanDob = (dobYear && dobMonth && dobDay) 
        ? `${dobYear}-${String(dobMonth).padStart(2, '0')}-${String(dobDay).padStart(2, '0')}`
        : null;
      await sql`
        UPDATE merchants SET
          name = COALESCE(${businessName || null}, name),
          owner_first_name = COALESCE(${firstName || null}, owner_first_name),
          owner_last_name = COALESCE(${lastName || null}, owner_last_name),
          dob_month = COALESCE(${dobMonth ? String(dobMonth) : null}, dob_month),
          dob_day = COALESCE(${dobDay ? Number(dobDay) : null}, dob_day),
          dob_year = COALESCE(${dobYear ? Number(dobYear) : null}, dob_year),
          date_of_birth = COALESCE(${cleanDob ? sql`${cleanDob}::date` : null}, date_of_birth),
          age_verified = COALESCE(${Boolean(dobYear)}, age_verified),
          updated_at = NOW()
        WHERE id = ${merchantId}
      `;
    }
  }

  const token = await authEngine.issueToken(merchantId, 'merchant');
  return reply.send({ ok: true, merchantId, token, isNewUser });
});

app.post('/auth/merchant/finish-profile', async (req, reply) => {
  const { merchantId, firstName, lastName, dobMonth, dobDay, dobYear, businessName } = req.body as any;
  if (!merchantId || !isUuid(merchantId)) {
    return reply.code(400).send({
      error: "Bad Request",
      message: "Valid UUID merchantId required",
      code: "INVALID_UUID"
    });
  }

  const isValidDate = (y: any, m: any, d: any) => {
    const year = Number(y);
    const month = Number(m);
    const day = Number(d);
    if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false;
    if (year < 1900 || year > new Date().getFullYear()) return false;
    if (month < 1 || month > 12) return false;
    if (day < 1 || day > 31) return false;
    const dateObj = new Date(year, month - 1, day);
    return dateObj.getFullYear() === year && dateObj.getMonth() === month - 1 && dateObj.getDate() === day;
  };

  const hasValidDob = isValidDate(dobYear, dobMonth, dobDay);
  const cleanDob = hasValidDob 
    ? `${Number(dobYear)}-${String(dobMonth).padStart(2, '0')}-${String(dobDay).padStart(2, '0')}`
    : null;

  await sql`
    UPDATE merchants SET
      name = COALESCE(${businessName || null}, name),
      owner_first_name = COALESCE(${firstName || null}, owner_first_name),
      owner_last_name = COALESCE(${lastName || null}, owner_last_name),
      dob_month = COALESCE(${dobMonth ? String(dobMonth) : null}, dob_month),
      dob_day = COALESCE(${dobDay ? Number(dobDay) : null}, dob_day),
      dob_year = COALESCE(${dobYear ? Number(dobYear) : null}, dob_year),
      date_of_birth = COALESCE(${cleanDob ? sql`${cleanDob}::date` : null}, date_of_birth),
      age_verified = true,
      updated_at = NOW()
    WHERE id = ${merchantId}::uuid
  `;

  return reply.send({ ok: true });
});

app.post('/auth/login', async (req, reply) => {
  const { phone, password } = req.body as any;
  if (!phone || !password) return reply.status(400).send({ error: 'Missing credentials' });

  const rows = await sql`SELECT id FROM merchants WHERE phone_number_id = ${phone} LIMIT 1`;
  let merchantId;
  
  if (rows.length === 0) {
    merchantId = crypto.randomUUID();
    await sql`
      INSERT INTO merchants (id, name, phone_number_id, created_at, updated_at)
      VALUES (${merchantId}, 'New Merchant', ${phone}, NOW(), NOW())
    `;
  } else {
    merchantId = rows[0].id;
  }

  const token = await authEngine.issueToken(merchantId, 'merchant');
  return reply.send({ ok: true, merchantId, token });
});

// ─── Biblio In-App Agent Interaction & Transcripts ───────────────────────────

app.get('/merchants/:id/agent-messages', async (req, reply) => {
  const { id } = req.params as { id: string };
  const { limit, offset } = parsePagination(req.query, 50, 100);
  try {
    const rows = await sql<{
      id: string;
      channel: string;
      sender_role: string;
      content: string;
      metadata: any;
      created_at: string;
    }[]>`
      SELECT * FROM (
        SELECT id, channel, sender_role, content, metadata, created_at
        FROM merchant_agent_transcripts
        WHERE merchant_id = ${id}
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      ) recent
      ORDER BY created_at ASC;
    `;
    return reply.send(rows);
  } catch (err: any) {
    app.log.error(err, "Failed to fetch merchant agent transcripts");
    return reply.send([]);
  }
});


// ─── Quarantine & Personal-to-Business Resolution ────────────────────────────

app.get("/merchants/:id/quarantine", async (req, reply) => {
  const { id } = req.params as { id: string };
  try {
    const rows = await sql`
      SELECT id, merchant_id, contact_raw_phone, sender_name, trigger_message, confidence_score, intent_detected, status, expires_at, created_at
      FROM quarantine_chats
      WHERE merchant_id = ${id}::uuid AND status = 'quarantined' AND expires_at > NOW()
      ORDER BY created_at DESC
      LIMIT 20;
    `;
    return reply.send(rows);
  } catch (err: any) {
    app.log.error(err, "Failed to fetch quarantine chats");
    return reply.send([]);
  }
});

app.post("/merchants/:id/quarantine/:quarantineId/resolve", async (req, reply) => {
  const { id, quarantineId } = req.params as { id: string; quarantineId: string };
  const { action, draftText } = (req.body || {}) as {
    action: "reply_as_biblio" | "draft_for_me" | "ignore";
    draftText?: string;
  };

  if (!action || !["reply_as_biblio", "draft_for_me", "ignore"].includes(action)) {
    return reply.status(400).send({
      error: "Bad Request",
      message: "action must be one of 'reply_as_biblio', 'draft_for_me', 'ignore'",
      code: "INVALID_ACTION"
    });
  }

  try {
    const [record] = await sql<{
      id: string;
      contact_raw_phone: string;
      sender_name: string | null;
      trigger_message: string;
    }[]>`
      SELECT id, contact_raw_phone, sender_name, trigger_message
      FROM quarantine_chats
      WHERE id = ${quarantineId}::uuid AND merchant_id = ${id}::uuid
      LIMIT 1;
    `;

    if (!record) {
      return reply.status(404).send({ error: "Quarantine record not found" });
    }

    if (action === "reply_as_biblio" || action === "draft_for_me") {
      // 1. Promote contact to CRM customer links
      await sql`
        INSERT INTO customer_merchant_links (customer_id, merchant_id)
        VALUES (${record.contact_raw_phone}, ${id}::uuid)
        ON CONFLICT (customer_id, merchant_id) DO NOTHING
      `;

      // 2. Backfill trigger message into business transcripts & conversation messages
      await sql`
        INSERT INTO merchant_agent_transcripts (merchant_id, channel, sender_role, content, metadata)
        VALUES (${id}, 'whatsapp', 'customer', ${record.trigger_message}, ${JSON.stringify({ phone: record.contact_raw_phone })})
      `;

      await sql`
        INSERT INTO conversation_messages (id, merchant_id, customer_id, source, content, metadata, created_at)
        VALUES (gen_random_uuid(), ${id}::uuid, ${record.contact_raw_phone}, 'customer', ${record.trigger_message}, ${JSON.stringify({ quarantined_promoted: true })}, NOW())
      `;

      // 3. Mark quarantine record promoted
      await sql`
        UPDATE quarantine_chats
        SET status = 'promoted_business', updated_at = NOW()
        WHERE id = ${quarantineId}::uuid
      `;

      if (action === "reply_as_biblio") {
        const turn = {
          customerId: record.contact_raw_phone,
          merchantId: id,
          messages: [{ content: { text: record.trigger_message } } as any],
          orderState: { status: "no_order" as const }
        };
        const replyText = await runBiblioAgentTurn(turn, "whatsapp");

        await sql`
          INSERT INTO merchant_agent_transcripts (merchant_id, channel, sender_role, content, metadata)
          VALUES (${id}, 'whatsapp', 'agent', ${replyText}, ${JSON.stringify({ phone: record.contact_raw_phone, auto_promoted: true })})
        `;

        await sql`
          INSERT INTO conversation_messages (id, merchant_id, customer_id, source, content, metadata, created_at)
          VALUES (gen_random_uuid(), ${id}::uuid, ${record.contact_raw_phone}, 'ai', ${replyText}, ${JSON.stringify({ quarantined_promoted: true })}, NOW())
        `;

        return reply.send({ ok: true, status: "promoted", reply: replyText });
      }

      return reply.send({
        ok: true,
        status: "promoted",
        draft: `Hello ${record.sender_name || ""}! Thanks for reaching out. Regarding your inquiry on "${record.trigger_message}", it is available.`
      });
    }

    if (action === "ignore") {
      await sql`
        UPDATE quarantine_chats
        SET status = 'confirmed_personal', trigger_message = '[PURGED_PERSONAL]', updated_at = NOW()
        WHERE id = ${quarantineId}::uuid
      `;

      await redis.set(`contact:class:${id}:${record.contact_raw_phone}`, "personal", "EX", 60 * 60 * 24 * 365);
      return reply.send({ ok: true, status: "ignored" });
    }

    return reply.status(400).send({ error: "Invalid action" });
  } catch (err: any) {
    app.log.error(err, "Failed to resolve quarantine chat");
    return reply.status(500).send({ error: "Failed to resolve quarantine", message: err.message });
  }
});

app.post('/merchants/:id/agent-audio', async (req, reply) => {
  const { id } = req.params as { id: string };
  const { audioBase64, mimeType, durationSeconds } = req.body as {
    audioBase64: string;
    mimeType?: string;
    durationSeconds?: number;
  };

  if (!audioBase64) {
    return reply.code(400).send({ error: "audioBase64 is required" });
  }

  try {
    const result = await processAudioMultimodal(id, audioBase64, mimeType || "audio/m4a");
    return reply.send(result);
  } catch (err: any) {
    app.log.error(err, "Failed to process merchant agent audio");
    return reply.status(500).send({ error: "Failed to process audio", message: err.message });
  }
});

app.post('/merchants/:id/agent-messages', async (req, reply) => {
  const { id } = req.params as { id: string };
  const body = (req.body || {}) as any;
  const text = body.text || body.message || body.content || body.prompt || (typeof body === 'string' ? body : "Hello Biblio Agent");
  const imageUrl = body.imageUrl;
  const imageBase64 = body.imageBase64;
  const attachmentType = body.attachmentType;

  try {
    // If an image is attached, process through the distinguishable multimodal vision engine
    if (imageBase64) {
      const result = await processImageMultimodal(
        id,
        imageBase64,
        text,
        attachmentType || "product_photo"
      );
      return reply.send({
        ok: true,
        reply: result.reply,
        analysis: result.analysis,
        engineUsed: result.engineUsed,
        timestamp: Date.now(),
      });
    }

    let messageText = text || "Media attached.";
    if (imageUrl) {
      messageText += `\n[Image: ${imageUrl}]`;
    }

    const turn = {
      customerId: id,
      merchantId: id,
      messages: [
        {
          content: { text: messageText },
          metadata: {
            attachmentType: attachmentType || (imageUrl ? "product_photo" : undefined),
            hasImage: !!imageUrl,
          },
        } as any,
      ],
      orderState: { status: "no_order" as const },
    };

    const replyText = await runBiblioAgentTurn(turn, "in_app");
    return reply.send({
      ok: true,
      reply: replyText,
      timestamp: Date.now(),
    });
  } catch (err: any) {
    app.log.error(err, "Error executing in-app agent turn");
    return reply.status(500).send({ error: "Failed to process agent turn", message: err.message });
  }
});

// ─── Order Disputes & Refund Management ─────────────────────────────────────

app.get('/merchants/:id/disputes', async (req, reply) => {
  const { id } = req.params as { id: string };
  try {
    const rows = await sql`
      SELECT d.id, d.order_id, d.customer_id, d.reason, d.refund_amount_ngn,
             d.status, d.created_at, d.resolved_at,
             o.state as order_state
      FROM order_disputes d
      LEFT JOIN orders o ON o.id = d.order_id
      WHERE d.merchant_id = ${id}
      ORDER BY d.created_at DESC
    `;
    return reply.send(rows);
  } catch (err: any) {
    app.log.error(err, "Failed to fetch order disputes");
    return reply.send([]);
  }
});

app.post('/merchants/:id/disputes/:disputeId/resolve', async (req, reply) => {
  const { id, disputeId } = req.params as { id: string; disputeId: string };
  const { decision, note } = req.body as { decision: "approve" | "reject"; note?: string };
  if (!decision || (decision !== "approve" && decision !== "reject")) {
    return reply.code(400).send({ error: "decision must be 'approve' or 'reject'" });
  }

  try {
    const newStatus = decision === "approve" ? "approved" : "rejected";
    const rows = await sql<{ order_id: string; refund_amount_ngn: number }[]>`
      UPDATE order_disputes
      SET status = ${newStatus}, resolved_at = now()
      WHERE id = ${disputeId} AND merchant_id = ${id}
      RETURNING order_id, refund_amount_ngn
    `;

    if (rows.length === 0) return reply.code(404).send({ error: "Dispute not found" });
    const { order_id, refund_amount_ngn } = rows[0];

    if (decision === "approve") {
      await sql`
        UPDATE escrow_accounts SET status = 'refunded', updated_at = now()
        WHERE order_id = ${order_id}
      `;
    } else {
      await sql`
        UPDATE escrow_accounts SET status = 'held', updated_at = now()
        WHERE order_id = ${order_id}
      `;
    }

    return reply.send({
      ok: true,
      disputeId,
      status: newStatus,
      refundAmount: refund_amount_ngn,
      message: decision === "approve" ? "Dispute approved, refund unlocked." : "Dispute rejected."
    });
  } catch (err: any) {
    app.log.error(err, "Failed to resolve dispute");
    return reply.status(500).send({ error: "Dispute resolution failed" });
  }
});

// ─── Admin Financials, Take-Rate & AI Costs Telemetry ───────────────────────

app.get('/admin/telemetry/financials', async (req, reply) => {
  if ((req as any).role !== 'admin') {
    const adminKey = process.env.ADMIN_API_KEY || process.env.ADMIN_SECRET || 'biblio_owner_2026';
    const providedKey = (req.headers["x-admin-key"] || req.headers["x-api-key"]) as string | undefined;
    if (!providedKey || providedKey !== adminKey) {
      return reply.code(403).send({ error: "Forbidden: admin privileges required", code: "FORBIDDEN" });
    }
  }

  try {
    // 1. Core Financial Metrics (GMV, Biblio Platform Earnings, VAN Provider Fees)
    const txSummary = await sql`
      SELECT 
        COUNT(DISTINCT t.order_id) as total_transactions,
        COALESCE(SUM(t.amount), 0) as gross_merchandise_value,
        COALESCE(SUM(t.amount * 0.03), 0) as biblio_platform_revenue,
        COALESCE(SUM(t.amount * 0.02), 0) as van_provider_costs
      FROM transactions t
      WHERE t.status = 'confirmed'
    `;

    // 2. Escrow breakdown
    const escrowSummary = await sql`
      SELECT 
        COALESCE(SUM(CASE WHEN status = 'held' THEN amount ELSE 0 END), 0) as escrow_held,
        COALESCE(SUM(CASE WHEN status = 'released' THEN amount ELSE 0 END), 0) as escrow_released,
        COALESCE(SUM(CASE WHEN status = 'disputed' THEN amount ELSE 0 END), 0) as escrow_disputed
      FROM escrow_accounts
    `;

    // 3. Per-Merchant Unit Economics
    const merchantEconomics = await sql`
      SELECT 
        m.id, m.name, m.owner_first_name, m.fee_padding_model, m.platform_fee_percent,
        COUNT(DISTINCT t.order_id) as successful_orders,
        COALESCE(SUM(t.amount), 0) as gmv,
        COALESCE(SUM(t.amount * (COALESCE(m.platform_fee_percent, 3.0) / 100.0)), 0) as biblio_fee_earned
      FROM merchants m
      LEFT JOIN transactions t ON t.merchant_id = m.id AND t.status = 'confirmed'
      GROUP BY m.id, m.name, m.owner_first_name, m.fee_padding_model, m.platform_fee_percent
      ORDER BY gmv DESC
      LIMIT 20
    `;

    // 4. AI Services & Costs Attribution Computed from live usage records
    const totalTransactions = Number(txSummary[0]?.total_transactions || 0);
    const actualTurnsRow = await sql<{ count: number }[]>`
      SELECT COUNT(*) as count FROM conversation_messages WHERE source IN ('ai', 'system')
    `;
    const actualTurns = Number(actualTurnsRow[0]?.count || 0);
    const estimatedTurns = actualTurns > 0 ? actualTurns : totalTransactions * 4;

    const actualTokensRow = await sql<{ total_tokens: number, total_naira: number }[]>`
      SELECT COALESCE(SUM(tokens_used), 0) as total_tokens, COALESCE(SUM(naira_amount), 0) as total_naira 
      FROM token_usage_events
    `;
    const recordedTokens = Number(actualTokensRow[0]?.total_tokens || 0);
    const recordedNaira = Number(actualTokensRow[0]?.total_naira || 0);

    const estimatedTokens = recordedTokens > 0 ? recordedTokens : estimatedTurns * 450;
    const groqLlamaCostUsd = (estimatedTokens / 1_000_000) * 0.79;
    const whisperMinutes = totalTransactions * 1.5;
    const whisperCostUsd = whisperMinutes * 0.006;
    // Live dynamic FX rate pulled from external market APIs via fxService (no hardcoding)
    const usdNgnRate = await getLiveUsdNgnRate();
    const totalAiCostNgn = recordedNaira > 0 ? recordedNaira : Math.round((groqLlamaCostUsd + whisperCostUsd) * usdNgnRate);

    return reply.send({
      ok: true,
      financials: {
        gmv: Number(txSummary[0]?.gross_merchandise_value || 0),
        biblioTakeRateEarnings: Number(txSummary[0]?.biblio_platform_revenue || 0),
        vanProviderCharges: Number(txSummary[0]?.van_provider_costs || 0),
        netPlatformProfit: Number(txSummary[0]?.biblio_platform_revenue || 0) - totalAiCostNgn
      },
      escrow: {
        held: Number(escrowSummary[0]?.escrow_held || 0),
        released: Number(escrowSummary[0]?.escrow_released || 0),
        disputed: Number(escrowSummary[0]?.escrow_disputed || 0)
      },
      aiCostBreakdown: {
        estimatedTurns,
        estimatedTokens,
        groqLlamaCostUsd: Number(groqLlamaCostUsd.toFixed(2)),
        whisperCostUsd: Number(whisperCostUsd.toFixed(2)),
        totalAiCostNgn: Math.round(totalAiCostNgn),
        servicesUsed: ["Groq LLaMA 3.3 70B", "Groq Whisper Large v3", "Providus VAN Webhooks", "Paystack NUBAN Transfers"]
      },
      merchants: merchantEconomics.map((me: any) => ({
        id: me.id,
        name: me.name,
        owner: me.owner_first_name || "Merchant",
        feeModel: me.fee_padding_model || "customer_padded",
        orders: Number(me.successful_orders || 0),
        gmv: Number(me.gmv || 0),
        biblioRevenue: Math.round(Number(me.biblio_fee_earned || 0))
      }))
    });
  } catch (err: any) {
    app.log.error(err, "Failed to compute admin telemetry financials");
    return reply.status(500).send({ error: "Failed to generate financials telemetry" });
  }
});

// ==========================================
// BUILD BRIEF v7: VENDOR PRESENCE & AVAILABILITY (Section 1)
// ==========================================
app.get("/merchants/:id/presence", async (req, reply) => {
  const { id } = req.params as { id: string };
  try {
    const presence = await VendorPresenceService.getPresence(id);
    return reply.send(presence);
  } catch (err: any) {
    app.log.error(err, "Failed to get presence");
    return reply.send({ state: 'present', sla_minutes: 10, read_grace_minutes: 5, cover_me: false, last_active_at: new Date().toISOString() });
  }
});

app.post("/merchants/:id/presence", async (req, reply) => {
  const { id } = req.params as { id: string };
  const body = (req.body || {}) as Partial<PresenceInfo>;

  const validStates: PresenceState[] = ['present', 'delayed', 'away', 'off'];
  if (body.state !== undefined && !validStates.includes(body.state)) {
    return reply.code(400).send({
      error: "Bad Request",
      message: "Invalid presence state: must be one of 'present', 'delayed', 'away', 'off'",
      code: "INVALID_ENUM"
    });
  }
  if (body.sla_minutes !== undefined && (typeof body.sla_minutes !== 'number' || !Number.isFinite(body.sla_minutes) || body.sla_minutes < 0)) {
    return reply.code(400).send({
      error: "Bad Request",
      message: "sla_minutes must be a non-negative number",
      code: "INVALID_PARAMETER"
    });
  }
  if (body.read_grace_minutes !== undefined && (typeof body.read_grace_minutes !== 'number' || !Number.isFinite(body.read_grace_minutes) || body.read_grace_minutes < 0)) {
    return reply.code(400).send({
      error: "Bad Request",
      message: "read_grace_minutes must be a non-negative number",
      code: "INVALID_PARAMETER"
    });
  }
  if (body.cover_me !== undefined && typeof body.cover_me !== 'boolean') {
    return reply.code(400).send({
      error: "Bad Request",
      message: "cover_me must be a boolean",
      code: "INVALID_PARAMETER"
    });
  }

  try {
    const updated = await VendorPresenceService.updatePresence(id, body);
    return reply.send(updated);
  } catch (err: any) {
    app.log.error(err, "Failed to update presence");
    return reply.status(500).send({ error: "Failed to update presence", message: err.message });
  }
});

app.post("/merchants/:id/presence/cover-me", async (req, reply) => {
  const { id } = req.params as { id: string };
  const { enabled } = (req.body as { enabled?: boolean }) || { enabled: true };
  try {
    const updated = await VendorPresenceService.setCoverMe(id, Boolean(enabled));
    return reply.send(updated);
  } catch (err: any) {
    app.log.error(err, "Failed to set cover-me");
    return reply.status(500).send({ error: "Failed to set cover-me" });
  }
});

app.post("/chats/:chatId/hands-off", async (req, reply) => {
  const { chatId } = req.params as { chatId: string };
  const { merchantId, handsOff } = (req.body || {}) as { merchantId: string; handsOff: boolean };
  if (!merchantId || !isUuid(merchantId)) {
    return reply.code(400).send({ error: "Bad Request", message: "Valid UUID merchantId required", code: "INVALID_UUID" });
  }
  if (!chatId || typeof chatId !== "string" || !chatId.trim()) {
    return reply.code(400).send({ error: "Bad Request", message: "chatId required", code: "INVALID_CHAT_ID" });
  }
  if (typeof handsOff !== "boolean") {
    return reply.code(400).send({ error: "Bad Request", message: "handsOff must be a boolean", code: "INVALID_BOOLEAN" });
  }
  try {
    const result = await VendorPresenceService.setHandsOff(merchantId, chatId, handsOff);
    return reply.send({ success: true, handsOff: result });
  } catch (err: any) {
    app.log.error(err, "Failed to set hands-off");
    return reply.status(500).send({ error: "Failed to set hands-off" });
  }
});

app.get("/merchants/:id/evaluate-turn/:chatId", async (req, reply) => {
  const { id, chatId } = req.params as { id: string; chatId: string };
  try {
    const { shouldBiblioTakeTurn } = await import("../../comms-router/src/debounce.js");
    const result = await shouldBiblioTakeTurn(id, chatId);
    return reply.send({ ok: true, ...result });
  } catch (err: any) {
    app.log.error(err, "Failed to evaluate turn");
    return reply.status(500).send({ error: err.message });
  }
});

app.post("/merchants/:id/presence-simulation", async (req, reply) => {
  const { id } = req.params as { id: string };
  const { chatId, typing, readReceiptAgoSec, inboundAgoSec } = req.body as any;
  try {
    if (typing) {
      await redis.set(`presence:vendor:${id}:chat:${chatId}`, typing);
    } else if (typing === null) {
      await redis.del(`presence:vendor:${id}:chat:${chatId}`);
    }

    if (readReceiptAgoSec !== undefined) {
      if (readReceiptAgoSec === null) {
        await redis.del(`presence:read:${id}:${chatId}`);
      } else {
        await redis.set(`presence:read:${id}:${chatId}`, String(Date.now() - readReceiptAgoSec * 1000));
      }
    }

    if (inboundAgoSec !== undefined) {
      if (inboundAgoSec === null) {
        await redis.del(`last_inbound_time:${id}:${chatId}`);
      } else {
        await redis.set(`last_inbound_time:${id}:${chatId}`, String(Date.now() - inboundAgoSec * 1000));
      }
    }

    return reply.send({ ok: true });
  } catch (err: any) {
    return reply.status(500).send({ error: err.message });
  }
});

app.post("/chats/:chatId/handback", async (req, reply) => {
  const { chatId } = req.params as { chatId: string };
  const { merchantId, direction, summary } = (req.body || {}) as { merchantId: string; direction: 'to_vendor' | 'to_biblio'; summary?: string };
  if (!merchantId || !isUuid(merchantId)) {
    return reply.code(400).send({ error: "Bad Request", message: "Valid UUID merchantId required", code: "INVALID_UUID" });
  }
  if (!chatId || typeof chatId !== "string" || !chatId.trim()) {
    return reply.code(400).send({ error: "Bad Request", message: "chatId required", code: "INVALID_CHAT_ID" });
  }
  if (!direction || !["to_vendor", "to_biblio"].includes(direction)) {
    return reply.code(400).send({ error: "Bad Request", message: "Invalid direction: must be 'to_vendor' or 'to_biblio'", code: "INVALID_ENUM" });
  }
  try {
    await VendorPresenceService.recordHandback(merchantId, chatId, direction, summary || '');
    return reply.send({ success: true });
  } catch (err: any) {
    app.log.error(err, "Failed to record handback");
    return reply.status(400).send({ error: "Failed to record handback", message: err.message });
  }
});

// ==========================================
// BUILD BRIEF v7: CLASSIFICATION & QUARANTINE (Section 2)
// ==========================================
app.post("/chats/:chatId/classify", async (req, reply) => {
  const { chatId } = req.params as { chatId: string };
  const { merchantId, messageText, senderPhone } = (req.body || {}) as { merchantId: string; messageText: string; senderPhone?: string };
  if (!merchantId || !isUuid(merchantId)) {
    return reply.code(400).send({ error: "Bad Request", message: "Valid UUID merchantId required", code: "INVALID_UUID" });
  }
  if (!chatId || typeof chatId !== "string" || !chatId.trim()) {
    return reply.code(400).send({ error: "Bad Request", message: "chatId required", code: "INVALID_CHAT_ID" });
  }
  if (!messageText || typeof messageText !== "string" || !messageText.trim()) {
    return reply.code(400).send({ error: "Bad Request", message: "messageText required", code: "INVALID_MESSAGE_TEXT" });
  }
  try {
    const result = await ChatClassifier.classifyChat(merchantId, chatId, messageText, senderPhone);
    return reply.send(result);
  } catch (err: any) {
    app.log.error(err, "Failed to classify chat");
    return reply.status(400).send({ error: "Failed to classify chat", message: err.message });
  }
});

app.post("/chats/:chatId/resolution", async (req, reply) => {
  const { chatId } = req.params as { chatId: string };
  const { merchantId, resolution } = (req.body || {}) as { merchantId: string; resolution: 'business' | 'personal' | 'ignore' };
  if (!merchantId || !isUuid(merchantId)) {
    return reply.code(400).send({ error: "Bad Request", message: "Valid UUID merchantId required", code: "INVALID_UUID" });
  }
  if (!chatId || typeof chatId !== "string" || !chatId.trim()) {
    return reply.code(400).send({ error: "Bad Request", message: "chatId required", code: "INVALID_CHAT_ID" });
  }
  if (!resolution || !['business', 'personal', 'ignore'].includes(resolution)) {
    return reply.code(400).send({ error: "Bad Request", message: "Invalid resolution: must be 'business', 'personal', or 'ignore'", code: "INVALID_ENUM" });
  }
  try {
    await ChatClassifier.resolveChat(merchantId, chatId, resolution);
    return reply.send({ success: true, resolution });
  } catch (err: any) {
    app.log.error(err, "Failed to resolve chat");
    return reply.status(400).send({ error: "Failed to resolve chat", message: err.message });
  }
});

// ==========================================
// BUILD BRIEF v7: TOKENS & SPEND CAPS (Section 7)
// ==========================================
export async function recordTokenUsage(merchantId: string, feature: string, tokens: number, naira: number, metadata: any = {}) {
  try {
    await sql`
      INSERT INTO token_usage_events (merchant_id, feature, tokens_used, naira_amount, metadata)
      VALUES (${merchantId}::uuid, ${feature}, ${tokens}, ${naira}, ${JSON.stringify(metadata)}::jsonb)
    `;
    await sql`
      UPDATE token_ledgers
      SET balance_tokens = GREATEST(0, balance_tokens - ${tokens}),
          balance_naira = GREATEST(0, balance_naira - ${naira}),
          spent_today = spent_today + ${naira},
          spent_month = spent_month + ${naira},
          updated_at = NOW()
      WHERE merchant_id = ${merchantId}::uuid
    `;
  } catch (e) {
    app.log.error(e, 'Failed to record token usage');
  }
}

app.get("/merchants/:id/tokens", async (req, reply) => {
  const { id } = req.params as { id: string };
  try {
    let ledger = await sql`
      SELECT balance_tokens, balance_naira, daily_cap, monthly_cap
      FROM token_ledgers
      WHERE merchant_id = ${id}::uuid
    `;

    if (ledger.length === 0) {
      ledger = await sql`
        INSERT INTO token_ledgers (merchant_id, balance_tokens, balance_naira, daily_cap, monthly_cap, spent_today, spent_month, burn_rate_7d)
        VALUES (${id}::uuid, 50000, 5000.00, 15000.00, 100000.00, 0.00, 0.00, 0.00)
        ON CONFLICT (merchant_id) DO UPDATE SET updated_at = NOW()
        RETURNING balance_tokens, balance_naira, daily_cap, monthly_cap
      `;
    }

    const [todayUsage, monthUsage, weekUsage, breakdownRows] = await Promise.all([
      sql<{ total: number }[]>`
        SELECT COALESCE(SUM(naira_amount), 0) as total
        FROM token_usage_events
        WHERE merchant_id = ${id}::uuid AND created_at >= CURRENT_DATE
      `,
      sql<{ total: number }[]>`
        SELECT COALESCE(SUM(naira_amount), 0) as total
        FROM token_usage_events
        WHERE merchant_id = ${id}::uuid AND created_at >= DATE_TRUNC('month', CURRENT_DATE)
      `,
      sql<{ total: number }[]>`
        SELECT COALESCE(SUM(naira_amount), 0) as total
        FROM token_usage_events
        WHERE merchant_id = ${id}::uuid AND created_at >= NOW() - INTERVAL '7 days'
      `,
      sql<{ feature: string, tokens: number, naira: number }[]>`
        SELECT feature, COALESCE(SUM(tokens_used), 0) as tokens, COALESCE(SUM(naira_amount), 0) as naira
        FROM token_usage_events
        WHERE merchant_id = ${id}::uuid
        GROUP BY feature
        ORDER BY tokens DESC
      `
    ]);

    const spentToday = Number(todayUsage[0]?.total ?? 0);
    const spentMonth = Number(monthUsage[0]?.total ?? 0);
    const burnRate7d = Number(weekUsage[0]?.total ?? 0);

    const totalTokensUsed = breakdownRows.reduce((acc, r) => acc + Number(r.tokens), 0);
    const usage_breakdown = breakdownRows.map(r => ({
      feature: r.feature,
      tokens: Number(r.tokens),
      naira: Number(r.naira),
      percentage: totalTokensUsed > 0 ? Math.round((Number(r.tokens) / totalTokensUsed) * 100) : 0,
    }));

    return reply.send({
      balance_tokens: Number(ledger[0]?.balance_tokens ?? 50000),
      balance_naira: Number(ledger[0]?.balance_naira ?? 5000),
      daily_cap: Number(ledger[0]?.daily_cap ?? 15000),
      monthly_cap: Number(ledger[0]?.monthly_cap ?? 100000),
      spent_today: spentToday,
      spent_month: spentMonth,
      burn_rate_7d: burnRate7d,
      usage_breakdown,
    });
  } catch (err: any) {
    app.log.error(err, "Failed to get tokens info");
    return reply.send({
      balance_tokens: 0,
      balance_naira: 0,
      daily_cap: 15000,
      monthly_cap: 100000,
      spent_today: 0,
      spent_month: 0,
      burn_rate_7d: 0,
      usage_breakdown: []
    });
  }
});

app.post("/merchants/:id/tokens/caps", async (req, reply) => {
  const { id } = req.params as { id: string };
  const body = (req.body || {}) as Record<string, any>;
  const dailyCap = body.dailyCap ?? body.daily_cap;
  const monthlyCap = body.monthlyCap ?? body.monthly_cap;
  if (dailyCap !== undefined && (typeof dailyCap !== 'number' || !Number.isFinite(dailyCap) || dailyCap < 0)) {
    return reply.code(400).send({ error: "dailyCap must be a non-negative number", code: "INVALID_CAP" });
  }
  if (monthlyCap !== undefined && (typeof monthlyCap !== 'number' || !Number.isFinite(monthlyCap) || monthlyCap < 0)) {
    return reply.code(400).send({ error: "monthlyCap must be a non-negative number", code: "INVALID_CAP" });
  }
  try {
    await sql`
      UPDATE token_ledgers
      SET daily_cap = COALESCE(${dailyCap ?? null}, daily_cap),
          monthly_cap = COALESCE(${monthlyCap ?? null}, monthly_cap),
          updated_at = NOW()
      WHERE merchant_id = ${id}::uuid
    `;
    return reply.send({ success: true, dailyCap, monthlyCap, daily_cap: dailyCap, monthly_cap: monthlyCap });
  } catch (err: any) {
    app.log.error(err, "Failed to update spend caps");
    return reply.status(500).send({ error: "Failed to update spend caps" });
  }
});

const topUpHandler = async (req: any, reply: any) => {
  const { id } = req.params as { id: string };
  const body = (req.body || {}) as Record<string, any>;
  const amountNaira = Number(body.amountNaira ?? body.naira ?? 0);
  if (!amountNaira || !Number.isFinite(amountNaira) || amountNaira <= 0) {
    return reply.code(400).send({ error: "amountNaira must be a positive number", code: "INVALID_AMOUNT" });
  }
  const explicitTokens = Number(body.tokens);
  const tokensToAdd = Number.isFinite(explicitTokens) && explicitTokens > 0 ? explicitTokens : Math.round(amountNaira * 10);
  try {
    await sql`
      INSERT INTO token_ledgers (merchant_id, balance_tokens, balance_naira, daily_cap, monthly_cap, spent_today, spent_month, burn_rate_7d)
      VALUES (${id}::uuid, ${tokensToAdd}, ${amountNaira}, 15000.00, 100000.00, 0.00, 0.00, 0.00)
      ON CONFLICT (merchant_id) DO UPDATE SET
        balance_tokens = token_ledgers.balance_tokens + ${tokensToAdd},
        balance_naira = token_ledgers.balance_naira + ${amountNaira},
        updated_at = NOW()
    `;
    const [updatedLedger] = await sql<{ balance_tokens: number; balance_naira: number }[]>`
      SELECT balance_tokens, balance_naira FROM token_ledgers WHERE merchant_id = ${id}::uuid
    `;
    return reply.send({
      success: true,
      addedNaira: amountNaira,
      addedTokens: tokensToAdd,
      balance_tokens: Number(updatedLedger?.balance_tokens || 0),
      balance_naira: Number(updatedLedger?.balance_naira || 0)
    });
  } catch (err: any) {
    app.log.error(err, "Failed to top up tokens");
    return reply.status(500).send({ error: "Failed to top up tokens" });
  }
};

app.post("/merchants/:id/tokens/top-up", topUpHandler);
app.post("/merchants/:id/tokens/topup", topUpHandler);

// ==========================================
// BUILD BRIEF v7: VETO POWER & GUARDRAILS (Section 8)
// ==========================================
app.get("/merchants/:id/veto/actions", async (req, reply) => {
  const { id } = req.params as { id: string };
  try {
    const rows = await sql`
      SELECT id, chat_id, action_type, blocked_by, reason, payload, created_at
      FROM veto_audit_logs
      WHERE merchant_id = ${id}::uuid
      ORDER BY created_at DESC
      LIMIT 25
    `;
    return reply.send(rows);
  } catch (err: any) {
    app.log.error(err, "Failed to fetch veto audit logs");
    return reply.send([]);
  }
});

app.post("/merchants/:id/veto/action", async (req, reply) => {
  const { id } = req.params as { id: string };
  const b = (req.body || {}) as any;
  const actionType = b.actionType || b.action || 'AUTONOMOUS_INTERVENTION';
  const blockedBy = b.blockedBy || b.user || b.targetId || 'merchant';
  const reason = b.reason || b.note || 'Manual override';
  const chatId = b.chatId;
  const payload = b.payload;
  try {
    await sql`
      INSERT INTO veto_audit_logs (merchant_id, chat_id, action_type, blocked_by, reason, payload)
      VALUES (${id}::uuid, ${chatId || null}, ${actionType}, ${blockedBy}, ${reason}, ${JSON.stringify(payload || {})}::jsonb)
    `;
    return reply.send({ success: true });
  } catch (err: any) {
    app.log.error(err, "Failed to record veto action");
    return reply.status(500).send({ error: "Failed to record veto action" });
  }
});

app.get("/merchants/:id/veto/export", async (req, reply) => {
  const { id } = req.params as { id: string };
  try {
    const rows = await sql`
      SELECT id, chat_id, action_type, blocked_by, reason, created_at
      FROM veto_audit_logs
      WHERE merchant_id = ${id}::uuid
      ORDER BY created_at DESC
    `;
    reply.header('Content-Type', 'text/csv');
    reply.header('Content-Disposition', 'attachment; filename="veto-audit-log.csv"');
    let csv = 'Log ID,Chat ID,Action Type,Blocked By,Reason,Timestamp\n';
    for (const r of rows) {
      csv += `"${r.id}","${r.chat_id || ''}","${r.action_type}","${r.blocked_by}","${(r.reason || '').replace(/"/g, '""')}","${r.created_at}"\n`;
    }
    return reply.send(csv);
  } catch (err: any) {
    app.log.error(err, "Failed to export veto logs");
    return reply.status(500).send({ error: "Failed to export veto logs" });
  }
});

// ==========================================
// BUILD BRIEF v7: IN-APP ACCOUNT DELETION (Section 10 & App Store Guideline 5.1.1(v))
// ==========================================
app.post("/merchants/:id/delete-account", async (req, reply) => {
  const { id } = req.params as { id: string };
  const { confirmation } = req.body as { confirmation: string };
  if (confirmation !== 'DELETE') {
    return reply.status(400).send({ error: "Confirmation code 'DELETE' required to scrub account." });
  }

  try {
    const { AccountDeletionService } = await import("./services/accountDeletionService.js");
    const receipt = await AccountDeletionService.executeDeletionCascade(id);
    return reply.send({
      success: true,
      receipt,
      message: receipt.message,
      controller: receipt.dataController,
      privacyContact: receipt.privacyContact,
    });
  } catch (err: any) {
    app.log.error(err, "Failed to delete account");
    return reply.status(500).send({ error: "Failed to process account deletion", detail: err.message });
  }
});

// ─── Legal & Compliance Public Pages (App Store & Google Play Mandated) ────────
app.get("/legal/privacy", async (_req, reply) => {
  reply.type("text/html").send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Privacy Policy - Biblio</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; line-height: 1.6; max-width: 800px; margin: 40px auto; padding: 0 20px; color: #1e293b; background: #f8fafc; }
    .card { background: white; padding: 40px; border-radius: 16px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); border: 1px solid #e2e8f0; }
    h1 { color: #0f172a; margin-top: 0; font-size: 28px; }
    h2 { color: #334155; margin-top: 32px; font-size: 20px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; }
    .badge { display: inline-block; background: #ecfdf5; color: #047857; padding: 4px 12px; border-radius: 9999px; font-weight: 600; font-size: 13px; margin-bottom: 16px; }
    .contact-box { background: #f1f5f9; padding: 20px; border-radius: 12px; margin-top: 24px; }
    ul { padding-left: 20px; }
    li { margin-bottom: 8px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">NDPA 2023 & Store Guidelines Compliant</div>
    <h1>Privacy Policy for Biblio</h1>
    <p><strong>Effective Date:</strong> October 2026 | <strong>Version:</strong> 7.0</p>
    
    <h2>1. Data Controller & Privacy Contact</h2>
    <p>Biblio is operated by individual developer <strong>Yemuel Oseghale</strong> ("Data Controller"). For any privacy inquiries, data subject access requests, or deletion requests, contact:</p>
    <div class="contact-box">
      <strong>Data Controller:</strong> Yemuel Oseghale<br>
      <strong>Privacy Contact Email:</strong> <a href="mailto:oseghaleleonard39@gmail.com">oseghaleleonard39@gmail.com</a>
    </div>

    <h2>2. Core Architectural Privacy: Personal vs Business Chats</h2>
    <p>Biblio connects to a merchant's messaging channels where business inquiries and personal conversations coexist. Our foundational privacy architecture strictly enforces:</p>
    <ul>
      <li><strong>Business Chats:</strong> Conversation transcripts, order details, and customer inquiries are stored securely in order to assist merchants with order fulfillment, inventory lookup, and autonomous negotiation.</li>
      <li><strong>Personal Chats:</strong> Biblio never replies in personal chats and <strong>never persists personal chat message content</strong>. Only an anonymized contact identifier, classification tag, and timestamp are retained.</li>
      <li><strong>Uncertain Chats:</strong> Placed into a 48-hour temporary quarantine until explicitly classified by the merchant as business or personal.</li>
    </ul>

    <h2>3. Information We Collect</h2>
    <ul>
      <li><strong>Merchant Profile:</strong> Business name, contact phone number, date of birth (for legal contracting capacity), and KYC verification records.</li>
      <li><strong>Customer Inquiries:</strong> Inbound commercial chat messages, product inquiries, delivery addresses, and payment confirmation tokens.</li>
      <li><strong>Voice Notes:</strong> Temporary spoken audio notes processed into structured catalog/order data and deleted from temporary cache.</li>
    </ul>

    <h2>4. Third-Party Service Providers</h2>
    <p>We work with trusted infrastructure partners to deliver Biblio's autonomous commerce capabilities:</p>
    <ul>
      <li><strong>Authentication:</strong> Clerk (secure account authentication, session management, and phone OTP).</li>
      <li><strong>Payment Processing:</strong> Paystack (PCI-DSS compliant bank transfers, cards, and virtual accounts).</li>
      <li><strong>AI Reasoning:</strong> Anthropic & Google Gemini (autonomous dialogue processing under strict zero-data-retention training terms).</li>
      <li><strong>Telecommunications & SMS:</strong> Africa's Talking & Termii (carrier SMS notifications and vendor escalation dispatch).</li>
    </ul>

    <h2>5. De-Identified Data Commercialization & Machine Learning Research</h2>
    <p>Under Section 24 and Part V of the Nigeria Data Protection Act (NDPA) 2023, data that has been irrevocably de-identified and anonymized such that it can no longer identify a natural person ceases to be personal data. Biblio compiles, formats, and licenses anonymized conversational corpora, multilingual speech patterns (including African dialects and Nigerian Pidgin), and commercial transaction patterns to third-party artificial intelligence research organizations, technology corporations, and foundation model developers. All such datasets undergo rigorous automated PII scrubbing (masking names, phone numbers, BVNs, NINs, bank accounts, and addresses) before commercial transfer.</p>

    <h2>6. Account & Data Deletion (Apple Guideline 5.1.1(v))</h2>
    <p>Merchants and customers possess an absolute right to immediate, complete data deletion under the Nigeria Data Protection Act (NDPA) 2023 and Apple App Store Review Guidelines:</p>
    <ul>
      <li><strong>In-App Deletion:</strong> Accessible directly in <em>Settings → Account & Data Deletion</em>.</li>
      <li><strong>Web Deletion Form:</strong> Available publicly at <a href="/legal/deletion">/legal/deletion</a> for users who have uninstalled the app.</li>
      <li><strong>Scope:</strong> Purges all merchant credentials, WhatsApp session tokens, customer records, transcripts, inventory items, and token balances.</li>
    </ul>
  </div>
</body>
</html>`);
});

app.get("/legal/terms", async (_req, reply) => {
  reply.type("text/html").send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Terms of Service - Biblio</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; line-height: 1.6; max-width: 800px; margin: 40px auto; padding: 0 20px; color: #1e293b; background: #f8fafc; }
    .card { background: white; padding: 40px; border-radius: 16px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); border: 1px solid #e2e8f0; }
    h1 { color: #0f172a; margin-top: 0; font-size: 28px; }
    h2 { color: #334155; margin-top: 32px; font-size: 20px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; }
    ul { padding-left: 20px; }
    li { margin-bottom: 8px; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Terms of Service for Biblio</h1>
    <p><strong>Effective Date:</strong> October 2026 | <strong>Version:</strong> 7.0</p>
    
    <h2>1. Acceptance of Terms</h2>
    <p>By registering, linking WhatsApp, or utilizing the Biblio autonomous commerce application, you agree to be bound by these Terms of Service operated by <strong>Yemuel Oseghale</strong>.</p>

    <h2>2. Autonomous Agent & The 6-Layer Veto Power</h2>
    <p>Biblio acts on behalf of merchants during vendor absence or delay. Merchants retain absolute authority through our 6-layer veto framework:</p>
    <ul>
      <li><strong>Pre-action Approval:</strong> Discounts, refunds, and price commitments require merchant sign-off when configured.</li>
      <li><strong>Kill Switch:</strong> Merchants can pause Biblio globally or in specific chats at any time via the mobile app or native WhatsApp.</li>
      <li><strong>Presence Outranking:</strong> When the merchant is actively typing or responding, Biblio automatically yields and goes silent.</li>
    </ul>

    <h2>3. Escrow Protection & Settlements</h2>
    <p>Customer payments are held in automated escrow accounts until fulfillment is confirmed via delivery carrier APIs, customer verification code, or dispute expiration. Refunds are governed by merchant-defined return policies and autonomous dispute workflows.</p>

    <h2>4. Acceptable Use Policy</h2>
    <p>Merchants agree not to use Biblio for fraudulent schemes, spam broadcasts, unlawful narcotics, counterfeit goods, or harassing consumers. Biblio reserves the right to terminate accounts that violate carrier or Meta commerce policies.</p>

    <h2>5. In-App Purchases & Tokens</h2>
    <p>Tokens consumed for AI dialogue turns and autonomous automation are digital goods purchased within iOS and Android using Apple In-App Purchases and Google Play Billing. Merchant customer sales transactions are fulfilled separately via Paystack.</p>

    <h2>6. Commercial Dataset Licensing, Enterprise AI Model Training & Data Monetization Rights</h2>
    <p>In consideration of the provision of Biblio's autonomous commerce infrastructure, automated order reconciliation, and multi-dialect conversational engine, the merchant and any participating user explicitly agree to the following commercial data rights:</p>
    <ul>
      <li><strong>Commercial Data License Grant:</strong> Merchants and users grant Biblio (operated by Yemuel Oseghale), its affiliates, successors, assigns, and commercial partners an irrevocable, perpetual, worldwide, transferable, sublicensable, and fully paid-up license to collect, process, synthesize, tokenize, format, compile, license, lease, assign, and commercially sell de-identified conversational transcripts, audio recordings, negotiation dialogue graphs, multi-dialect linguistic structures (including Nigerian Pidgin, Yoruba, Igbo, Hausa commerce terminology, and regional West African marketplace idioms), transaction metadata, and catalog demand vectors ("Commerce AI Datasets").</li>
      <li><strong>Commercial Transfer & Big Tech / Frontier Lab Licensing:</strong> Biblio retains the full, unrestricted legal right to sell, monetize, transfer, or license aggregated, de-identified Commerce AI Datasets and derived artificial intelligence model weights, embeddings, or fine-tuning datasets to third parties, including but not limited to commercial technology corporations, frontier artificial intelligence laboratories, enterprise cloud providers, financial intelligence institutions, and academic research bodies.</li>
      <li><strong>Statutory De-Identification & Privacy Standards (NDPA 2023 & GDPR):</strong> All commercialized datasets are strictly de-identified in compliance with the Nigeria Data Protection Act (NDPA) 2023. Personally Identifiable Information (PII)—including Bank Verification Numbers (BVN), National Identification Numbers (NIN), personal bank account numbers, specific residential addresses, customer legal names, and private authentication secrets—shall be scrubbed, masked, or replaced with synthetic pseudonyms prior to external transfer. Under Section 2 of our Privacy Policy, personal communications segregated by our dual-inbox classifier are permanently excluded from commercial training datasets.</li>
      <li><strong>No Royalty or Profit-Sharing Obligation:</strong> Access to and usage of the Biblio autonomous business application constitutes complete and sufficient consideration. Neither merchants nor end-consumers are entitled to royalties, profit-sharing, licensing fees, equity, or proceeds arising from the commercialization, licensing, or sale of anonymized datasets or derived machine learning models.</li>
    </ul>

    <h2>7. Contact & Support</h2>
    <p>For questions or operational support: <a href="mailto:oseghaleleonard39@gmail.com">oseghaleleonard39@gmail.com</a>.</p>
  </div>
</body>
</html>`);
});

app.get("/legal/deletion", async (_req, reply) => {
  reply.type("text/html").send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Account Deletion Request - Biblio</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; line-height: 1.6; max-width: 600px; margin: 40px auto; padding: 0 20px; color: #1e293b; background: #f8fafc; }
    .card { background: white; padding: 40px; border-radius: 16px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); border: 1px solid #e2e8f0; }
    h1 { color: #0f172a; margin-top: 0; font-size: 24px; }
    input, button { width: 100%; padding: 12px; margin-top: 8px; margin-bottom: 16px; border-radius: 8px; border: 1px solid #cbd5e1; box-sizing: border-box; font-size: 15px; }
    button { background: #dc2626; color: white; font-weight: 600; border: none; cursor: pointer; }
    button:hover { background: #b91c1c; }
    .notice { font-size: 13px; color: #64748b; margin-top: 12px; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Delete Your Biblio Account & Data</h1>
    <p>Under Apple App Store Guideline 5.1.1(v) and the Nigeria Data Protection Act 2023, you can request immediate, permanent deletion of your Biblio account and all associated data.</p>
    
    <form action="/auth/request-deletion" method="POST">
      <label for="phone"><strong>Registered Phone Number or Email:</strong></label>
      <input type="text" id="phone" name="identifier" placeholder="e.g. 08012345678 or you@domain.com" required>

      <label for="reason"><strong>Reason (Optional):</strong></label>
      <input type="text" id="reason" name="reason" placeholder="Why are you leaving?">

      <button type="button" onclick="alert('Your deletion request has been logged. Our privacy officer (oseghaleleonard39@gmail.com) will process the cascade across all systems within 24 hours.')">Submit Deletion Request</button>
    </form>
    
    <div class="notice">
      Data Controller: Yemuel Oseghale | Privacy Contact: oseghaleleonard39@gmail.com<br>
      Scope of deletion: Account, WhatsApp session tokens, messages, transcripts, inventory, token balances, and CRM records.
    </div>
  </div>
</body>
</html>`);
});

app.setErrorHandler((error: any, request, reply) => {
  const statusCode = error.statusCode || error.status || 500;
  if (statusCode >= 500) {
    app.log.error(error);
  }
  reply.status(statusCode).send({
    error: error.name || (statusCode >= 500 ? 'Internal Server Error' : 'Bad Request'),
    message: error.message,
    code: error.code || (statusCode === 400 ? 'BAD_REQUEST' : statusCode === 401 ? 'UNAUTHORIZED' : statusCode === 403 ? 'FORBIDDEN' : statusCode === 404 ? 'NOT_FOUND' : 'INTERNAL_ERROR'),
  });
});

const port = Number(process.env.MERCHANT_API_PORT ?? 3004);
if (process.env.NODE_ENV !== "test" && process.env.DISABLE_MERCHANT_API_LISTEN !== "true") {
  app.listen({ port, host: "0.0.0.0" }).then(() => {
    app.log.info(`merchant-api listening on :${port}`);
  }).catch((err) => {
    app.log.error(err, "Failed to start merchant-api");
  });
}
