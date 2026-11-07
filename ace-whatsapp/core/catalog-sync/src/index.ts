// core/catalog-sync/src/index.ts
//
// Pulls a merchant's Meta Commerce Catalog into the local `products` table so
// the AI negotiator sells the SAME catalog the merchant already curates on
// WhatsApp/Facebook — no double data entry. This is the "WhatsApp-catalog sync"
// closing the "context provided off the seller" gap: the seller maintains their
// catalog in Meta Commerce Manager, ACE mirrors it.
//
// Two ways to run it:
//   - As a service:  POST /sync/:merchantId   (manual / cron-triggered re-sync)
//   - As a library:  import { syncMerchantCatalog } and call it from anywhere
//
// Auth + provider quirks are isolated here; the row shape is produced by the
// pure catalogMapper. Webhook-driven real-time sync (Meta `catalog_product`
// updates) is the Phase-2 upgrade — this pull-based sync is the foundation.

import Fastify from "fastify";
import { sql } from "@ace/shared/clients";
import {
  mapCatalogPage,
  type MetaCatalogProduct,
  type MappedProduct,
} from "./catalogMapper";

const GRAPH_VERSION = process.env.WHATSAPP_GRAPH_VERSION ?? "v21.0";
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;
const ACCESS_TOKEN = process.env.WHATSAPP_TOKEN;
// Meta catalog prices are commonly stored in minor units (kobo). Flip via env if
// your catalog stores whole-naira strings instead.
const PRICE_IN_MINOR_UNITS = process.env.CATALOG_PRICE_MINOR_UNITS !== "false";
const DEFAULT_CATALOG_STOCK = Number(process.env.CATALOG_DEFAULT_STOCK ?? 100);

const CATALOG_FIELDS =
  "id,retailer_id,name,description,price,currency,availability,inventory,image_url,category";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface SyncResult {
  merchantId: string;
  catalogId: string;
  fetched: number;
  upserted: number;
}

// ─── Public entry point ──────────────────────────────────────────────────────

export async function syncMerchantCatalog(merchantId: string): Promise<SyncResult> {
  if (!merchantId || !UUID_REGEX.test(merchantId)) {
    throw new Error(`Invalid merchantId format: "${merchantId}" is not a valid UUID`);
  }
  if (!ACCESS_TOKEN) throw new Error("WHATSAPP_TOKEN is not set");

  const catalogId = await resolveCatalogId(merchantId);
  if (!catalogId) {
    throw new Error(`Merchant ${merchantId} has no whatsapp_catalog_id configured`);
  }

  const nodes = await fetchAllCatalogProducts(catalogId);
  const mapped = mapCatalogPage(nodes, {
    priceInMinorUnits: PRICE_IN_MINOR_UNITS,
    defaultStock: DEFAULT_CATALOG_STOCK,
  });

  const upserted = await upsertProducts(merchantId, mapped);

  return { merchantId, catalogId, fetched: nodes.length, upserted };
}

// ─── Graph API fetch (paginated) ─────────────────────────────────────────────

async function fetchAllCatalogProducts(catalogId: string): Promise<MetaCatalogProduct[]> {
  const out: MetaCatalogProduct[] = [];
  let url:
    | string
    | null = `${GRAPH_BASE}/${encodeURIComponent(catalogId)}/products?fields=${CATALOG_FIELDS}&limit=100&access_token=${ACCESS_TOKEN}`;

  // Follow paging.next cursors until exhausted. Bounded to avoid an accidental
  // infinite loop if a cursor ever loops back on itself.
  for (let page = 0; url && page < 50; page++) {
    const res = await fetch(url);
    if (!res.ok) {
      const body = await safeText(res);
      throw new Error(`Catalog fetch failed (${res.status}): ${body}`);
    }
    const json = (await res.json()) as {
      data?: MetaCatalogProduct[];
      paging?: { next?: string };
    };
    if (Array.isArray(json.data)) out.push(...json.data);
    url = json.paging?.next ?? null;
  }

  return out;
}

// ─── Upsert ──────────────────────────────────────────────────────────────────

export async function upsertProducts(merchantId: string, products: MappedProduct[]): Promise<number> {
  if (!merchantId || !UUID_REGEX.test(merchantId)) {
    throw new Error(`Invalid merchantId format: "${merchantId}" is not a valid UUID`);
  }
  if (products.length === 0) return 0;

  // One transaction so a partial network/DB failure doesn't leave the catalog
  // half-synced. Each row upserts on (sku, merchant_id); manual enrichment in
  // tags/attributes is deliberately preserved (not overwritten by the catalog).
  await sql.begin(async (tx) => {
    for (const p of products) {
      await tx`
        insert into products
          (sku, merchant_id, name, stock, quantity, price, description, category,
           image_url, currency, source, updated_at)
        values (
          ${p.sku}, ${merchantId}::uuid, ${p.name}, ${p.stock}, ${p.stock}, ${p.price},
          ${p.description}, ${p.category}, ${p.imageUrl}, ${p.currency},
          'whatsapp_catalog', now()
        )
        on conflict (sku, merchant_id) do update set
          name        = excluded.name,
          stock       = excluded.stock,
          quantity    = excluded.quantity,
          price       = excluded.price,
          description = excluded.description,
          category    = excluded.category,
          image_url   = excluded.image_url,
          currency    = excluded.currency,
          source      = 'whatsapp_catalog',
          updated_at  = now()
      `;
    }
  });

  return products.length;
}

async function resolveCatalogId(merchantId: string): Promise<string | null> {
  if (!merchantId || !UUID_REGEX.test(merchantId)) return null;
  const rows = await sql<{ whatsapp_catalog_id: string | null }[]>`
    select whatsapp_catalog_id from merchants where id = ${merchantId}::uuid limit 1
  `;
  return rows[0]?.whatsapp_catalog_id ?? null;
}

async function safeText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return "<unreadable body>";
  }
}

// ─── Service wrapper (manual / cron-triggered re-sync) ───────────────────────

// Only boot the HTTP server when run directly (tsx core/catalog-sync/src/index.ts),
// not when imported as a library by another service.
if (process.argv[1] && process.argv[1].includes("catalog-sync")) {
  const app = Fastify({ logger: true });

  app.post("/sync/:merchantId", async (req, reply) => {
    const { merchantId } = req.params as { merchantId: string };
    if (!merchantId || !UUID_REGEX.test(merchantId)) {
      return reply.code(400).send({ ok: false, error: "INVALID_MERCHANT_ID", message: "merchantId must be a valid UUID" });
    }
    try {
      const result = await syncMerchantCatalog(merchantId);
      return reply.send({ ok: true, ...result });
    } catch (err: any) {
      req.log.error({ err, merchantId }, "catalog sync failed");
      const statusCode = err.message.includes("no whatsapp_catalog_id") ? 404 : 502;
      return reply.code(statusCode).send({ ok: false, error: err.message });
    }
  });

  const port = Number(process.env.CATALOG_SYNC_PORT ?? 3003);
  app.listen({ port, host: "0.0.0.0" }).then(() => {
    app.log.info(`catalog-sync listening on :${port}`);
  });
}
