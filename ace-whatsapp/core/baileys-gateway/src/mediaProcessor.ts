// core/baileys-gateway/src/mediaProcessor.ts
//
// Resolves media and interactive payloads from raw Baileys WAMessage objects BEFORE
// they are enqueued into the BullMQ debounce queue.
//
// HANDLED MESSAGE TYPES:
// - Text and extended text (with quote reply context extraction)
// - Voice notes and audio (OGG/Opus, M4A, AAC, MP3, AMR) transcribed via Groq Whisper
// - Images (JPEG, PNG, WEBP) encoded to base64 for vision models
// - Interactive messages: Quick Reply buttons, Template buttons, List selections, Native Flows
// - Documents (PDF, DOCX, etc.) with timeout-protected buffer downloads & metadata
// - Location pins (coordinates, place name, address, URL)
// - Contact vCards (display name, phone number)
// - Unwrapping of ephemeralMessage, viewOnceMessage, viewOnceMessageV2, documentWithCaptionMessage
//
// GRACEFUL DEGRADATION:
// Media downloads are wrapped in timeout-protected promises (15s ceiling).
// Missing or failed transcriptions return graceful fallback representations
// rather than crashing or stalling the ingestion pipeline.

import type { WAMessage, WASocket } from "@whiskeysockets/baileys";
import { downloadMediaMessage } from "@whiskeysockets/baileys";
import Groq from "groq-sdk";
import { toFile } from "groq-sdk";
import P from "pino";
import type { MessageContent } from "@ace/shared/types";

const logger = P({ level: "info" });

let groq: Groq | null = null;
function getGroq(): Groq | null {
  if (!process.env.GROQ_API_KEY) return null;
  if (!groq) groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  return groq;
}

// ─── Concurrency Semaphore for Media Downloads ─────────────────────────────
class Semaphore {
  private active = 0;
  private queue: (() => void)[] = [];

  constructor(private max: number) {}

  async acquire(): Promise<() => void> {
    if (this.active < this.max) {
      this.active++;
      return () => this.release();
    }
    return new Promise<() => void>((resolve) => {
      this.queue.push(() => {
        this.active++;
        resolve(() => this.release());
      });
    });
  }

  private release(): void {
    this.active--;
    if (this.queue.length > 0) {
      const next = this.queue.shift();
      if (next) next();
    }
  }
}

const mediaDownloadSemaphore = new Semaphore(5); // Maximum 5 concurrent media downloads

// ─── Promise Timeout Helper ──────────────────────────────────────────────────
async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, operation: string): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${operation} timed out after ${timeoutMs}ms`)), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timer!);
  }
}

// ─── Image Validation Helper ─────────────────────────────────────────────────
export function isValidImageBuffer(buf: Buffer): boolean {
  if (!buf || buf.length < 4) return false;
  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return true;
  // PNG: 89 50 4E 47
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return true;
  // WEBP: RIFF....WEBP
  if (buf.length >= 12 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return true;
  // GIF: GIF87a / GIF89a
  if (buf.toString("ascii", 0, 3) === "GIF") return true;
  return false;
}

// ─── Message Unwrapper ────────────────────────────────────────────────────────
/**
 * Unwraps view-once, ephemeral, and wrapped document messages to their core payload.
 */
export function unwrapWAMessage(m?: any): any {
  if (!m) return m;
  return (
    m.ephemeralMessage?.message ||
    m.viewOnceMessage?.message ||
    m.viewOnceMessageV2?.message ||
    m.viewOnceMessageV2Extension?.message ||
    m.documentWithCaptionMessage?.message ||
    m
  );
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Resolves the full, enriched MessageContent from a raw WAMessage.
 * Downloads media, transcribes audio, encodes images, resolves interactive selections,
 * parses location pins and vCards, and reads reply context.
 */
export async function resolveMessageContent(
  msg: WAMessage,
  sock: WASocket
): Promise<MessageContent | null> {
  const rawMsg = msg.message;
  if (!rawMsg) return null;

  const m = unwrapWAMessage(rawMsg);
  if (!m) return null;

  // ── 1. Text message ──────────────────────────────────────────────────────────
  if (m.conversation || m.extendedTextMessage) {
    const text = (m.conversation || m.extendedTextMessage?.text || "").trim();
    if (!text) return null;

    const quotedText = extractQuotedText(m.extendedTextMessage?.contextInfo);
    return { type: "text", text, quotedText };
  }

  // ── 2. Interactive Button Replies (Quick Reply Buttons) ────────────────────
  if (m.buttonsResponseMessage) {
    const buttonId = m.buttonsResponseMessage.selectedButtonId || "";
    const displayText = m.buttonsResponseMessage.selectedDisplayText || buttonId;
    return {
      type: "interactive",
      payload: {
        type: "button_reply",
        id: buttonId,
        text: displayText,
        displayText,
      },
    };
  }

  // ── 3. Template Button Replies ─────────────────────────────────────────────
  if (m.templateButtonReplyMessage) {
    const buttonId = m.templateButtonReplyMessage.selectedId || "";
    const displayText = m.templateButtonReplyMessage.selectedDisplayText || buttonId;
    return {
      type: "interactive",
      payload: {
        type: "template_button_reply",
        id: buttonId,
        text: displayText,
        displayText,
      },
    };
  }

  // ── 4. List Selections (Single-select Menu) ────────────────────────────────
  if (m.listResponseMessage) {
    const rowId = m.listResponseMessage.singleSelectReply?.selectedRowId || "";
    const title = m.listResponseMessage.title || rowId;
    const description = m.listResponseMessage.description;
    return {
      type: "interactive",
      payload: {
        type: "list_reply",
        id: rowId,
        title,
        text: title,
        description,
      },
    };
  }

  // ── 5. Native Flow Interactive Response ────────────────────────────────────
  if (m.interactiveResponseMessage) {
    const nativeFlow = m.interactiveResponseMessage.nativeFlowResponseMessage;
    const bodyText = m.interactiveResponseMessage.body?.text || "";
    let parsedParams: any = undefined;
    if (nativeFlow?.paramsJson) {
      try {
        parsedParams = JSON.parse(nativeFlow.paramsJson);
      } catch {}
    }
    return {
      type: "interactive",
      payload: {
        type: "interactive_response",
        name: nativeFlow?.name,
        params: parsedParams,
        text: bodyText || nativeFlow?.name || "Interactive response",
      },
    };
  }

  // ── 6. Native WA Business Order ────────────────────────────────────────────
  if (m.orderMessage) {
    return { type: "interactive", payload: m.orderMessage };
  }

  // ── 7. Audio / Voice Note ──────────────────────────────────────────────────
  if (m.audioMessage) {
    const transcript = await downloadAndTranscribe(msg, sock);
    return {
      type: "audio",
      mediaId: msg.key.id!,
      transcript: transcript ?? undefined,
    };
  }

  // ── 8. Image Message ───────────────────────────────────────────────────────
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

  // ── 9. Document Message (PDF, DOCX, receipts, invoices) ────────────────────
  if (m.documentMessage) {
    const filename = m.documentMessage.fileName ?? undefined;
    const mimeType = m.documentMessage.mimetype ?? "application/octet-stream";
    const caption = m.documentMessage.caption ?? undefined;
    const buffer = await downloadBuffer(msg, sock, 15_000);
    // Include base64 if under 2MB for immediate document ingestion
    const base64 = buffer && buffer.length <= 2 * 1024 * 1024 ? buffer.toString("base64") : undefined;

    return {
      type: "document",
      mediaId: msg.key.id!,
      filename,
      caption,
      mimeType,
      base64,
    };
  }

  // ── 10. Location Message (Delivery pin, address pickup) ─────────────────────
  if (m.locationMessage || m.liveLocationMessage) {
    const loc = m.locationMessage || m.liveLocationMessage;
    return {
      type: "location",
      latitude: loc.degreesLatitude ?? 0,
      longitude: loc.degreesLongitude ?? 0,
      name: loc.name ?? undefined,
      address: loc.address ?? undefined,
      url: loc.url ?? undefined,
    };
  }

  // ── 11. Contact Message (vCard) ───────────────────────────────────────────
  if (m.contactMessage) {
    const vcard = m.contactMessage.vcard ?? "";
    const phone = extractPhoneFromVCard(vcard);
    return {
      type: "contact",
      contacts: [
        {
          displayName: m.contactMessage.displayName ?? "Contact",
          vcard,
          phone,
        },
      ],
    };
  }

  if (m.contactsArrayMessage?.contacts) {
    const contacts = m.contactsArrayMessage.contacts.map((c: any) => ({
      displayName: c.displayName ?? "Contact",
      vcard: c.vcard ?? "",
      phone: extractPhoneFromVCard(c.vcard),
    }));
    return {
      type: "contact",
      contacts,
    };
  }

  // Unsupported or ignored message types (stickers, protocolMessage, reactions, etc.)
  return null;
}

// ─── Audio Transcription (Groq Whisper) ──────────────────────────────────────

/**
 * Downloads an audio message and transcribes it via Groq Whisper.
 * Returns null if Groq key is missing, download fails/times out, or transcription fails.
 */
export async function downloadAndTranscribe(
  msg: WAMessage,
  sock: WASocket
): Promise<string | null> {
  try {
    const buffer = await downloadBuffer(msg, sock, 15_000);
    if (!buffer) return null;
    const mimetype = unwrapWAMessage(msg.message)?.audioMessage?.mimetype;
    return await transcribeBuffer(buffer, mimetype);
  } catch (err) {
    logger.warn({ err, msgId: msg.key.id }, "Audio transcription failed");
    return null;
  }
}

/**
 * Transcribes a raw audio buffer using Groq Whisper.
 * Handles diverse MIME types (OGG/Opus, M4A, AAC, MP3, AMR, WAV, WebM).
 * Enforces a 25MB ceiling and a 20s transcription timeout.
 */
export async function transcribeBuffer(buffer: Buffer, mimetype?: string): Promise<string | null> {
  const client = getGroq();
  if (!client) {
    logger.warn("GROQ_API_KEY not set — skipping transcription");
    return null;
  }

  if (!buffer || buffer.length === 0) {
    logger.warn("Empty audio buffer provided to transcribeBuffer");
    return null;
  }

  // Enforce Groq Whisper 25MB file limit
  if (buffer.length > 25 * 1024 * 1024) {
    logger.warn({ sizeBytes: buffer.length }, "Audio buffer exceeds 25MB Groq Whisper limit — skipping");
    return null;
  }

  try {
    let filename = "audio.ogg";
    let contentType = "audio/ogg; codecs=opus";

    if (mimetype) {
      const lower = mimetype.toLowerCase();
      if (lower.includes("mp4") || lower.includes("m4a")) {
        filename = "audio.m4a";
        contentType = "audio/mp4";
      } else if (lower.includes("aac")) {
        filename = "audio.aac";
        contentType = "audio/aac";
      } else if (lower.includes("mpeg") || lower.includes("mp3")) {
        filename = "audio.mp3";
        contentType = "audio/mpeg";
      } else if (lower.includes("amr")) {
        filename = "audio.amr";
        contentType = "audio/amr";
      } else if (lower.includes("wav")) {
        filename = "audio.wav";
        contentType = "audio/wav";
      } else if (lower.includes("webm")) {
        filename = "audio.webm";
        contentType = "audio/webm";
      } else if (lower.includes("opus") || lower.includes("ogg")) {
        filename = "audio.ogg";
        contentType = "audio/ogg; codecs=opus";
      }
    }

    const file = await toFile(buffer, filename, { type: contentType });

    // Protect transcription with a 20-second timeout to avoid pipeline starvation
    const transcriptionPromise = client.audio.transcriptions.create({
      file,
      model: "whisper-large-v3-turbo",
      language: "en",
      response_format: "text",
    });

    const result = await withTimeout(transcriptionPromise, 20_000, "Groq Whisper transcription");

    const text = typeof result === "string" ? result : (result as any).text ?? "";
    logger.info({ chars: text.length, filename }, "Audio transcribed via Groq Whisper");
    return text.trim() || null;
  } catch (err: any) {
    logger.error({ err: err?.message, status: err?.status }, "Groq Whisper transcription error");
    return null;
  }
}

// ─── Image Encoding ───────────────────────────────────────────────────────────

/**
 * Downloads an image and returns it as base64 string for vision models.
 * Protected by a 15-second download timeout and image validation.
 */
export async function downloadAndEncode(
  msg: WAMessage,
  sock: WASocket
): Promise<string | null> {
  try {
    const buffer = await downloadBuffer(msg, sock, 15_000);
    if (!buffer || !isValidImageBuffer(buffer)) {
      if (buffer) logger.warn({ msgId: msg.key.id }, "Downloaded image buffer failed magic-byte validation");
      return null;
    }
    return buffer.toString("base64");
  } catch (err) {
    logger.warn({ err, msgId: msg.key.id }, "Image download/encode failed");
    return null;
  }
}

// ─── Shared Media Download Helper ─────────────────────────────────────────────

export async function downloadBuffer(
  msg: WAMessage,
  sock?: WASocket,
  timeoutMs = 15_000
): Promise<Buffer | null> {
  const release = await mediaDownloadSemaphore.acquire();
  try {
    const opts: any = { logger: logger as any };
    if (sock?.updateMediaMessage) {
      opts.reuploadRequest = sock.updateMediaMessage.bind(sock);
    }

    // Retry once with 1000ms delay on transient download failure or rate limits
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const downloadPromise = downloadMediaMessage(
          msg,
          "buffer",
          {},
          opts
        );
        const buffer = await withTimeout(downloadPromise, timeoutMs, `Media download (${msg.key.id})`);
        if (buffer && (buffer as Buffer).length > 0) {
          return buffer as Buffer;
        }
      } catch (err: any) {
        if (attempt === 1) {
          logger.warn({ err: err?.message, msgId: msg.key.id }, "Media download attempt 1 failed, retrying in 1s...");
          await new Promise((r) => setTimeout(r, 1000));
        } else {
          logger.error({ err: err?.message, msgId: msg.key.id }, "Media download failed after 2 attempts or timed out");
        }
      }
    }
    return null;
  } finally {
    release();
  }
}

// ─── Helper Functions ─────────────────────────────────────────────────────────

function extractQuotedText(contextInfo?: any): string | undefined {
  const quoted = contextInfo?.quotedMessage;
  if (!quoted) return undefined;

  const inner = unwrapWAMessage(quoted);
  if (!inner) return undefined;

  if (typeof inner.conversation === "string") return inner.conversation;
  if (typeof inner.extendedTextMessage?.text === "string") return inner.extendedTextMessage.text;
  if (typeof inner.imageMessage?.caption === "string") return `[image]: ${inner.imageMessage.caption}`;
  if (typeof inner.documentMessage?.caption === "string") return `[document]: ${inner.documentMessage.caption}`;
  if (typeof inner.buttonsResponseMessage?.selectedDisplayText === "string") {
    return `[button]: ${inner.buttonsResponseMessage.selectedDisplayText}`;
  }
  return undefined;
}

function extractPhoneFromVCard(vcard?: string): string | undefined {
  if (!vcard) return undefined;
  const match = vcard.match(/TEL(?:;[^:]+)?:([+\d\s\-()]+)/i);
  return match ? match[1].replace(/[\s\-()]/g, "") : undefined;
}
