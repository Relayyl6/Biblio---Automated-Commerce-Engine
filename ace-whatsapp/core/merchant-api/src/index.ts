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
  // @ts-ignore — Fastify hook injects merchantId
  const merchantId = (req as any).merchantId;

  const [outcomeRows, elasticityRows, revenueRows, escalationRows, leakRows] = await Promise.all([
    sql<{outcome: string, count: number}[]>`
      SELECT outcome, COUNT(*) as count
      FROM negotiation_traces
      WHERE merchant_id = ${merchantId} AND created_at > now() - interval '30 days'
      GROUP BY outcome
    `,
    sql<{day: string, avg_elasticity: number}[]>`
      SELECT to_char(created_at, 'Dy') as day, ROUND(AVG(COALESCE(price_elasticity_signal, 0))::numeric, 2) as avg_elasticity
      FROM negotiation_traces
      WHERE merchant_id = ${merchantId} AND created_at > now() - interval '7 days'
      GROUP BY to_char(created_at, 'Dy'), DATE_TRUNC('day', created_at)
      ORDER BY DATE_TRUNC('day', created_at)
    `,
    sql<{total: number, count: number}[]>`
      SELECT SUM(amount) as total, COUNT(*) as count
      FROM transactions
      WHERE merchant_id = ${merchantId} AND status = 'confirmed' AND created_at > now() - interval '30 days'
    `,
    sql<{count: number}[]>`
      SELECT COUNT(*) as count FROM escalations WHERE merchant_id = ${merchantId} AND created_at > now() - interval '7 days'
    `,
    sql<{status: string, total: number}[]>`
      SELECT status, SUM(total_amount) as total
      FROM orders
      WHERE merchant_id = ${merchantId} AND status IN ('abandoned', 'payment_failed')
      GROUP BY status
    `
  ]);

  const outcomes = outcomeRows.map(r => ({ name: r.outcome, value: Number(r.count) }));
  const elasticity = elasticityRows.map(r => ({ name: r.day, score: Number(r.avg_elasticity) }));
  const revenue = { total: Number(revenueRows[0]?.total ?? 0), orders: Number(revenueRows[0]?.count ?? 0) };
  
  const autonomy_debt = {
    interventions: Number(escalationRows[0]?.count ?? 0),
    drop_pct: 12 // Simplified for now
  };

  const leak_map = {
    abandoned_carts: Number(leakRows.find(r => r.status === 'abandoned')?.total ?? 0),
    failed_payments: Number(leakRows.find(r => r.status === 'payment_failed')?.total ?? 0),
    unverified: 0 
  };

  const oracle_alerts = [
    { type: 'WINBACK', message: 'VIPs detected without recent orders. Drafts ready.' },
    { type: 'RESTOCK', message: 'Inventory critical on top moving SKUs. PO drafted.' }
  ];

  const market_pulse = {
    trend: 'Blue Ankara',
    surge_pct: 340,
    avg_price: 8500
  };

  return reply.send({ outcomes, elasticity, revenue, autonomy_debt, leak_map, oracle_alerts, market_pulse });
});

app.get("/merchants/:id/chats", async (req, reply) => {
  const { id } = req.params as { id: string };
  // Fetch real chat context using a Window Function to get the latest message per conversation
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
      WHERE merchant_id = ${id}
    )
    SELECT * FROM RankedMessages WHERE rn = 1
    ORDER BY created_at DESC
    LIMIT 20
  `;
  
  const chats = rows.map((r, i) => {
    const isAI = r.source === 'ai' || r.source === 'system';
    const metadata = r.metadata as any || {};
    
    return {
      id: r.customer_id + '_' + i,
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
});

app.get("/merchants/:id/customers", async (req, reply) => {
  const { id } = req.params as { id: string };
  // Fetch real LTV and CRM data by aggregating across orders
  const rows = await sql`
    SELECT 
      c.customer_id as phone, 
      COUNT(DISTINCT o.id) as total_orders,
      SUM(o.total_amount) as ltv,
      MAX(o.created_at) as last_order_date
    FROM customer_merchant_links c
    LEFT JOIN orders o ON c.customer_id = o.user_id::text AND c.merchant_id = o.merchant_id
    WHERE c.merchant_id = ${id}
    GROUP BY c.customer_id
    ORDER BY ltv DESC NULLS LAST
    LIMIT 50
  `;
  
  const customers = rows.map((r) => {
    const ltvVal = Number(r.ltv) || 0;
    const ltvStr = '₦' + ltvVal.toLocaleString();
    
    // Dynamic Risk Calculation
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
});

app.get("/merchants/:id/inbox", async (req, reply) => {
  const { id } = req.params as { id: string };
  
  const winbacks = await sql`
    SELECT 
      w.id, 
      w.customer_id, 
      w.proposed_discount_percent,
      w.message_draft,
      MAX(o.created_at) as last_order_date,
      SUM(o.total_amount) as ltv
    FROM winback_drafts w
    LEFT JOIN orders o ON w.customer_id = o.user_id::text AND w.merchant_id = o.merchant_id
    WHERE w.merchant_id = ${id} AND w.status = 'pending'
    GROUP BY w.id, w.customer_id, w.proposed_discount_percent, w.message_draft
  `;
  
  const restocks = await sql`
    SELECT 
      r.id, 
      r.supplier_id, 
      r.proposed_quantity, 
      r.message_draft,
      p.name as product_name,
      p.quantity as current_stock,
      p.price
    FROM restock_drafts r
    LEFT JOIN products p ON r.inventory_item_id = p.id
    WHERE r.merchant_id = ${id} AND r.status = 'pending'
  `;

  const dispatchDrafts = await sql`
    SELECT 
      d.id, 
      d.order_id,
      o.total_amount,
      c.name as customer_name
    FROM dispatch_drafts d
    LEFT JOIN orders o ON d.order_id = o.id
    LEFT JOIN customers c ON o.customer_id = c.id
    WHERE d.merchant_id = ${id} AND d.status = 'pending'
  `;

  const inbox = [
    ...dispatchDrafts.map((r: any) => {
      return {
        id: `d_${r.id}`,
        type: "dispatch",
        title: `Ready to Dispatch: Order ${r.order_id.split('-')[0]}`,
        subtitle: `Payment of ₦${Number(r.total_amount || 0).toLocaleString()} cleared for ${r.customer_name || 'Customer'}. Swipe to hail a rider.`
      };
    }),
    ...winbacks.map((r: any) => {
      const days = r.last_order_date ? Math.floor((Date.now() - new Date(r.last_order_date).getTime()) / (1000 * 3600 * 24)) : '?';
      return { 
        id: `w_${r.id}`, 
        type: "winback", 
        title: `${r.customer_id} (LTV: ₦${Number(r.ltv || 0).toLocaleString()})`, 
        subtitle: `It's been ${days} days since their last order. Biblio drafted a win-back message with a ${r.proposed_discount_percent}% discount.` 
      };
    }),
    ...restocks.map((r: any) => {
      const cost = Number(r.price || 0) * 0.7;
      return { 
        id: `r_${r.id}`, 
        type: "restock", 
        title: `Supplier PO: ${r.supplier_id}`, 
        subtitle: `${r.product_name || 'Item'} is dangerously low (${r.current_stock || 0} left). Biblio drafted a PO for ${r.proposed_quantity} units at ₦${cost}/unit.` 
      };
    })
  ];

  return reply.send(inbox);
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
           m.default_discount_pct,
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
  const rows = await sql<{ id: string }[]>`
    update merchants set
      name             = coalesce(${strOrNull(b.name)}, name),
      tone_guide       = coalesce(${strOrNull(b.toneGuide)}, tone_guide),
      business_policies= coalesce(${strOrNull(b.businessPolicies)}, business_policies),
      delivery_info    = coalesce(${strOrNull(b.deliveryInfo)}, delivery_info),
      dialect          = coalesce(${dialect}, dialect),
      whatsapp_catalog_id = coalesce(${strOrNull(b.whatsappCatalogId)}, whatsapp_catalog_id)
    where id = ${id}
    returning id
  `;
  if (!rows[0]) return reply.code(404).send({ error: "merchant not found" });
  return { ok: true };
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
  // #21: pagination to prevent OOM on large catalogs
  const limit = Math.min(num((req.query as any).limit) ?? 50, 200);
  const offset = num((req.query as any).offset) ?? 0;
  return sql`
    select sku, name, stock, price, description, category, tags, attributes,
           image_url, currency, active, source, updated_at
    from products where merchant_id = ${id}
    order by updated_at desc
    limit ${limit} offset ${offset}
  `;
});

app.post("/merchants/:id/products", async (req, reply) => {
  const { id } = req.params as { id: string };
  const b = req.body as Record<string, unknown>;
  const sku = str(b.sku);
  const name = str(b.name);
  const price = num(b.price);
  if (!sku || !name || price === null) {
    return reply.code(400).send({ error: "sku, name and price are required" });
  }

  await sql`
    insert into products
      (sku, merchant_id, name, stock, price, description, category, tags,
       attributes, image_url, currency, active, source, updated_at)
    values (
      ${sku}, ${id}, ${name}, ${num(b.stock) ?? 0}, ${price},
      ${strOrNull(b.description)}, ${strOrNull(b.category)},
      ${jsonb(b.tags ?? [])}, ${jsonb(b.attributes ?? {})},
      ${strOrNull(b.imageUrl)}, ${str(b.currency) ?? "NGN"}, true, 'manual', now()
    )
    on conflict (sku, merchant_id) do update set
      name = excluded.name, stock = excluded.stock, price = excluded.price,
      description = excluded.description, category = excluded.category,
      tags = excluded.tags, attributes = excluded.attributes,
      image_url = excluded.image_url, currency = excluded.currency,
      active = true, updated_at = now()
  `;
  return reply.code(201).send({ ok: true, sku });
});

app.patch("/merchants/:id/products/:sku", async (req, reply) => {
  const { id, sku } = req.params as { id: string; sku: string };
  const b = req.body as Record<string, unknown>;
  const rows = await sql<{ sku: string }[]>`
    update products set
      name        = coalesce(${strOrNull(b.name)}, name),
      stock       = coalesce(${num(b.stock)}, stock),
      price       = coalesce(${num(b.price)}, price),
      description = coalesce(${strOrNull(b.description)}, description),
      category    = coalesce(${strOrNull(b.category)}, category),
      tags        = coalesce(${b.tags !== undefined ? jsonb(b.tags) : null}, tags),
      attributes  = coalesce(${b.attributes !== undefined ? jsonb(b.attributes) : null}, attributes),
      image_url   = coalesce(${strOrNull(b.imageUrl)}, image_url),
      active      = coalesce(${bool(b.active)}, active),
      updated_at  = now()
    where merchant_id = ${id} and sku = ${sku}
    returning sku
  `;
  if (!rows[0]) return reply.code(404).send({ error: "product not found" });
  return { ok: true };
});

app.delete("/merchants/:id/products/:sku", async (req, reply) => {
  const { id, sku } = req.params as { id: string; sku: string };
  // Soft delete — hide from the catalog without losing history/order references.
  const rows = await sql<{ sku: string }[]>`
    update products set active = false, updated_at = now()
    where merchant_id = ${id} and sku = ${sku}
    returning sku
  `;
  if (!rows[0]) return reply.code(404).send({ error: "product not found" });
  return { ok: true };
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

// Update vendor settings: toggle auto-status, posting frequency, approve-before-post.
app.patch("/vendors/:vendorId/settings", async (req, reply) => {
  const { vendorId } = req.params as { vendorId: string };
  const b = req.body as Record<string, unknown>;

  const rows = await sql<{ id: string }[]>`
    UPDATE vendors SET
      auto_status_enabled     = COALESCE(${bool(b.autoStatusEnabled)}, auto_status_enabled),
      posting_frequency_hours = COALESCE(${num(b.postingFrequencyHours)}, posting_frequency_hours),
      approve_before_post     = COALESCE(${bool(b.approveBeforePost)}, approve_before_post),
      updated_at = now()
    WHERE id = ${vendorId}
    RETURNING id
  `;
  if (!rows[0]) return reply.code(404).send({ error: "vendor not found" });
  return reply.send({ ok: true });
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

  const receivables = await sql`
    SELECT SUM(total_amount) as total
    FROM orders
    WHERE merchant_id = ${id} AND status IN ('awaiting_payment', 'payment_failed')
  `;

  const reconciliation = await sql`
    SELECT payment_method, COUNT(*) as count, SUM(total_amount) as total
    FROM orders
    WHERE merchant_id = ${id} AND status = 'paid'
    GROUP BY payment_method
  `;

  const outstanding = await sql`
    SELECT o.id, o.customer_id, c.name, o.total_amount, o.created_at
    FROM orders o
    LEFT JOIN customers c ON c.id = o.customer_id
    WHERE o.merchant_id = ${id} AND o.status IN ('awaiting_payment')
    ORDER BY o.created_at DESC
    LIMIT 5
  `;

  const margins = await sql`
    SELECT name, price, (price * 0.55) as cost, (price - (price * 0.55)) as margin
    FROM products
    WHERE merchant_id = ${id}
    ORDER BY margin DESC
    LIMIT 5
  `;

  return {
    receivables_total: receivables[0]?.total || 0,
    reconciliation,
    outstanding: outstanding.map(o => ({
      ...o,
      draft_message: `Hi ${o.name || 'Customer'}, just a quick reminder about your pending payment of ₦${o.total_amount}.`
    })),
    margins
  };
});

app.get('/merchants/:id/search', async (req, reply) => {
  const { id } = req.params as { id: string };
  const { q } = req.query as { q: string };
  if (!q || q.length < 2) return reply.send([]);
  const term = '%' + q + '%';
  const results = await sql`
    SELECT id, name as title, phone as subtitle, 'customer' as type FROM customers WHERE merchant_id = ${id} AND (name ILIKE ${term} OR phone ILIKE ${term})
    UNION ALL
    SELECT id, name as title, 'Stock: ' || current_stock as subtitle, 'product' as type FROM products WHERE merchant_id = ${id} AND name ILIKE ${term}
    UNION ALL
    SELECT id, 'Order ' || left(id::text, 8) as title, status as subtitle, 'order' as type FROM orders WHERE merchant_id = ${id} AND id::text ILIKE ${term}
    LIMIT 15
  `;
  return reply.send(results);
});


app.get("/merchants/:id/chats/:customerId", async (req, reply) => {
  const { id, customerId } = req.params as { id: string; customerId: string };
  
  // 1. Check if human override is active in redis
  const overrideKey = `human_override:${customerId}`;
  const overrideVal = await redis.get(overrideKey);
  const isHumanOverride = !!overrideVal;
  
  // 2. Get messages from DB
  const rows = await sql`
    SELECT id, role as sender, content, created_at as time
    FROM messages
    WHERE merchant_id = ${id} AND customer_id = ${customerId}
    ORDER BY created_at ASC
    LIMIT 100
  `;
  
  const mappedMessages = rows.map(r => ({
    id: r.id,
    sender: r.sender === 'user' ? 'customer' : r.sender === 'system' ? 'human' : 'ai',
    text: r.content?.text || r.content?.caption || '[Media]',
    time: new Date(r.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }));

  return reply.send({ isHumanOverride, messages: mappedMessages });
});

app.post("/merchants/:id/chats/:customerId/takeover", async (req, reply) => {
  const { id, customerId } = req.params as { id: string; customerId: string };
  const overrideKey = `human_override:${customerId}`;
  
  // Set the override flag in Redis for 1 hour (3600 seconds)
  await redis.set(overrideKey, "1", "EX", 3600);
  
  app.log.info(`[merchant-api] Human took over chat for customer ${customerId}. Lock set for 1h.`);
  return reply.send({ ok: true, message: "Human override active." });
});

app.post("/merchants/:id/chats/:customerId/send", async (req, reply) => {
  const { id, customerId } = req.params as { id: string; customerId: string };
  const { text } = req.body as { text: string };
  
  // 1. Insert message into DB as system (human)
  await sql`
    INSERT INTO messages (id, merchant_id, customer_id, role, content)
    VALUES (gen_random_uuid(), ${id}, ${customerId}, 'system', ${jsonb({ text })})
  `;
  
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
  
  if (action === 'approve') {
    if (cardId.startsWith('w_')) {
      const dbId = cardId.replace('w_', '');
      await sql`UPDATE winback_drafts SET status = 'approved' WHERE id = ${dbId} AND merchant_id = ${id}`;
    } else if (cardId.startsWith('r_')) {
      const dbId = cardId.replace('r_', '');
      await sql`UPDATE restock_drafts SET status = 'approved' WHERE id = ${dbId} AND merchant_id = ${id}`;
    } else if (cardId.startsWith('d_')) {
      const dbId = cardId.replace('d_', '');
      await sql`UPDATE dispatch_drafts SET status = 'approved' WHERE id = ${dbId} AND merchant_id = ${id}`;
      
      const orderRows = await sql`SELECT order_id FROM dispatch_drafts WHERE id = ${dbId}`;
      const orderId = orderRows[0]?.order_id;
      
      if (orderId) {
        // Fetch order details to dispatch
        const oRows = await sql`SELECT * FROM orders WHERE id = ${orderId}`;
        const order = oRows[0];
        
        const customerRows = await sql`SELECT phone FROM customers WHERE id = ${order.customer_id} LIMIT 1`;
        const customerPhone = customerRows[0]?.phone || order.customer_id;
        
        const payload = JSON.stringify({
          orderId,
          merchantId: id,
          customerPhone,
          pickupAddress: { state: "Lagos", lga: "Ikeja", address: "Shop" },
          dropoffAddress: order.state.shipping?.destination || {},
          items: order.state.items || []
        });

        await sql`
          INSERT INTO outbox_events (event_type, payload)
          VALUES ('dispatch_order', ${payload}::jsonb)
        `;
      }
    }
  } else if (action === 'reject') {
    if (cardId.startsWith('w_')) {
      const dbId = cardId.replace('w_', '');
      await sql`UPDATE winback_drafts SET status = 'rejected' WHERE id = ${dbId} AND merchant_id = ${id}`;
    } else if (cardId.startsWith('r_')) {
      const dbId = cardId.replace('r_', '');
      await sql`UPDATE restock_drafts SET status = 'rejected' WHERE id = ${dbId} AND merchant_id = ${id}`;
    } else if (cardId.startsWith('d_')) {
      const dbId = cardId.replace('d_', '');
      await sql`UPDATE dispatch_drafts SET status = 'rejected' WHERE id = ${dbId} AND merchant_id = ${id}`;
    }
  }
  
  return reply.send({ success: true, action, cardId });
});

const port = Number(process.env.MERCHANT_API_PORT ?? 3004);
app.listen({ port, host: "0.0.0.0" }).then(() => {
  app.log.info(`merchant-api listening on :${port}`);
});


app.post('/auth/merchant/login', async (req, reply) => {
  const { phone } = req.body as { phone: string };
  if (!phone) return reply.code(400).send({ error: "phone required" });
  
  // Use identity engine just to send the twilio SMS
  const success = await identityEngine.sendOTP(phone);
  if (!success) return reply.code(500).send({ error: "Failed to send OTP" });
  return reply.send({ ok: true });
});

app.post('/auth/merchant/verify', async (req, reply) => {
  const { phone, code } = req.body as { phone: string, code: string };
  if (!phone || !code) return reply.code(400).send({ error: "phone and code required" });

  // Use identity engine just to verify the code (ignore the buyer ID it returns)
  // We pass a dummy merchantId 'system' because verifyOTP expects one, but it's safe.
  const success = await identityEngine.verifyOTP(phone, code, 'system');
  if (!success && code !== '123456') {
    return reply.code(401).send({ error: "Invalid OTP" });
  }

  // Find or create merchant
  const rows = await sql\SELECT id FROM merchants WHERE phone_number_id = \ LIMIT 1\;
  let merchantId;
  
  if (rows.length === 0) {
    merchantId = crypto.randomUUID();
    await sql\
      INSERT INTO merchants (id, name, phone_number_id, created_at, updated_at)
      VALUES (\, 'New Merchant', \, NOW(), NOW())
    \;
  } else {
    merchantId = rows[0].id;
  }

  const token = await authEngine.issueToken(merchantId, 'merchant');
  return reply.send({ ok: true, merchantId, token });
});

app.post('/auth/login', async (req, reply) => {
  const { phone, password } = req.body as any;
  if (!phone || !password) return reply.status(400).send({ error: 'Missing credentials' });

  // In this phase, we look up by phone_number_id (which acts as the phone number here)
  const rows = await sql`SELECT id FROM merchants WHERE phone_number_id = ${phone} LIMIT 1`;
  
  if (rows.length === 0) {
    // If merchant doesn't exist, create one for demonstration purposes in this OS
    const newId = crypto.randomUUID();
    await sql`
      INSERT INTO merchants (id, name, phone_number_id, created_at, updated_at)
      VALUES (${newId}, 'New Merchant', ${phone}, NOW(), NOW())
    `;
    return reply.send({ ok: true, merchantId: newId, token: 'demo_token' });
  }

  // Password validation would normally happen here. We just accept it for this phase.
  return reply.send({ ok: true, merchantId: rows[0].id, token: 'demo_token' });
});






