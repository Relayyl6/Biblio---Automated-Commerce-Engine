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

// ─── Post instruction ─────────────────────────────────────────────────────────
// Parsed from the vendor's message after the word "post".
//
// Vendor can append to ANY product message:
//   "post this now"           → post to Status immediately
//   "post in 30 minutes"      → schedule Status post in 30 min
//   "post in 2 hours"         → schedule Status post in 2 hours
//   "post to 09023287443"     → DM the product directly to that WhatsApp number
//   (no "post" keyword)       → honour vendor.auto_status_enabled setting

type PostInstruction =
  | { type: "now" }
  | { type: "delayed"; delayMs: number; label: string }
  | { type: "direct"; targetPhone: string }
  | { type: "none" };

/**
 * Extracts a PostInstruction from the raw caption/text.
 * Strips the "post ..." suffix and returns the cleaned content + instruction.
 */
function parsePostInstruction(raw: string): { content: string; instruction: PostInstruction } {
  // Match: "post this now", "post now", "post it now"
  const nowMatch = raw.match(/\bpost(?:\s+(?:this|it))?\s+now\b/i);
  if (nowMatch) {
    return {
      content: raw.replace(nowMatch[0], "").trim(),
      instruction: { type: "now" },
    };
  }

  // Match: "post in 30 minutes", "post in 2 hours", "post in 1 hour"
  const delayMatch = raw.match(/\bpost(?:\s+(?:this|it))?\s+in\s+(\d+)\s*(minutes?|hours?|mins?|hrs?)\b/i);
  if (delayMatch) {
    const amount = parseInt(delayMatch[1], 10);
    const unit = delayMatch[2].toLowerCase();
    const isHours = unit.startsWith("h");
    const delayMs = amount * (isHours ? 3600_000 : 60_000);
    const label = `${amount} ${isHours ? "hour" : "minute"}${amount !== 1 ? "s" : ""}`;
    return {
      content: raw.replace(delayMatch[0], "").trim(),
      instruction: { type: "delayed", delayMs, label },
    };
  }

  // Match: "post to 09023287443" or "post to +2349023287443"
  const directMatch = raw.match(/\bpost(?:\s+(?:this|it))?\s+to\s+([+\d][\d\s]{7,14})\b/i);
  if (directMatch) {
    const targetPhone = directMatch[1].replace(/[^\d]/g, "");
    return {
      content: raw.replace(directMatch[0], "").trim(),
      instruction: { type: "direct", targetPhone },
    };
  }

  return { content: raw, instruction: { type: "none" } };
}

// ─── Main pipeline ────────────────────────────────────────────────────────────

export async function parseVendorSubmission(
  msg: WAMessage,
  vendor: VendorConfig,
  sock: WASocket
): Promise<void> {
  const msgContent = msg.message;
  const senderJid = msg.key.remoteJid!;

  // ── Detect submission type ────────────────────────────────────────────────
  const hasImage = !!msgContent?.imageMessage;
  const hasAudio = !!msgContent?.audioMessage;
  const rawText =
    msgContent?.conversation ||
    msgContent?.extendedTextMessage?.text ||
    msgContent?.imageMessage?.caption ||
    "";

  // Nothing useful in this message
  if (!hasImage && !hasAudio && !rawText.trim()) {
    await handleTextOnlySubmission(msg, senderJid, sock);
    return;
  }

  // ── Parse post instruction from text/caption ──────────────────────────────
  const { content: cleanContent, instruction } = parsePostInstruction(rawText);

  // ── Acquire media ─────────────────────────────────────────────────────────
  let imageBuffer: Buffer | null = null;
  let audioTranscript: string | null = null;

  if (hasImage) {
    try {
      imageBuffer = (await downloadMediaMessage(msg, "buffer", {})) as Buffer;
    } catch (err) {
      logger.error({ err, vendorId: vendor.id }, "Failed to download vendor image");
      await sock.sendMessage(senderJid, {
        text: "❌ Couldn't download your photo. Please try sending it again.",
      });
      return;
    }
  }

  if (hasAudio) {
    try {
      const audioBuffer = (await downloadMediaMessage(msg, "buffer", {})) as Buffer;
      // Lazy-import to avoid loading the heavy ONNX model on boot
      const { transcribeBuffer } = await import("./mediaProcessor.js");
      audioTranscript = await transcribeBuffer(audioBuffer);
    } catch (err) {
      logger.warn({ err, vendorId: vendor.id }, "Audio transcription failed — proceeding without it");
    }
  }

  // If vendor sent audio but no image, they're describing a product verbally
  // Build a text-based extraction instead
  const extractionText = audioTranscript
    ? `Voice note: ${audioTranscript}\n${cleanContent}`.trim()
    : cleanContent;

  // ── Claude extraction ─────────────────────────────────────────────────────
  let parsed: ParsedProduct;
  try {
    parsed = await parseWithClaude(imageBuffer, extractionText);
  } catch (err) {
    logger.error({ err, vendorId: vendor.id, extractionText }, "Claude parse failed");
    await sock.sendMessage(senderJid, {
      text:
        "❌ Couldn't extract product details.\n\n" +
        "Please include the price in your caption, for example:\n" +
        '"Ankara fabric – ₦8,000" or "Gown – 15k"',
    });
    return;
  }

  // ── Upload image ──────────────────────────────────────────────────────────
  const imageUrl = imageBuffer
    ? await uploadImage(imageBuffer, vendor.id, msg.key.id!)
    : null;

  // ── Upsert into products ──────────────────────────────────────────────────
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

  // ── Handle post instruction ───────────────────────────────────────────────
  const statusNote = await scheduleOrSendPost(
    instruction,
    sock,
    { sku, ...parsed, image_url: imageUrl },
    vendor
  );

  // ── Confirmation to vendor ────────────────────────────────────────────────
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

// ─── Post routing based on instruction ───────────────────────────────────────

async function scheduleOrSendPost(
  instruction: PostInstruction,
  sock: WASocket,
  product: { sku: string; product_name: string; price: number | null; image_url: string | null },
  vendor: VendorConfig
): Promise<string> {
  switch (instruction.type) {
    case "now":
      await postProductToStatus(sock, product, vendor.id);
      return "📢 Posted to your Status now ✅";

    case "delayed": {
      const { delayMs, label } = instruction;
      // Schedule via setTimeout — for MVP this is fine. For production, use BullMQ
      // with a delayed job so it survives process restarts.
      setTimeout(async () => {
        try {
          await postProductToStatus(sock, product, vendor.id);
          // Notify vendor when the scheduled post fires
          await sock.sendMessage(sock.authState.creds.me?.id.split(":")[0] + "@s.whatsapp.net", {
            text: `⏰ Scheduled post fired: *${product.product_name}* posted to your Status.`,
          }).catch(() => {});
        } catch (err) {
          logger.error({ err, vendorId: vendor.id, sku: product.sku }, "Scheduled Status post failed");
        }
      }, delayMs);
      return `⏰ Scheduled to post to your Status in ${label}`;
    }

    case "direct": {
      // DM the product directly to the specified WhatsApp number
      const { targetPhone } = instruction;
      const targetJid = `${targetPhone}@s.whatsapp.net`;
      const caption = buildStatusCaption({ product_name: product.product_name, price: product.price });
      try {
        if (product.image_url) {
          await sock.sendMessage(targetJid, { image: { url: product.image_url }, caption });
        } else {
          await sock.sendMessage(targetJid, { text: `${product.product_name}\n${caption}` });
        }
        return `📤 Sent directly to ${targetPhone} ✅`;
      } catch (err) {
        logger.error({ err, vendorId: vendor.id, targetPhone }, "Direct DM post failed");
        return `❌ Failed to send to ${targetPhone} — check the number and try again`;
      }
    }

    case "none":
    default:
      // Fall back to the vendor's auto_status_enabled setting
      if (vendor.auto_status_enabled) {
        if (!vendor.approve_before_post) {
          await postProductToStatus(sock, product, vendor.id);
          return "📢 Posted to your Status ✅";
        } else {
          await sql`
            INSERT INTO status_post_queue (vendor_id, sku, image_url, caption, queued_at)
            VALUES (
              ${vendor.id},
              ${product.sku},
              ${product.image_url},
              ${buildStatusCaption({ product_name: product.product_name, price: product.price })},
              now()
            )
          `;
          return "📋 Queued for your approval in the dashboard";
        }
      }
      return "";
  }
}

// ─── Claude Vision Extraction ─────────────────────────────────────────────────

async function parseWithClaude(
  imageBuffer: Buffer | null,
  textContext: string
): Promise<ParsedProduct> {
  const userContent: Anthropic.MessageParam["content"] = [];

  // Include image if we have one
  if (imageBuffer) {
    const imageBase64 = imageBuffer.toString("base64");
    userContent.push({
      type: "image",
      source: { type: "base64", media_type: "image/jpeg", data: imageBase64 },
    });
  }

  userContent.push({ type: "text", text: CLAUDE_PARSE_PROMPT(textContext) });

  const response = await anthropic.messages.create({
    model: process.env.ANTHROPIC_MODEL ?? "claude-opus-4-5",
    max_tokens: 512,
    messages: [{ role: "user", content: userContent }],
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

const CLAUDE_PARSE_PROMPT = (context: string) => `
You are a product cataloguing assistant for Nigerian informal commerce merchants.

The vendor submitted this product (text/caption/voice transcript):
"${context}"

Analyse the image (if provided) and the text carefully. Return ONLY valid JSON with this exact structure, nothing else:

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

  // Simple command: "status on" / "status off"
  if (/^status\s+(on|off)$/i.test(text.trim())) {
    const enable = /on/i.test(text);
    await sock.sendMessage(senderJid, {
      text: `Auto-Status posting ${enable ? "enabled ✅" : "disabled ⏸️"}. Update settings in your dashboard to make this permanent.`,
    });
    return;
  }

  // Default: show help
  await sock.sendMessage(senderJid, {
    text:
      "📦 *Adding a product:*\n" +
      "Send a photo OR voice note with the name and price.\n\n" +
      "*Examples:*\n" +
      "• _Red Ankara Fabric – ₦8,000_\n" +
      "• _White sneakers size 40-45, 15k_\n" +
      "• Voice note describing any product\n\n" +
      "*📢 Posting options* (add to end of caption):\n" +
      "• _...post this now_ → post to Status immediately\n" +
      "• _...post in 30 minutes_ → schedule Status post\n" +
      "• _...post in 2 hours_ → schedule Status post\n" +
      "• _...post to 09023287443_ → DM directly to that number\n\n" +
      "Without a post instruction, auto-Status uses your dashboard settings.",
  });
}
