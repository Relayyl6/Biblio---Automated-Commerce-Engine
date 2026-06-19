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
import { syncMerchantCatalog } from "../../catalog-sync/src/index";

const app = Fastify({ logger: true });

const API_KEY = process.env.ADMIN_API_KEY;
const DIALECTS: Dialect[] = ["pidgin", "yoruba", "igbo", "hausa", "english"];

// ─── Auth gate (no-op unless ADMIN_API_KEY is configured) ────────────────────
app.addHook("onRequest", async (req, reply) => {
  if (!API_KEY) return; // open in local dev when unset
  if (req.headers["x-api-key"] !== API_KEY) {
    return reply.code(401).send({ error: "invalid or missing x-api-key" });
  }
});

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
