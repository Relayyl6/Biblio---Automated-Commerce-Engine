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
import { sql, jsonb } from "@ace/shared/clients";
import type { Dialect } from "@ace/shared/types";
import { syncMerchantCatalog } from "../../catalog-sync/src/index.js";
import { authEngine } from "@ace/shared/auth/index.js";
import { identityEngine } from "@ace/shared/identity-resolution/index.js";
import { dataIntelligence } from "@ace/shared/data-intelligence/engine.js";
import cors from "@fastify/cors";
// Baileys gateway management calls — forwarded to the gateway HTTP service
const BAILEYS_GATEWAY_URL =
  process.env.BAILEYS_GATEWAY_URL ?? "http://localhost:3005";

const app = Fastify({ logger: true });

app.register(cors, {
  origin: "*", // allow React dev server to communicate
});

// ─── Auth gate (SharedAuthEngine) ────────────────────────────────────────────
app.addHook("onRequest", authEngine.getFastifyHook());

// ─── Auth & Identity Routes (Open) ───────────────────────────────────────────

// Dev/Test hook to generate a dummy JWT
app.post("/auth/token", async (req, reply) => {
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
  // Return aggregated metrics for the Admin Portal Recharts Dashboard
  // This stubs the ClickHouse connection from Phase 3 Data Intelligence Engine
  const data = {
    elasticity: [
      { name: "Mon", score: 0.82 },
      { name: "Tue", score: 0.85 },
      { name: "Wed", score: 0.79 },
      { name: "Thu", score: 0.91 },
      { name: "Fri", score: 0.88 },
      { name: "Sat", score: 0.95 },
      { name: "Sun", score: 0.89 },
    ],
    outcomes: [
      { name: "Closed", value: 420 },
      { name: "Bundle Pivot", value: 135 },
      { name: "Escalated", value: 85 },
      { name: "Abandoned", value: 210 },
    ]
  };
  return reply.send(data);
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
    select id, name, phone_number_id, tone_guide, business_policies,
           delivery_info, dialect, whatsapp_catalog_id, created_at
    from merchants where id = ${id} limit 1
  `;
  if (!rows[0]) return reply.code(404).send({ error: "merchant not found" });
  return rows[0];
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
  return sql`
    select sku, name, stock, price, description, category, tags, attributes,
           image_url, currency, active, source, updated_at
    from products where merchant_id = ${id}
    order by updated_at desc
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

// ─── Boot ────────────────────────────────────────────────────────────────────

const port = Number(process.env.MERCHANT_API_PORT ?? 3004);
app.listen({ port, host: "0.0.0.0" }).then(() => {
  app.log.info(`merchant-api listening on :${port}`);
});
