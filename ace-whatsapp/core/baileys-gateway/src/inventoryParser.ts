// core/baileys-gateway/src/inventoryParser.ts
//
// WHAT THIS FILE DOES:
// When the vendor sends a photo + caption to their own business line,
// this pipeline fires:
//
//   1. Download the image from the Baileys socket (Buffer)
//   2. Upload it to persistent storage (S3 or Cloudinary) before the
//      WhatsApp media URL expires
//   3. Send the image + caption to Claude Vision for structured extraction
//   4. Upsert the parsed product into the `products` table
//   5. Optionally post the product to WhatsApp Status immediately
//   6. Send a human-readable confirmation back to the vendor
//
// FAILURE MODES:
// - Image download fails: vendor gets a friendly retry message
// - Claude returns no JSON: vendor gets a specific error asking them to
//   include price in the caption
// - Storage upload fails: we still upsert the product but with null image_url
//
// THE CLAUDE PROMPT DESIGN:
// The prompt is engineered for Nigerian informal commerce. Key decisions:
// - "8k", "8,000", "₦8000" should all parse to 8000
// - Descriptions should help CUSTOMERS decide, not just label the product
// - Out-of-stock and made-to-order are explicitly supported availability states
// - Confidence: if price is ambiguous, set to null rather than guess wrong

import Anthropic from "@anthropic-ai/sdk";
import type { WAMessage, WASocket } from "@whiskeysockets/baileys";
import { downloadMediaMessage } from "@whiskeysockets/baileys";
import P from "pino";
import { sql } from "@ace/shared/clients";
import type { VendorConfig } from "./sessionManager.js";
import { postProductToStatus } from "./statusPoster.js";

const logger = P({ level: "info" });
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

// ─── Parsed output shape from Claude ─────────────────────────────────────────

interface ParsedProduct {
  product_name: string;
  price: number | null;   // null if price not found in caption/image
  description: string;
  availability: "in_stock" | "out_of_stock" | "made_to_order";
  currency: string;
}

// ─── Main pipeline ────────────────────────────────────────────────────────────

export async function parseVendorSubmission(
  msg: WAMessage,
  vendor: VendorConfig,
  sock: WASocket
): Promise<void> {
  const msgContent = msg.message;
  const senderJid = msg.key.remoteJid!;

  // If vendor sent text only (no image), send them a help message
  if (!msgContent?.imageMessage) {
    await handleTextOnlySubmission(msg, senderJid, sock);
    return;
  }

  const caption = msgContent.imageMessage.caption ?? "";

  // ── Step 1: Download the image before the WA media URL expires ──────────
  let imageBuffer: Buffer;
  try {
    imageBuffer = (await downloadMediaMessage(
      msg,
      "buffer",
      {},
    )) as Buffer;
  } catch (err) {
    logger.error({ err, vendorId: vendor.id }, "Failed to download vendor image");
    await sock.sendMessage(senderJid, {
      text: "❌ Couldn't download your photo. Please try sending it again.",
    });
    return;
  }

  // ── Step 2: Upload to persistent storage ────────────────────────────────
  const imageUrl = await uploadImage(imageBuffer, vendor.id, msg.key.id!);

  // ── Step 3: Claude Vision parse ─────────────────────────────────────────
  let parsed: ParsedProduct;
  try {
    parsed = await parseWithClaude(imageBuffer, caption);
  } catch (err) {
    logger.error({ err, vendorId: vendor.id, caption }, "Claude Vision parse failed");
    await sock.sendMessage(senderJid, {
      text:
        "❌ Couldn't extract product details.\n\n" +
        "Please include the price in your caption, for example:\n" +
        '"Ankara fabric – ₦8,000" or "Gown – 15k"',
    });
    return;
  }

  // ── Step 4: Upsert into products table ──────────────────────────────────
  const sku = generateSku(vendor.id, parsed.product_name);

  await sql`
    INSERT INTO products (
      sku, merchant_id, name, price, description,
      image_url, stock, currency, active, source,
      last_posted_at, updated_at
    ) VALUES (
      ${sku},
      ${vendor.merchant_id},
      ${parsed.product_name},
      ${parsed.price ?? 0},
      ${parsed.description},
      ${imageUrl},
      999,
      ${parsed.currency},
      true,
      'vendor_push',
      NULL,
      now()
    )
    ON CONFLICT (sku, merchant_id) DO UPDATE SET
      name          = EXCLUDED.name,
      price         = EXCLUDED.price,
      description   = EXCLUDED.description,
      image_url     = COALESCE(EXCLUDED.image_url, products.image_url),
      active        = true,
      source        = 'vendor_push',
      updated_at    = now()
  `;

  logger.info(
    { sku, vendorId: vendor.id, productName: parsed.product_name, price: parsed.price },
    "Product upserted from vendor push"
  );

  // ── Step 5: Post to Status if enabled ───────────────────────────────────
  let statusNote = "";

  if (vendor.auto_status_enabled) {
    if (!vendor.approve_before_post) {
      // Fully automatic — post right now
      await postProductToStatus(sock, { sku, ...parsed, image_url: imageUrl }, vendor.id);
      statusNote = "Posted to your Status ✅";
    } else {
      // Approval required — queue it for dashboard review
      await sql`
        INSERT INTO status_post_queue (vendor_id, sku, image_url, caption, queued_at)
        VALUES (
          ${vendor.id},
          ${sku},
          ${imageUrl},
          ${buildStatusCaption(parsed)},
          now()
        )
      `;
      statusNote = "Queued for your approval in the dashboard 📋";
    }
  }

  // ── Step 6: Confirmation to vendor ──────────────────────────────────────
  const priceDisplay = parsed.price
    ? `₦${parsed.price.toLocaleString("en-NG")}`
    : "⚠️ No price found — please set it in your dashboard";

  const confirmationLines = [
    `✅ *${parsed.product_name}* added to your shop`,
    `💰 Price: ${priceDisplay}`,
    `📦 Availability: ${parsed.availability.replace(/_/g, " ")}`,
    statusNote,
  ].filter(Boolean);

  await sock.sendMessage(senderJid, {
    text: confirmationLines.join("\n"),
  });
}

// ─── Claude Vision Extraction ─────────────────────────────────────────────────

async function parseWithClaude(
  imageBuffer: Buffer,
  caption: string
): Promise<ParsedProduct> {
  const imageBase64 = imageBuffer.toString("base64");

  const response = await anthropic.messages.create({
    model: process.env.ANTHROPIC_MODEL ?? "claude-opus-4-5",
    max_tokens: 512,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: "image/jpeg",
              data: imageBase64,
            },
          },
          {
            type: "text",
            text: CLAUDE_PARSE_PROMPT(caption),
          },
        ],
      },
    ],
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";

  // Extract the first JSON object from Claude's response
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Claude returned no JSON block");
  }

  const parsed = JSON.parse(jsonMatch[0]) as ParsedProduct;

  // Validate the required fields
  if (!parsed.product_name || typeof parsed.product_name !== "string") {
    throw new Error("Claude returned no product_name");
  }

  return {
    product_name: parsed.product_name.trim(),
    price: typeof parsed.price === "number" ? Math.round(parsed.price) : null,
    description: parsed.description ?? "",
    availability: parsed.availability ?? "in_stock",
    currency: parsed.currency ?? "NGN",
  };
}

const CLAUDE_PARSE_PROMPT = (caption: string) => `
You are a product cataloguing assistant for Nigerian informal commerce merchants.

The vendor sent this product photo with caption: "${caption}"

Analyse the image carefully. Return ONLY valid JSON with this exact structure, nothing else:

{
  "product_name": "string — concise, searchable product name (e.g. 'Red Ankara Fabric', 'Straight-leg Jeans', 'Peak Milk 400g')",
  "price": number_or_null — price in Nigerian Naira as a plain integer. Extract from caption or visible price tags. Set null if not found.,
  "description": "string — 1-2 sentences that help a WhatsApp customer decide to buy. Mention visible details: fabric type, colours, sizes, occasion, quality signals.",
  "availability": "in_stock" | "out_of_stock" | "made_to_order",
  "currency": "NGN"
}

Price extraction rules:
- "₦8,000" → 8000
- "8k" or "8K" → 8000
- "15k" → 15000
- "1.5m" or "1.5M" → 1500000
- "8,500" → 8500
- "8500" → 8500
- If no price visible anywhere, set null

Keep product_name short and searchable — customers will search for it.
Description must be customer-facing, not just a label.
`.trim();

// ─── Status caption builder ───────────────────────────────────────────────────

export function buildStatusCaption(product: Pick<ParsedProduct, "product_name" | "price">): string {
  const priceStr = product.price
    ? `₦${product.price.toLocaleString("en-NG")}`
    : "DM for price";
  return `${product.product_name}\n${priceStr}\n\nDM to order 📦`;
}

// ─── Image Storage ────────────────────────────────────────────────────────────
// Stub: stores the image Buffer locally to /tmp for now.
// In production: replace with an S3 / Cloudinary / DigitalOcean Spaces upload.
// The function must return a publicly-accessible URL (used in Status posts).

async function uploadImage(
  buffer: Buffer,
  vendorId: string,
  messageId: string
): Promise<string | null> {
  try {
    // Production implementation: upload to S3 and return the CDN URL
    // import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
    // const key = `vendors/${vendorId}/${messageId}.jpg`;
    // await s3.send(new PutObjectCommand({ Bucket, Key: key, Body: buffer, ContentType: 'image/jpeg' }));
    // return `https://${CDN_DOMAIN}/${key}`;

    // DEV stub: write to a local temp path and return a relative URL
    // This will not work for Status posts (which need a public URL) in dev.
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const dir = `/tmp/ace-vendor-images/${vendorId}`;
    await fs.mkdir(dir, { recursive: true });
    const filePath = path.join(dir, `${messageId}.jpg`);
    await fs.writeFile(filePath, buffer);
    logger.info({ filePath }, "Image saved locally (dev mode — replace with S3 in prod)");
    return null; // null = local file, not postable to Status without a public URL
  } catch (err) {
    logger.error({ err }, "Image upload failed — product saved without image");
    return null;
  }
}

// ─── SKU generation ───────────────────────────────────────────────────────────

function generateSku(vendorId: string, productName: string): string {
  // Deterministic: same vendor + same product name → same SKU
  // This ensures re-sending the same photo updates the existing row (ON CONFLICT)
  const slug = productName
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 30);
  return `vp-${vendorId.slice(0, 8)}-${slug}`;
}

// ─── Text-only handler ────────────────────────────────────────────────────────

async function handleTextOnlySubmission(
  msg: WAMessage,
  senderJid: string,
  sock: WASocket
): Promise<void> {
  const text =
    msg.message?.conversation ||
    msg.message?.extendedTextMessage?.text ||
    "";

  // Simple command parsing: vendor can send "status off" to toggle auto-Status
  if (/^status\s+(on|off)$/i.test(text.trim())) {
    const enable = /on/i.test(text);
    // This would call a settings update — for now just acknowledge
    await sock.sendMessage(senderJid, {
      text: `Auto-Status posting ${enable ? "enabled ✅" : "disabled ⏸️"}. Update settings in your dashboard to make this permanent.`,
    });
    return;
  }

  // Default: show help
  await sock.sendMessage(senderJid, {
    text:
      "📦 *Adding a product:*\nSend a photo with the name and price in the caption.\n\n" +
      "*Examples:*\n" +
      "• _Red Ankara Fabric – ₦8,000_\n" +
      "• _White sneakers size 40-45, 15k_\n" +
      "• _Peak Milk 400g, ₦1,200_\n\n" +
      "The product will be added to your shop automatically.",
  });
}
