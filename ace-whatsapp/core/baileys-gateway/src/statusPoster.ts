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
}

// ─── Core Status Posting ──────────────────────────────────────────────────────

async function sendStatusPost(
  sock: WASocket,
  product: StatusProduct,
  vendorId: string
): Promise<void> {
  if (!product.image_url) {
    // Cannot post to Status without an image — skip silently
    logger.warn({ vendorId, sku: product.sku }, "Skipping Status post — no image_url");
    return;
  }

  const caption = buildStatusCaption({
    product_name: product.product_name,
    price: product.price,
  });

  // Post to WhatsApp Status (Stories)
  await sock.sendMessage("status@broadcast", {
    image: { url: product.image_url },
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

  logger.info({ vendorId, sku: product.sku, caption }, "Status post published");
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

async function postNextProduct(
  vendorId: string,
  frequencyHours: number,
  sock: WASocket
): Promise<void> {
  // Select the product least recently posted for this vendor.
  // Enforces per-vendor frequency: only eligible if last_posted_at was more
  // than posting_frequency_hours ago (or never posted at all).
  const products = await sql<{
    sku: string;
    name: string;
    price: number;
    image_url: string | null;
  }[]>`
    SELECT p.sku, p.name, p.price, p.image_url
    FROM products p
    JOIN vendors v ON v.merchant_id = p.merchant_id
    WHERE v.id = ${vendorId}
      AND p.active = true
      AND p.image_url IS NOT NULL
      AND (
        p.last_posted_at IS NULL
        OR p.last_posted_at < now() - (${frequencyHours} || ' hours')::interval
      )
    ORDER BY p.last_posted_at ASC NULLS FIRST
    LIMIT 1
  `;

  if (products.length === 0) {
    logger.debug({ vendorId }, "Status cron: no eligible products to post");
    return;
  }

  const product = products[0];
  await sendStatusPost(
    sock,
    {
      sku: product.sku,
      product_name: product.name,
      price: product.price,
      image_url: product.image_url,
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
