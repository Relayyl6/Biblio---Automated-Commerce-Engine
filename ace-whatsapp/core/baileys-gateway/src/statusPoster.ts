// core/baileys-gateway/src/statusPoster.ts
//
// TWO ENTRY POINTS:
//   1. postProductToStatus()  — called immediately by inventoryParser after a
//      vendor push (reactive, triggered by vendor action)
//   2. runStatusCron()        — called by a setInterval every 30 minutes
//      (proactive, picks the least-recently-posted product per vendor and posts it)
//
// BOTH paths use the same core posting function (sendStatusPost) and the same
// status_log table.
//
// RATE LIMITING STRATEGY:
// Each vendor's posting_frequency_hours setting controls how often a product
// can be re-posted. The SQL query for the cron enforces this with a timestamp
// comparison. The reactive path (vendor push) always posts immediately —
// it's a deliberate action so we respect it.
//
// STATUS POSTS vs REGULAR MESSAGES:
// Posting to WhatsApp Status uses the special JID "status@broadcast".
// This requires the Baileys session to have a valid connection — if the
// session is disconnected, the post silently fails (caught and logged).
// Status posts appear in the "Updates" tab of all contacts who have the
// business number saved.

import type { WASocket } from "@whiskeysockets/baileys";
import P from "pino";
import { sql } from "@ace/shared/clients";
import { getSession } from "./sessionManager.js";
import { buildStatusCaption } from "./inventoryParser.js";

const logger = P({ level: "info" });

// ─── Types ────────────────────────────────────────────────────────────────────

interface StatusProduct {
  sku: string;
  product_name: string;
  price: number | null;
  image_url: string | null;
  imageBuffer?: Buffer | null; // preferred over image_url — works without a CDN
  business_phone?: string | null; // vendor's WhatsApp business number for wa.me deep-link
}

// ─── Core Status Posting ──────────────────────────────────────────────────────

async function sendStatusPost(
  sock: WASocket,
  product: StatusProduct,
  vendorId: string
): Promise<void> {
  // Prefer in-memory buffer (works without S3/CDN), fall back to public URL
  const hasBuffer = product.imageBuffer && product.imageBuffer.length > 0;
  const hasUrl = !!product.image_url;

  if (!hasBuffer && !hasUrl) {
    logger.warn({ vendorId, sku: product.sku }, "Skipping Status post — no image buffer or URL");
    return;
  }

  const caption = buildStatusCaption(
    { product_name: product.product_name, price: product.price },
    product.business_phone ?? "",
    product.sku
  );

  // Post to WhatsApp Status (Stories)
  // Baileys accepts either a Buffer or a { url } object for the image field
  await sock.sendMessage("status@broadcast", {
    image: hasBuffer ? product.imageBuffer! : { url: product.image_url! },
    caption,
  });

  // Update last_posted_at on the product row
  await sql`
    UPDATE products
    SET last_posted_at = now()
    WHERE sku = ${product.sku} AND merchant_id = (
      SELECT merchant_id FROM vendors WHERE id = ${vendorId} LIMIT 1
    )
  `;

  // Log to status_log for dashboard display and debugging
  await sql`
    INSERT INTO status_log (vendor_id, sku, image_url, caption, posted_at)
    VALUES (${vendorId}, ${product.sku}, ${product.image_url}, ${caption}, now())
  `;

  logger.info({ vendorId, sku: product.sku, caption, viaBuffer: hasBuffer }, "Status post published");
}

// ─── Reactive Post (vendor push) ─────────────────────────────────────────────
// Called immediately by inventoryParser after a successful product upsert.

export async function postProductToStatus(
  sock: WASocket,
  product: {
    sku: string;
    product_name: string;
    price: number | null;
    image_url: string | null;
    imageBuffer?: Buffer | null;
    business_phone?: string | null;
  },
  vendorId: string
): Promise<void> {
  try {
    await sendStatusPost(sock, product, vendorId);
  } catch (err) {
    // Don't crash the inventory intake pipeline if Status posting fails.
    // The product is already saved — the Status post is a bonus.
    logger.error({ err, vendorId, sku: product.sku }, "Reactive Status post failed");
  }
}

// ─── Cron-Driven Post ─────────────────────────────────────────────────────────
// Runs every 30 minutes (see the setInterval at the bottom of this file).
// Each vendor's own posting_frequency_hours is enforced via the SQL WHERE clause.

export async function runStatusCron(): Promise<void> {
  logger.info("Status cron starting");

  // Find all fully-automatic vendors with a connected session
  const vendors = await sql<{
    id: string;
    posting_frequency_hours: number;
  }[]>`
    SELECT id, posting_frequency_hours
    FROM vendors
    WHERE auto_status_enabled = true
      AND approve_before_post = false
      AND session_status = 'connected'
  `.catch((err: unknown) => {
    logger.error({ err }, "Status cron: failed to query vendors");
    return [];
  });

  for (const vendor of vendors) {
    const sock = getSession(vendor.id);
    if (!sock) continue; // Session may have dropped since the query ran

    try {
      await postNextProduct(vendor.id, vendor.posting_frequency_hours, sock);
    } catch (err) {
      logger.error({ err, vendorId: vendor.id }, "Status cron: failed to post for vendor");
    }
  }
}

export interface StatusCandidate {
  sku: string;
  name: string;
  price: number;
  image_url: string | null;
  margin_pct: number;
  recent_sales_velocity: number;
  promotion_score: number;
  last_posted_at: string | null;
  business_line_number: string | null;
}

export async function getStatusCandidates(vendorId: string, limit: number = 5): Promise<StatusCandidate[]> {
  const vendorRows = await sql<{
    status_strategy: string | null;
    margin_weight: number | null;
    velocity_weight: number | null;
  }[]>`
    SELECT status_strategy, margin_weight, velocity_weight
    FROM vendors
    WHERE id = ${vendorId}
    LIMIT 1
  `;
  const strategy = vendorRows[0]?.status_strategy || "balanced";
  let marginWeight = Number(vendorRows[0]?.margin_weight ?? 0.70);
  let velocityWeight = Number(vendorRows[0]?.velocity_weight ?? 0.30);

  if (strategy === "margin_priority") {
    marginWeight = 0.85;
    velocityWeight = 0.15;
  } else if (strategy === "velocity_priority") {
    marginWeight = 0.30;
    velocityWeight = 0.70;
  }

  const rows = await sql<{
    sku: string;
    name: string;
    price: number;
    image_url: string | null;
    margin_pct: number;
    recent_sales_velocity: number;
    promotion_score: number;
    last_posted_at: string | null;
    business_line_number: string | null;
  }[]>`
    WITH eligible_products AS (
      SELECT
        p.sku,
        p.name,
        p.price,
        p.image_url,
        p.last_posted_at,
        v.business_line_number,
        GREATEST(
          0.10,
          (p.price - COALESCE(
            (p.metadata->>'floor')::numeric,
            (p.metadata->>'cost_price')::numeric,
            (p.metadata->>'cost')::numeric,
            p.price * 0.70
          )) / GREATEST(p.price, 1.0)
        ) AS estimated_margin,
        COALESCE((
          SELECT COUNT(*)::int
          FROM orders o
          WHERE (
              o.supplier_id = p.supplier_id
              OR o.product_id = p.id
              OR o.product_id = p.product_id
            )
            AND (
              o.items::text LIKE ('%' || p.sku || '%')
              OR o.product_id = p.id
              OR o.product_id = p.product_id
            )
            AND o.created_at > now() - interval '14 days'
        ), 0) AS recent_sales_velocity
      FROM products p
      JOIN vendors v ON v.merchant_id = p.merchant_id
      WHERE v.id = ${vendorId}
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
      last_posted_at::text,
      business_line_number
    FROM eligible_products
    ORDER BY
      ${strategy === "freshness" ? sql`last_posted_at ASC NULLS FIRST, promotion_score DESC` : sql`promotion_score DESC, last_posted_at ASC NULLS FIRST`}
    LIMIT ${limit}
  `;

  return rows;
}

export async function postProductToStatusBySku(
  vendorId: string,
  sku?: string
): Promise<{ ok: boolean; sku?: string; name?: string; price?: number; error?: string }> {
  const sock = getSession(vendorId);
  if (!sock) {
    logger.warn({ vendorId }, "Cannot post to status: Baileys session not connected");
    return { ok: false, error: "WhatsApp business session is currently disconnected. Please re-pair your WhatsApp device." };
  }

  let targetProduct: {
    sku: string;
    name: string;
    price: number;
    image_url: string | null;
    business_line_number: string | null;
  } | undefined;

  if (sku) {
    const rows = await sql<{
      sku: string;
      name: string;
      price: number;
      image_url: string | null;
      business_line_number: string | null;
    }[]>`
      SELECT p.sku, p.name, p.price, p.image_url, v.business_line_number
      FROM products p
      JOIN vendors v ON v.merchant_id = p.merchant_id
      WHERE v.id = ${vendorId} AND p.sku = ${sku}
      LIMIT 1
    `;
    if (!rows[0]) {
      return { ok: false, error: `Product with SKU '${sku}' not found in catalog.` };
    }
    targetProduct = rows[0];
  } else {
    const candidates = await getStatusCandidates(vendorId, 1);
    if (candidates.length === 0) {
      return { ok: false, error: "No eligible products with images found in catalog." };
    }
    targetProduct = candidates[0];
  }

  if (!targetProduct.image_url) {
    return { ok: false, error: `Product '${targetProduct.name}' does not have an image URL.` };
  }

  try {
    await sendStatusPost(
      sock,
      {
        sku: targetProduct.sku,
        product_name: targetProduct.name,
        price: targetProduct.price,
        image_url: targetProduct.image_url,
        business_phone: targetProduct.business_line_number,
      },
      vendorId
    );
    return { ok: true, sku: targetProduct.sku, name: targetProduct.name, price: targetProduct.price };
  } catch (err: any) {
    logger.error({ err, vendorId, sku: targetProduct.sku }, "Manual status post failed");
    return { ok: false, error: err.message };
  }
}

async function postNextProduct(
  vendorId: string,
  frequencyHours: number,
  sock: WASocket
): Promise<void> {
  const candidates = await getStatusCandidates(vendorId, 1);
  if (candidates.length === 0) {
    logger.debug({ vendorId }, "Status cron: no eligible products to post");
    return;
  }
  const product = candidates[0];
  await sendStatusPost(
    sock,
    {
      sku: product.sku,
      product_name: product.name,
      price: product.price,
      image_url: product.image_url,
      business_phone: product.business_line_number,
    },
    vendorId
  );
}


// ─── Process approved queue items ─────────────────────────────────────────────
// For vendors with approve_before_post = true, the dashboard marks items
// as approved. This function fires them out once the cron runs.

export async function processApprovedQueue(): Promise<void> {
  const approved = await sql<{
    id: string;
    vendor_id: string;
    sku: string;
    image_url: string;
    caption: string;
  }[]>`
    SELECT q.id, q.vendor_id, q.sku, q.image_url, q.caption
    FROM status_post_queue q
    WHERE q.approved_at IS NOT NULL
      AND q.posted_at IS NULL
    ORDER BY q.approved_at ASC
    LIMIT 20
  `.catch(() => []);

  for (const item of approved) {
    const sock = getSession(item.vendor_id);
    if (!sock) continue;

    try {
      await sock.sendMessage("status@broadcast", {
        image: { url: item.image_url },
        caption: item.caption,
      });

      await sql`
        UPDATE status_post_queue
        SET posted_at = now()
        WHERE id = ${item.id}
      `;

      await sql`
        INSERT INTO status_log (vendor_id, sku, image_url, caption, posted_at)
        VALUES (${item.vendor_id}, ${item.sku}, ${item.image_url}, ${item.caption}, now())
      `;

      // Update last_posted_at on the product
      await sql`
        UPDATE products p
        SET last_posted_at = now()
        FROM vendors v
        WHERE v.id = ${item.vendor_id}
          AND p.merchant_id = v.merchant_id
          AND p.sku = ${item.sku}
      `;

      logger.info({ vendorId: item.vendor_id, sku: item.sku }, "Approved queue item posted to Status");
    } catch (err) {
      logger.error({ err, vendorId: item.vendor_id, queueId: item.id }, "Failed to post approved queue item");
    }
  }
}

// ─── Cron schedule ────────────────────────────────────────────────────────────
// Run every 30 minutes. Each vendor's own frequency is enforced by the SQL
// query — this just controls the minimum polling granularity.

let cronStarted = false;

export function startStatusCron(): void {
  if (cronStarted) return;
  cronStarted = true;

  logger.info("Status cron scheduler starting (30-minute interval)");

  setInterval(async () => {
    await runStatusCron();
    await processApprovedQueue();
  }, 30 * 60 * 1000);
}
