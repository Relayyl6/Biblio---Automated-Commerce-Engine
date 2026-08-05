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

import Groq from "groq-sdk";
import type { WAMessage, WASocket } from "@whiskeysockets/baileys";
import { downloadMediaMessage } from "@whiskeysockets/baileys";
import P from "pino";
import { sql } from "@ace/shared/clients";
import { dataIntelligence } from "@ace/shared/data-intelligence/engine";
import type { VendorConfig } from "./sessionManager.js";
import { postProductToStatus } from "./statusPoster.js";


const logger = P({ level: "info" });
let groqClient: Groq | null = null;
function getGroq(): Groq {
  if (!groqClient) {
    groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY || process.env.ANTHROPIC_API_KEY || "" });
  }
  return groqClient;
}

// ─── Parsed output shape from Claude ─────────────────────────────────────────

interface ParsedProduct {
  product_name: string;
  price: number | null;   // null if price not found in caption/image
  stock: number | null;   // null if stock not mentioned
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

interface InflightItem {
  id: string;
  text: string;
  imageBuffer: Buffer | null;
  audioTranscript: string | null;
}

interface InflightVendorBuffer {
  items: InflightItem[];
  timer: NodeJS.Timeout | null;
  senderJid: string;
}

const vendorBuffers = new Map<string, InflightVendorBuffer>();
const VENDOR_DEBOUNCE_MS = 10_000; // 10-second sliding debounce window

// ─── Main pipeline with 10-second Sliding Debounce ───────────────────────────

export async function parseVendorSubmission(
  msg: WAMessage,
  vendor: VendorConfig,
  sock: WASocket
): Promise<void> {
  const msgContent = msg.message;
  const senderJid = msg.key.remoteJid || (vendor.business_line_number ? `${vendor.business_line_number}@s.whatsapp.net` : "");

  // ── Detect submission type ────────────────────────────────────────────────
  const hasImage = !!msgContent?.imageMessage;
  const hasAudio = !!msgContent?.audioMessage;
  const rawText =
    msgContent?.conversation ||
    msgContent?.extendedTextMessage?.text ||
    msgContent?.imageMessage?.caption ||
    "";

  // Standalone status command
  if (!hasImage && !hasAudio && /^status\s+(on|off)$/i.test(rawText.trim())) {
    await handleTextOnlySubmission(msg, senderJid, sock);
    return;
  }

  // ── Acquire media immediately before buffering ───────────────────────────
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
      const { transcribeBuffer } = await import("./mediaProcessor.js");
      audioTranscript = await transcribeBuffer(audioBuffer);
    } catch (err) {
      logger.warn({ err, vendorId: vendor.id }, "Audio transcription failed — proceeding without it");
    }
  }

  // ── Enqueue into Vendor Debounce Buffer ────────────────────────────────────
  let inflight = vendorBuffers.get(vendor.id);
  if (!inflight) {
    inflight = {
      items: [],
      timer: null,
      senderJid,
    };
    vendorBuffers.set(vendor.id, inflight);
  }

  inflight.items.push({
    id: msg.key.id || String(Date.now()),
    text: rawText.trim(),
    imageBuffer,
    audioTranscript,
  });

  // Reset 10-second sliding debounce timer
  if (inflight.timer) {
    clearTimeout(inflight.timer);
  }

  logger.info(
    { vendorId: vendor.id, bufferedCount: inflight.items.length, debounceMs: VENDOR_DEBOUNCE_MS },
    "Vendor message buffered in 10s debounce window"
  );

  inflight.timer = setTimeout(async () => {
    await flushVendorBuffer(vendor, sock);
  }, VENDOR_DEBOUNCE_MS);
}

/**
 * Flushes and processes all buffered messages for a vendor into a single inventory entry.
 */
export async function flushVendorBuffer(
  vendor: VendorConfig,
  sock: WASocket
): Promise<void> {
  const inflight = vendorBuffers.get(vendor.id);
  if (!inflight || inflight.items.length === 0) {
    if (inflight?.timer) clearTimeout(inflight.timer);
    vendorBuffers.delete(vendor.id);
    return;
  }

  if (inflight.timer) clearTimeout(inflight.timer);
  vendorBuffers.delete(vendor.id);

  await processGroupedVendorSubmission(inflight.items, inflight.senderJid, vendor, sock);
}

/**
 * Parses and saves the consolidated inventory item.
 */
async function processGroupedVendorSubmission(
  items: InflightItem[],
  senderJid: string,
  vendor: VendorConfig,
  sock: WASocket
): Promise<void> {
  // Combine all texts and captions
  const combinedTexts = items
    .map(i => i.text)
    .filter(Boolean)
    .join("\n");

  // Combine audio transcripts
  const combinedTranscripts = items
    .map(i => i.audioTranscript)
    .filter(Boolean)
    .join("\n");

  // First non-null image buffer
  const imageBuffer = items.find(i => i.imageBuffer)?.imageBuffer || null;
  const primaryMessageId = items[0]?.id || String(Date.now());

  const fullRaw = [
    combinedTranscripts ? `Voice note: ${combinedTranscripts}` : "",
    combinedTexts,
  ].filter(Boolean).join("\n");

  if (!imageBuffer && !fullRaw.trim()) {
    return;
  }

  // Parse post instruction from combined text
  const { content: cleanContent, instruction } = parsePostInstruction(fullRaw);

  // ── Groq extraction with full consolidated context ────────────────────────
  let parsed: ParsedProduct;
  try {
    parsed = await parseWithGroq(imageBuffer, cleanContent);
  } catch (err) {
    logger.error({ err, vendorId: vendor.id, cleanContent }, "Groq parse failed on grouped submission");
    if (senderJid) {
      await sock.sendMessage(senderJid, {
        text:
          "❌ Couldn't extract product details from your submission.\n\n" +
          "Please include the price, for example:\n" +
          '"Ankara fabric – ₦8,000" or "Gown – 15k"',
      });
    }
    return;
  }

  // ── Upload image ──────────────────────────────────────────────────────────
  const imageUrl = imageBuffer
    ? await uploadImage(imageBuffer, vendor.id, primaryMessageId)
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
      ${parsed.stock ?? 1},
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
    "Grouped product upserted from vendor push"
  );

  // Telemetry: Record product intelligence event
  dataIntelligence.logInventoryIngestion({
    merchantId: vendor.merchant_id,
    vendorId: vendor.id,
    sku,
    productName: parsed.product_name,
    price: parsed.price,
    stock: parsed.stock ?? 1,
    source: combinedTranscripts ? "whatsapp_voice" : "whatsapp_image",
  }).catch(() => {});

  // ── Handle post instruction ───────────────────────────────────────────────
  const statusNote = await scheduleOrSendPost(
    instruction,
    sock,
    { sku, ...parsed, image_url: imageUrl, imageBuffer },
    vendor
  );

  // ── Confirmation to vendor ────────────────────────────────────────────────
  const priceDisplay = parsed.price
    ? `₦${parsed.price.toLocaleString("en-NG")}`
    : "⚠️ No price found — please set it in your dashboard";

  const confirmationLines = [
    `✅ *${parsed.product_name}* added to your shop inventory`,
    `💰 Price: ${priceDisplay}`,
    `📦 Availability: ${parsed.availability.replace(/_/g, " ")}`,
    statusNote,
  ].filter(Boolean);

  if (senderJid) {
    await sock.sendMessage(senderJid, {
      text: confirmationLines.join("\n"),
    });
  }
}

// ─── Post routing based on instruction ───────────────────────────────────────

async function scheduleOrSendPost(
  instruction: PostInstruction,
  sock: WASocket,
  product: { sku: string; product_name: string; price: number | null; image_url: string | null; imageBuffer?: Buffer | null },
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

// ─── Groq Extraction ─────────────────────────────────────────────────────────

/**
 * Robustly extract a JSON object from a model response that may be:
 *   - Pure JSON: {"product_name": ...}
 *   - Markdown-fenced: ```json\n{...}\n```
 *   - JSON embedded in prose: "Here is the result: {...} Done."
 */
function extractJson(raw: string): Record<string, unknown> {
  // 1. Try direct parse first
  try { return JSON.parse(raw); } catch { /* fall through */ }

  // 2. Strip markdown code fences
  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch) {
    try { return JSON.parse(fenceMatch[1].trim()); } catch { /* fall through */ }
  }

  // 3. Extract first {...} block
  const braceMatch = raw.match(/\{[\s\S]*\}/);
  if (braceMatch) {
    try { return JSON.parse(braceMatch[0]); } catch { /* fall through */ }
  }

  throw new Error(`Cannot extract JSON from model response: ${raw.slice(0, 200)}`);
}

/**
 * Fallback price extractor from raw text — handles "320k", "320K", "₦320,000", "320000", "1.5m"
 * Used when the model returns null price but there's clearly a price in the caption.
 */
function extractPriceFromText(text: string): number | null {
  // e.g. "1.5m", "1.5M" → 1_500_000
  const millionMatch = text.match(/(\d+(?:\.\d+)?)\s*m\b/i);
  if (millionMatch) return Math.round(parseFloat(millionMatch[1]) * 1_000_000);

  // e.g. "320k", "8K", "15k"
  const kMatch = text.match(/(\d+(?:\.\d+)?)\s*k\b/i);
  if (kMatch) return Math.round(parseFloat(kMatch[1]) * 1_000);

  // e.g. "₦8,500" or "8,500" or "8500"
  const nairaMatch = text.match(/[₦#]?\s*(\d{1,3}(?:[,_]\d{3})+|\d{4,})/);
  if (nairaMatch) return parseInt(nairaMatch[1].replace(/[,_]/g, ""), 10);

  return null;
}

async function parseWithGroq(
  imageBuffer: Buffer | null,
  textContext: string
): Promise<ParsedProduct> {
  const client = getGroq();
  const messages: Groq.Chat.ChatCompletionMessageParam[] = [];

  let rawContent: string;

  if (imageBuffer) {
    const imageBase64 = imageBuffer.toString("base64");
    messages.push({
      role: "user",
      content: [
        { type: "text", text: GROQ_PARSE_PROMPT(textContext) },
        {
          type: "image_url",
          image_url: {
            url: `data:image/jpeg;base64,${imageBase64}`,
          },
        },
      ],
    });

    // NOTE: llama-3.2-11b-vision-preview does NOT support response_format JSON mode.
    // We ask for JSON in the prompt and parse robustly instead.
    try {
      const response = await client.chat.completions.create({
        model: "llama-3.2-11b-vision-preview",
        max_tokens: 512,
        temperature: 0.1,
        messages,
      });
      rawContent = response.choices[0]?.message?.content ?? "{}";
    } catch (err: any) {
      if (err?.error?.error?.code === "model_decommissioned" || err?.status === 400 || err?.status === 404) {
        // Groq took their vision models offline. Fallback to text-only extraction using the caption text.
        const textResponse = await client.chat.completions.create({
          model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
          max_tokens: 512,
          temperature: 0.1,
          response_format: { type: "json_object" },
          messages: [{ role: "user", content: GROQ_PARSE_PROMPT(textContext) }],
        });
        rawContent = textResponse.choices[0]?.message?.content ?? "{}";
      } else {
        throw err;
      }
    }
  } else {
    // Text-only path — text models DO support JSON mode
    messages.push({
      role: "user",
      content: GROQ_PARSE_PROMPT(textContext),
    });

    const response = await client.chat.completions.create({
      model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
      max_tokens: 512,
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages,
    });
    rawContent = response.choices[0]?.message?.content ?? "{}";
  }

  const parsed = extractJson(rawContent) as Partial<ParsedProduct>;

  if (!parsed.product_name || typeof parsed.product_name !== "string") {
    throw new Error("Groq returned no product_name");
  }

  // If the model missed the price, try to extract it ourselves from the caption
  let price: number | null = typeof parsed.price === "number" ? Math.round(parsed.price) : null;
  if (price === null && textContext) {
    price = extractPriceFromText(textContext);
  }

  return {
    product_name: parsed.product_name.trim(),
    price,
    stock: (parsed.stock as number | null) ?? null,
    description: (parsed.description as string) ?? "",
    availability: (parsed.availability as ParsedProduct["availability"]) ?? "in_stock",
    currency: (parsed.currency as string) ?? "NGN",
  };
}

const GROQ_PARSE_PROMPT = (context: string) => `
You are a product cataloguing assistant for Nigerian informal commerce merchants.

The vendor submitted this product (text/caption/voice transcript):
"${context}"

Analyse the image (if provided) and the text carefully. Return ONLY valid JSON with this exact structure, nothing else:

{
  "product_name": "string — concise, searchable product name (e.g. 'Red Ankara Fabric', 'Straight-leg Jeans', 'Peak Milk 400g')",
  "price": number_or_null — price in Nigerian Naira as a plain integer. Extract from caption or visible price tags. Set null if not found.,
  "stock": number_or_null — available stock quantity as a plain integer. Extract from caption if explicitly stated (e.g., '5 pieces left' -> 5, '3 available' -> 3). Set null if not found.,
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
