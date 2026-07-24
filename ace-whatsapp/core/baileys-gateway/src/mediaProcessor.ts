// core/baileys-gateway/src/mediaProcessor.ts
//
// WHAT THIS FILE DOES:
// Resolves media from raw Baileys WAMessage objects BEFORE they are enqueued
// into the BullMQ debounce queue. This keeps all Baileys dependencies inside
// the gateway and away from the ai-negotiator.
//
// TRANSCRIPTION STRATEGY — Groq Whisper API (free tier):
// We use the Groq API's Whisper endpoint rather than OpenAI's because:
//   - Groq free tier: 28,800 seconds/day (~8 hours of audio, zero cost)
//   - 4-6x faster than OpenAI Whisper (avg ~2s for a 30s voice note)
//   - Identical API shape: drop-in compatible with openai-js
//   - No local model download, no GPU, no Python needed
//
// API KEY: Get a free key at console.groq.com (no credit card)
// Set GROQ_API_KEY in your .env file.
//
// GRACEFUL DEGRADATION:
// If transcription fails (network, quota, unsupported format), we return null
// and the agent receives "[Voice note — ask customer to type if unclear]"
// instead of crashing the pipeline.

import type { WAMessage, WASocket } from "@whiskeysockets/baileys";
import { downloadMediaMessage } from "@whiskeysockets/baileys";
import Groq from "groq-sdk";
import { toFile } from "groq-sdk";
import P from "pino";
import type { MessageContent } from "@ace/shared/types";

const logger = P({ level: "info" });

// Lazy-init: only create Groq client if GROQ_API_KEY is set.
// This way the gateway starts without the key — transcription silently degrades.
let groq: Groq | null = null;
function getGroq(): Groq | null {
  if (!process.env.GROQ_API_KEY) return null;
  if (!groq) groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  return groq;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Resolves the full, enriched MessageContent from a raw WAMessage.
 * Downloads media, transcribes audio, encodes images, reads reply context.
 * Returns null for message types we deliberately ignore (stickers, reactions, etc.)
 */
export async function resolveMessageContent(
  msg: WAMessage,
  sock: WASocket
): Promise<MessageContent | null> {
  const m = msg.message;
  if (!m) return null;

  // ── Text message ──────────────────────────────────────────────────────────
  if (m.conversation || m.extendedTextMessage) {
    const text = m.conversation || m.extendedTextMessage?.text || "";
    if (!text.trim()) return null;

    // Extract reply context if this message is a quote-reply
    const quotedText = extractQuotedText(m.extendedTextMessage?.contextInfo);

    return { type: "text", text, quotedText };
  }

  // ── Audio / voice note ────────────────────────────────────────────────────
  if (m.audioMessage) {
    const transcript = await downloadAndTranscribe(msg, sock);
    return {
      type: "audio",
      mediaId: msg.key.id!,
      transcript: transcript ?? undefined,
    };
  }

  // ── Image message ─────────────────────────────────────────────────────────
  if (m.imageMessage) {
    const caption = m.imageMessage.caption ?? undefined;
    const mimeType = m.imageMessage.mimetype ?? "image/jpeg";
    const base64 = await downloadAndEncode(msg, sock);
    return {
      type: "image",
      mediaId: msg.key.id!,
      caption,
      base64: base64 ?? undefined,
      mimeType,
    };
  }

  // ── Native WA Business order ──────────────────────────────────────────────
  if (m.orderMessage) {
    return { type: "interactive", payload: m.orderMessage };
  }

  // ── Unsupported types (stickers, reactions, location, polls, etc.) ─────────
  return null;
}

// ─── Audio transcription (Groq Whisper) ──────────────────────────────────────

/**
 * Downloads an audio message and transcribes it via Groq's Whisper endpoint.
 * Returns null if Groq key is missing, download fails, or transcription fails.
 */
export async function downloadAndTranscribe(
  msg: WAMessage,
  sock: WASocket
): Promise<string | null> {
  try {
    const buffer = await downloadBuffer(msg, sock);
    if (!buffer) return null;
    return await transcribeBuffer(buffer);
  } catch (err) {
    logger.warn({ err, msgId: msg.key.id }, "Audio transcription failed");
    return null;
  }
}

/**
 * Transcribes a raw audio buffer using Groq Whisper.
 * Exported so inventoryParser.ts can call it directly for vendor voice notes.
 */
export async function transcribeBuffer(buffer: Buffer): Promise<string | null> {
  const client = getGroq();
  if (!client) {
    logger.warn("GROQ_API_KEY not set — skipping transcription");
    return null;
  }

  try {
    // WhatsApp sends audio as OGG/Opus. Groq Whisper supports ogg natively.
    const file = await toFile(buffer, "audio.ogg", { type: "audio/ogg; codecs=opus" });

    const result = await client.audio.transcriptions.create({
      file,
      model: "whisper-large-v3-turbo", // Best free model: fastest Groq Whisper variant
      language: "en", // Bias toward English; handles Nigerian English + Pidgin well
      response_format: "text",
    });

    const text = typeof result === "string" ? result : (result as any).text ?? "";
    logger.info({ chars: text.length }, "Audio transcribed via Groq Whisper");
    return text.trim() || null;
  } catch (err: any) {
    logger.error({ err: err?.message, status: err?.status }, "Groq Whisper transcription error");
    return null;
  }
}

// ─── Image encoding ───────────────────────────────────────────────────────────

/**
 * Downloads an image and returns it as a base64 string for Claude Vision.
 * Returns null if download fails.
 */
export async function downloadAndEncode(
  msg: WAMessage,
  sock: WASocket
): Promise<string | null> {
  try {
    const buffer = await downloadBuffer(msg, sock);
    return buffer?.toString("base64") ?? null;
  } catch (err) {
    logger.warn({ err, msgId: msg.key.id }, "Image download/encode failed");
    return null;
  }
}

// ─── Shared download helper ───────────────────────────────────────────────────

async function downloadBuffer(msg: WAMessage, sock: WASocket): Promise<Buffer | null> {
  try {
    const buffer = await downloadMediaMessage(
      msg,
      "buffer",
      {},
      { logger: logger as any, reuploadRequest: sock.updateMediaMessage }
    );
    return buffer as Buffer;
  } catch (err) {
    logger.error({ err, msgId: msg.key.id }, "Media download failed");
    return null;
  }
}

// ─── Reply context helper ─────────────────────────────────────────────────────

/**
 * Extracts the text from a quoted (replied-to) message.
 * Handles the most common cases: plain text and extended text.
 */
function extractQuotedText(
  contextInfo?: { quotedMessage?: Record<string, unknown> } | null
): string | undefined {
  const quoted = contextInfo?.quotedMessage;
  if (!quoted) return undefined;

  // Plain text reply
  if (typeof (quoted as any).conversation === "string") {
    return (quoted as any).conversation;
  }
  // Extended text reply
  if (typeof (quoted as any).extendedTextMessage?.text === "string") {
    return (quoted as any).extendedTextMessage.text;
  }
  // Image caption reply
  if (typeof (quoted as any).imageMessage?.caption === "string") {
    return `[image]: ${(quoted as any).imageMessage.caption}`;
  }
  return undefined;
}
