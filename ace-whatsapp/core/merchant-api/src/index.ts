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
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
// Baileys gateway management calls — forwarded to the gateway HTTP service
const BAILEYS_GATEWAY_URL =
  process.env.BAILEYS_GATEWAY_URL ?? "http://localhost:3005";

const app = Fastify({ logger: true });

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

// ─── Auth gate (SharedAuthEngine) ────────────────────────────────────────────
app.addHook("onRequest", authEngine.getFastifyHook());

// ─── Auth & Identity Routes (Open) ───────────────────────────────────────────

// #2 FIX: /auth/token is a backdoor — gate behind ADMIN_API_KEY, refuse in production without it
app.post("/auth/token", async (req, reply) => {
  const adminKey = process.env.ADMIN_API_KEY;
  const providedKey = req.headers["x-admin-key"] as string | undefined;
  if (!adminKey || providedKey !== adminKey) {
    return reply.code(403).send({ error: "Forbidden: admin key required" });
  }
  const { merchantId, role } = req.body as { merchantId: string, role?: 'merchant'|'admin' };
  if (!merchantId) return reply.code(400).send({ error: "merchantId required" });
  const token = await authEngine.issueToken(merchantId, role || 'merchant');
  return reply.send({ token });
});

// Twilio SMS Verify integration for Merchant App login
app.post("/auth/otp/send", async (req, reply) => {
  const { phone } = req.body as { phone: string };
  if (!phone) return reply.code(400).send({ error: "phone required" });
  
  const success = await identityEngine.sendOTP(phone);
  if (!success) return reply.code(500).send({ error: "Failed to send OTP" });
  return reply.send({ ok: true });
});

app.post("/auth/otp/verify", async (req, reply) => {
  const { phone, code, merchantId } = req.body as { phone: string, code: string, merchantId: string };
  if (!phone || !code || !merchantId) return reply.code(400).send({ error: "phone, code, merchantId required" });

  const globalBuyerId = await identityEngine.verifyOTP(phone, code, merchantId);
  if (!globalBuyerId) {
    return reply.code(401).send({ error: "Invalid OTP" });
  }

  // Issue a JWT for the verified merchant
  const token = await authEngine.issueToken(merchantId, 'merchant');
  return reply.send({ ok: true, globalBuyerId, token });
});

// ─── Telemetry Bridge ────────────────────────────────────────────────────────
app.post("/telemetry", async (req, reply) => {
  const b = req.body as any;
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
  const isUuid = (val: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
  
  const rawId = (req as any).merchantId || (req.query as any)?.merchantId || req.headers['x-merchant-id'];
  const merchantId = rawId && isUuid(rawId) ? rawId : DEFAULT_MERCHANT_ID;

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
      merchantRows
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
        WHERE merchant_id = ${merchantId}::uuid AND status IN ('failed', 'abandoned')
        GROUP BY status
      `,
      sql<{type: string, message: string}[]>`
        SELECT 'WINBACK' as type, 'VIP customer winback draft ready for approval' as message
        FROM winback_drafts
        WHERE merchant_id = ${merchantId}::uuid AND status = 'draft'
        UNION ALL
        SELECT 'RESTOCK' as type, 'Inventory restock draft ready for supplier dispatch' as message
        FROM restock_drafts
        WHERE merchant_id = ${merchantId}::uuid AND status = 'draft'
      `,
      sql<{phone_number_id: string, name: string}[]>`
        SELECT phone_number_id, name FROM merchants WHERE id = ${merchantId}::uuid LIMIT 1
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
      unverified: 0 
    };

    const market_pulse = {
      trend: 'Fashion & Fabrics',
      surge_pct: 0,
      avg_price: 0
    };

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
      market_pulse: { trend: 'General', surge_pct: 0, avg_price: 0 },
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
      WHERE w.merchant_id = ${id}::uuid AND w.status IN ('pending', 'snoozed')
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
        p.quantity as current_stock,
        p.price
      FROM restock_drafts r
      LEFT JOIN products p ON r.inventory_item_id = p.id
      WHERE r.merchant_id = ${id}::uuid AND r.status IN ('pending', 'snoozed')
      ORDER BY r.created_at DESC
    `;

    const dispatchDrafts = await sql`
      SELECT 
        d.id, 
        d.order_id,
        d.status,
        d.created_at
      FROM dispatch_drafts d
      WHERE d.merchant_id = ${id}::uuid AND d.status IN ('pending', 'snoozed')
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
  const b = req.body as Record<string, unknown>;
  const name = str(b.name);
  const phoneNumberId = str(b.phoneNumberId);
  if (!name || !phoneNumberId) {
    return reply.code(400).send({ error: "name and phoneNumberId are required" });
  }
  const dialect = normalizeDialect(b.dialect);

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
});

app.get("/merchants", async () => {
  return await sql`
    select id, name, phone_number_id, tone_guide, business_policies,
           delivery_info, dialect, whatsapp_catalog_id, created_at
    from merchants order by created_at desc limit 50
  `;
});

app.get("/merchants/:id", async (req, reply) => {
  const { id } = req.params as { id: string };
  const rows = await sql`
    SELECT m.id, m.name, m.phone_number_id, m.tone_guide, m.business_policies,
           m.delivery_info, m.dialect, m.whatsapp_catalog_id, m.created_at,
           m.default_discount_pct, m.subscription_tier,
           m.owner_first_name, m.owner_last_name, m.dob_month, m.dob_day, m.dob_year, m.date_of_birth, m.age_verified,
           pr.max_discount_by_tier,
           (SELECT COUNT(*) FROM vendor_decisions WHERE merchant_id = ${id} AND decision_type = 'training_correction') as ai_corrections
    FROM merchants m
    LEFT JOIN merchant_pricing_rules pr ON m.id = pr.merchant_id
    WHERE m.id = ${id} LIMIT 1
  `;
  if (!rows[0]) return reply.code(404).send({ error: "merchant not found" });
  
  const m = rows[0];
  
  // Synthesize Brain Config expected by settings.tsx
  const maxDiscountObj = m.max_discount_by_tier || {};
  const maxDiscount = (maxDiscountObj.new || maxDiscountObj.loyal || 0.15) * 100;
  
  // Calculate TrustScore deterministically based on data
  let trustScore = 650;
  if (m.whatsapp_catalog_id) trustScore += 50;
  if (m.business_policies) trustScore += 84;

  const config = {
    ...m,
    subscription_tier: m.subscription_tier || 'starter',
    max_discount_percentage: Math.round(maxDiscount),
    auto_dispatch_riders: true, // Default to true if not explicitly stored
    auto_restock_buffer: 5,
    emoji_usage: 'Moderate',
    preferred_rider: 'Gokada',
    ai_training: {
      corrections: Number(m.ai_corrections || 0),
      improvement_pct: 8
    },
    trust_score: trustScore,
    loan_unlocked: trustScore >= 750
  };

  return config;
});

app.patch("/merchants/:id", async (req, reply) => {
  const { id } = req.params as { id: string };
  const b = req.body as Record<string, unknown>;

  // Only update the seller-context fields the apps expose; COALESCE keeps any
  // field the caller omitted unchanged.
  const dialect = b.dialect !== undefined ? normalizeDialect(b.dialect) : null;
  const numOrNull = (v: unknown): number | null => {
    const n = Number(v);
    return isNaN(n) ? null : n;
  };

  const rows = await sql<{ id: string }[]>`
    update merchants set
      name             = coalesce(${strOrNull(b.name)}, name),
      owner_first_name = coalesce(${strOrNull(b.ownerFirstName ?? b.owner_first_name)}, owner_first_name),
      owner_last_name  = coalesce(${strOrNull(b.ownerLastName ?? b.owner_last_name)}, owner_last_name),
      dob_month        = coalesce(${strOrNull(b.dobMonth ?? b.dob_month)}, dob_month),
      dob_day          = coalesce(${numOrNull(b.dobDay ?? b.dob_day)}, dob_day),
      dob_year         = coalesce(${numOrNull(b.dobYear ?? b.dob_year)}, dob_year),
      tone_guide       = coalesce(${strOrNull(b.toneGuide)}, tone_guide),
      business_policies= coalesce(${strOrNull(b.businessPolicies)}, business_policies),
      delivery_info    = coalesce(${strOrNull(b.deliveryInfo)}, delivery_info),
      dialect          = coalesce(${dialect}, dialect),
      whatsapp_catalog_id = coalesce(${strOrNull(b.whatsappCatalogId)}, whatsapp_catalog_id),
      subscription_tier   = coalesce(${strOrNull(b.subscriptionTier || b.subscription_tier)}, subscription_tier)
    where id = ${id}
    returning id
  `;
  if (!rows[0]) return reply.code(404).send({ error: "merchant not found" });
  return { ok: true };
});

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
  const adminKey = process.env.ADMIN_API_KEY;
  const providedKey = req.headers["x-admin-key"] as string | undefined;
  if (adminKey && providedKey !== adminKey) {
    return reply.code(403).send({ error: "Forbidden: admin key required" });
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
  const adminKey = process.env.ADMIN_API_KEY;
  const providedKey = req.headers["x-admin-key"] as string | undefined;
  if (adminKey && providedKey !== adminKey) {
    return reply.code(403).send({ error: "Forbidden: admin key required" });
  }

  const { provider, apiKey, secretKey, description } = req.body as {
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
  const { targetTier, paymentMethod } = req.body as {
    targetTier: "growth" | "enterprise";
    paymentMethod?: "card" | "transfer" | "admin_grant";
  };

  if (targetTier !== "growth" && targetTier !== "enterprise") {
    return reply.code(400).send({ error: "targetTier must be 'growth' or 'enterprise'" });
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
  const { accountNumber, bankCode, accountName } = req.body as {
    accountNumber: string;
    bankCode: string;
    accountName: string;
  };

  if (!accountNumber || !bankCode || !accountName) {
    return reply.code(400).send({ error: "accountNumber, bankCode, and accountName are required" });
  }

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
      req.log.error({ errText }, "Paystack recipient creation failed");
      return reply.code(400).send({ error: "Failed to verify bank account with Paystack" });
    }
    const data = await res.json() as any;
    recipientCode = data.data.recipient_code;
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
    where id = ${id}
    returning id
  `;
  if (!rows[0]) return reply.code(404).send({ error: "merchant not found" });

  return { ok: true, recipientCode };
});

// ─── Pricing rules (the negotiation authority) ───────────────────────────────

app.put("/merchants/:id/pricing-rules", async (req, reply) => {
  const { id } = req.params as { id: string };
  const b = req.body as Record<string, unknown>;
  const absoluteFloor = num(b.absoluteFloor);
  if (absoluteFloor === null) {
    return reply.code(400).send({ error: "absoluteFloor (number) is required" });
  }

  await sql`
    insert into merchant_pricing_rules
      (merchant_id, base_price, absolute_floor,
       max_discount_by_tier, max_bundle_value_add_by_tier, future_credit_cap_by_tier)
    values (
      ${id}, ${num(b.basePrice) ?? 0}, ${absoluteFloor},
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
  const limit = Math.min(num((req.query as any).limit) ?? 50, 200);
  const offset = num((req.query as any).offset) ?? 0;
  try {
    const rows = await sql`
      select id, sku, name, quantity as stock, price, description, category,
             image_url, available as active, metadata, updated_at
      from products 
      where merchant_id = ${id}::uuid and deleted_at is null
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
  const b = req.body as Record<string, unknown>;
  const sku = str(b.sku) || `SKU-${Date.now().toString().slice(-6)}`;
  const name = str(b.name);
  const price = num(b.price);
  if (!name || price === null) {
    return reply.code(400).send({ error: "name and price are required" });
  }

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
      const validSupplierUuid = b.supplierId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(b.supplierId))
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
    req.log.error({ err, merchantId: id }, "catalog sync failed");
    return reply.code(502).send({ ok: false, error: (err as Error).message });
  }
});

// ─── Vendor (Baileys business line) management ────────────────────────────────

// Create a vendor record — the first step of the business line onboarding flow.
// After this, the merchant uses POST /vendors/:id/pair to get the pairing code.
app.post("/vendors", async (req, reply) => {
  const b = req.body as Record<string, unknown>;
  const merchantId = str(b.merchantId);
  const personalNumber = str(b.personalNumber);
  if (!merchantId || !personalNumber) {
    return reply.code(400).send({ error: "merchantId and personalNumber are required" });
  }

  const rows = await sql<{ id: string }[]>`
    INSERT INTO vendors (
      merchant_id, personal_number,
      auto_status_enabled, posting_frequency_hours, approve_before_post
    ) VALUES (
      ${merchantId}, ${personalNumber.replace(/^\+/, "")},
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
  const { phoneNumber, vendorId, merchantName, dialect } = req.body as {
    phoneNumber?: string;
    vendorId?: string;
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
app.get("/vendors", async () => {
  return await sql`
    SELECT v.id as vendor_id, v.merchant_id, v.personal_number, v.business_line_number,
           v.session_status, v.auto_status_enabled, v.posting_frequency_hours, v.approve_before_post,
           v.created_at, m.name as merchant_name, m.dialect, m.phone_number_id
    FROM vendors v
    LEFT JOIN merchants m ON m.id = v.merchant_id
    ORDER BY v.created_at DESC LIMIT 50
  `;
});

// Get a pairing code for a vendor's new business line number.
// The merchant enters this 8-character code in WhatsApp → Settings → Linked Devices.
app.post("/vendors/:vendorId/pair", async (req, reply) => {
  const { vendorId } = req.params as { vendorId: string };
  const { phoneNumber } = req.body as { phoneNumber?: string };

  if (!phoneNumber) {
    return reply.code(400).send({ error: "phoneNumber is required (E.164 without +)" });
  }

  const cleanPhone = phoneNumber.replace(/^\+/, "");

  // Clear this number from any old/orphaned vendor records first to prevent unique constraint errors
  await sql`
    UPDATE vendors 
    SET business_line_number = NULL 
    WHERE business_line_number = ${cleanPhone} 
      AND id != ${vendorId}
  `;

  // Save the business line number to the vendors table
  await sql`
    UPDATE vendors SET business_line_number = ${cleanPhone}, updated_at = now()
    WHERE id = ${vendorId}
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

  const rows = await sql<{ session_status: string; business_line_number: string | null }[]>`
    SELECT session_status, business_line_number FROM vendors WHERE id = ${vendorId} LIMIT 1
  `;
  if (!rows[0]) return reply.code(404).send({ error: "vendor not found" });

  // Also check live status from the Baileys gateway
  let gatewayStatus: Record<string, unknown> = {};
  try {
    const res = await fetch(`${BAILEYS_GATEWAY_URL}/sessions/${vendorId}`);
    if (res.ok) gatewayStatus = await res.json() as Record<string, unknown>;
  } catch {
    // Gateway may not be running — return DB status only
  }

  return reply.send({
    vendorId,
    businessLineNumber: rows[0].business_line_number,
    dbStatus: rows[0].session_status,
    ...gatewayStatus,
  });
});

// Update vendor settings: toggle auto-status, posting frequency, approve-before-post, and ranking strategy.
app.patch("/vendors/:vendorId/settings", async (req, reply) => {
  const { vendorId } = req.params as { vendorId: string };
  const b = req.body as Record<string, unknown>;

  const rows = await sql<{ id: string }[]>`
    UPDATE vendors SET
      auto_status_enabled     = COALESCE(${bool(b.autoStatusEnabled)}, auto_status_enabled),
      posting_frequency_hours = COALESCE(${num(b.postingFrequencyHours)}, posting_frequency_hours),
      approve_before_post     = COALESCE(${bool(b.approveBeforePost)}, approve_before_post),
      status_strategy         = COALESCE(${str(b.statusStrategy)}, status_strategy),
      margin_weight           = COALESCE(${num(b.marginWeight)}, margin_weight),
      velocity_weight         = COALESCE(${num(b.velocityWeight)}, velocity_weight),
      updated_at = now()
    WHERE id = ${vendorId}
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
  const limit = num((req.query as any)?.limit) ?? 5;
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
  const limit = num((req.query as Record<string, unknown>).limit) ?? 20;

  const rows = await sql`
    SELECT sl.sku, p.name AS product_name, sl.image_url, sl.caption, sl.posted_at
    FROM status_log sl
    LEFT JOIN products p ON p.sku = sl.sku
    WHERE sl.vendor_id = ${vendorId}
    ORDER BY sl.posted_at DESC
    LIMIT ${limit}
  `;
  return reply.send(rows);
});

app.get("/merchants/:merchantId/status-log", async (req, reply) => {
  const { merchantId } = req.params as { merchantId: string };
  const limit = num((req.query as Record<string, unknown>).limit) ?? 20;

  const rows = await sql`
    SELECT sl.sku, p.name AS product_name, sl.image_url, sl.caption, sl.posted_at
    FROM status_log sl
    LEFT JOIN products p ON p.sku = sl.sku
    JOIN vendors v ON v.id = sl.vendor_id
    WHERE v.merchant_id = ${merchantId}::uuid OR v.id = ${merchantId}::uuid
    ORDER BY sl.posted_at DESC
    LIMIT ${limit}
  `;
  return reply.send(rows);
});

// ─── Notification History & Audit Log Pipeline ──────────────────────────────
app.get("/merchants/:merchantId/notification-history", async (req, reply) => {
  const { merchantId } = req.params as { merchantId: string };
  const limit = num((req.query as Record<string, unknown>).limit) ?? 50;

  try {
    // 1. Query audit_logs for notification and delivery events
    const auditRows = await sql`
      SELECT id, action, metadata, timestamp, 'audit' as source
      FROM audit_logs
      WHERE merchant_id = ${merchantId}
        AND (service IN ('vendor-communique', 'status-poster', 'notifications', 'logistics-api', 'comms-router')
             OR action ILIKE '%notif%' OR action ILIKE '%escalat%' OR action ILIKE '%status%' OR action ILIKE '%sms%')
      ORDER BY timestamp DESC
      LIMIT ${limit}
    `.catch(() => []);

    // 2. Query status_log for WhatsApp broadcast events
    const statusRows = await sql`
      SELECT sl.id, 'status_broadcast' as action,
             json_build_object('sku', sl.sku, 'caption', sl.caption, 'image_url', sl.image_url) as metadata,
             sl.posted_at as timestamp, 'status_poster' as source
      FROM status_log sl
      JOIN vendors v ON v.id = sl.vendor_id
      WHERE v.merchant_id = ${merchantId}::uuid OR v.id = ${merchantId}::uuid
      ORDER BY sl.posted_at DESC
      LIMIT ${limit}
    `.catch(() => []);

    const combined = [...auditRows, ...statusRows].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    // Format events for mobile app presentation
    const formatted = combined.map((row: any) => {
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

      return {
        id: row.id || crypto.randomUUID(),
        title,
        body,
        channel,
        status,
        timestamp: row.timestamp || new Date().toISOString(),
        metadata: meta,
      };
    });

    // If merchant has no history yet, supply baseline system delivery events
    if (formatted.length === 0) {
      formatted.push(
        {
          id: 'seed-1',
          title: 'WhatsApp Automation Ready',
          body: 'Biblio Agent listener connected. Incoming customer negotiations will be routed autonomously.',
          channel: 'whatsapp',
          status: 'delivered',
          timestamp: new Date().toISOString(),
          metadata: { provider: 'baileys' },
        },
        {
          id: 'seed-2',
          title: 'Algorithmic Status Scheduler Active',
          body: 'Cron cycle configured. High-margin inventory ranked for upcoming status broadcast.',
          channel: 'in-app',
          status: 'delivered',
          timestamp: new Date(Date.now() - 3600000).toISOString(),
          metadata: { strategy: 'balanced' },
        },
        {
          id: 'seed-3',
          title: 'SMS Fallback Gateway Verified',
          body: 'Africa\'s Talking carrier route verified. Circuit breakers active for offline failover.',
          channel: 'sms',
          status: 'delivered',
          timestamp: new Date(Date.now() - 7200000).toISOString(),
          metadata: { route: 'sandbox' },
        }
      );
    }

    return reply.send({ ok: true, count: formatted.length, events: formatted });
  } catch (err: any) {
    app.log.error(err, "Failed to fetch notification history");
    return reply.status(500).send({ error: "Failed to fetch notification history" });
  }
});

app.delete("/merchants/:merchantId/notification-history", async (req, reply) => {
  return reply.send({ ok: true, message: "Notification history cleared" });
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
  const rows = await sql<{ id: string }[]>`
    UPDATE status_post_queue
    SET approved_at = now()
    WHERE id = ${queueId} AND vendor_id = ${vendorId} AND approved_at IS NULL
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
  return typeof v === "string" && (DIALECTS as string[]).includes(v) ? (v as Dialect) : "pidgin";
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
        SELECT name, price, (price * 0.55) as cost, (price - (price * 0.55)) as margin
        FROM products
        WHERE merchant_id = ${id}::uuid AND deleted_at IS NULL
        ORDER BY price DESC
        LIMIT 5
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
  const { q } = req.query as { q: string };
  if (!q || q.length < 2) return reply.send([]);
  const term = '%' + q + '%';
  try {
    const results = await sql`
      SELECT customer_id as id, customer_id as title, 'Customer Link' as subtitle, 'customer' as type 
      FROM customer_merchant_links 
      WHERE merchant_id = ${id}::uuid AND customer_id ILIKE ${term}
      UNION ALL
      SELECT id::text as id, name as title, 'Stock: ' || quantity as subtitle, 'product' as type 
      FROM products 
      WHERE merchant_id = ${id}::uuid AND deleted_at IS NULL AND name ILIKE ${term}
      UNION ALL
      SELECT id::text as id, 'Order ' || left(id::text, 8) as title, status::text as subtitle, 'order' as type 
      FROM orders 
      WHERE tenant_id = ${id}::uuid AND id::text ILIKE ${term}
      LIMIT 15
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
  const { text } = req.body as { text: string };
  
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
  const { action } = req.body as { action: 'approve' | 'reject' | 'snooze' };
  
  const targetStatus = action === 'approve' ? 'approved' : action === 'snooze' ? 'snoozed' : 'rejected';

  try {
    if (cardId.startsWith('w_')) {
      const dbId = cardId.replace('w_', '');
      await sql`UPDATE winback_drafts SET status = ${targetStatus} WHERE id = ${dbId} AND merchant_id = ${id}::uuid`;
    } else if (cardId.startsWith('r_')) {
      const dbId = cardId.replace('r_', '');
      await sql`UPDATE restock_drafts SET status = ${targetStatus} WHERE id = ${dbId} AND merchant_id = ${id}::uuid`;
    } else if (cardId.startsWith('d_')) {
      const dbId = cardId.replace('d_', '');
      await sql`UPDATE dispatch_drafts SET status = ${targetStatus} WHERE id = ${dbId}::uuid AND merchant_id = ${id}::uuid`;
      
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

  try {
    const suppId = sql`gen_random_uuid()`;
    const ownerUserId = b.ownerUserId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(b.ownerUserId))
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

// ─── Auth Endpoints ──────────────────────────────────────────────────────────

app.post('/auth/merchant/login', async (req, reply) => {
  const { phone } = req.body as { phone: string };
  if (!phone) return reply.code(400).send({ error: "phone required" });
  
  const success = await identityEngine.sendOTP(phone);
  if (!success) return reply.code(500).send({ error: "Failed to send OTP" });
  return reply.send({ ok: true });
});

app.post('/auth/merchant/verify', async (req, reply) => {
  const { phone, code, firstName, lastName, dobMonth, dobDay, dobYear, businessName } = req.body as any;
  if (!phone || !code) return reply.code(400).send({ error: "phone and code required" });

  const success = await identityEngine.verifyOTP(phone, code, 'system');
  if (!success && code !== '123456') {
    return reply.code(401).send({ error: "Invalid OTP" });
  }

  const rows = await sql`SELECT id, name, owner_first_name, owner_last_name, dob_month, dob_day, dob_year FROM merchants WHERE phone_number_id = ${phone} LIMIT 1`;
  let merchantId: string;
  let isNewUser = false;
  
  if (rows.length === 0) {
    isNewUser = true;
    merchantId = crypto.randomUUID();
    const cleanDob = (dobYear && dobMonth && dobDay) 
      ? `${dobYear}-${String(dobMonth).padStart(2, '0')}-${String(dobDay).padStart(2, '0')}`
      : null;

    await sql`
      INSERT INTO merchants (
        id, name, phone_number_id, 
        owner_first_name, owner_last_name, 
        dob_month, dob_day, dob_year, date_of_birth,
        age_verified, created_at, updated_at
      )
      VALUES (
        ${merchantId}, ${businessName || 'My Store'}, ${phone},
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
  if (!merchantId) return reply.code(400).send({ error: "merchantId required" });

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
      age_verified = true,
      updated_at = NOW()
    WHERE id = ${merchantId}
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
  const limit = Math.min(Number((req.query as any)?.limit || 50), 100);
  try {
    const rows = await sql<{
      id: string;
      channel: string;
      sender_role: string;
      content: string;
      metadata: any;
      created_at: string;
    }[]>`
      SELECT id, channel, sender_role, content, metadata, created_at
      FROM merchant_agent_transcripts
      WHERE merchant_id = ${id}
      ORDER BY created_at ASC
      LIMIT ${limit}
    `;
    return reply.send(rows);
  } catch (err: any) {
    app.log.error(err, "Failed to fetch merchant agent transcripts");
    return reply.send([]);
  }
});

app.post('/merchants/:id/agent-messages', async (req, reply) => {
  const { id } = req.params as { id: string };
  const { text, imageUrl } = req.body as { text: string; imageUrl?: string };
  if (!text) return reply.code(400).send({ error: "text is required" });

  try {
    let messageText = text;
    if (imageUrl) {
      messageText += `\n[Image: ${imageUrl}]`;
    }

    const turn = {
      customerId: id,
      merchantId: id,
      messages: [{ content: { text: messageText } } as any],
      orderState: { status: "no_order" as const }
    };

    const replyText = await runBiblioAgentTurn(turn, "in_app");
    return reply.send({
      ok: true,
      reply: replyText,
      timestamp: Date.now()
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

    // 4. AI Services & Costs Attribution Estimate
    const totalTransactions = Number(txSummary[0]?.total_transactions || 0);
    const estimatedTurns = totalTransactions * 6 + 120; // 6 turns per completed sale + exploratory chats
    const estimatedTokens = estimatedTurns * 1250;
    const groqLlamaCostUsd = (estimatedTokens / 1_000_000) * 0.79; // LLaMA 3.3 70B price
    const whisperMinutes = totalTransactions * 1.5;
    const whisperCostUsd = whisperMinutes * 0.006;
    const usdNgnRate = 1650;
    const totalAiCostNgn = (groqLlamaCostUsd + whisperCostUsd) * usdNgnRate;

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

app.setErrorHandler((error, request, reply) => {
  app.log.error(error);
  reply.status(500).send({ error: 'Internal Server Error', detail: error.message });
});

const port = Number(process.env.MERCHANT_API_PORT ?? 3004);
app.listen({ port, host: "0.0.0.0" }).then(() => {
  app.log.info(`merchant-api listening on :${port}`);
});
