// core/comms-router/src/whatsapp.ts
//
// PRODUCTION ADDITIONS IN THIS VERSION:
//
// 1) PER-MERCHANT ACCESS TOKENS. A single global WHATSAPP_ACCESS_TOKEN only
//    works for one WABA. Once ACE has more than one merchant, each has
//    their own Business Account and their own token — this must be looked
//    up per-send, not read once from env. Falls back to a shared env token
//    for local dev / merchants mid-onboarding.
//
// 2) THE 24-HOUR SESSION WINDOW. This is the single most important
//    WhatsApp Business Platform rule and the most common reason messages
//    silently fail to deliver: you can only send a free-form message
//    within 24h of the customer's last message. Outside that window, you
//    MUST send a pre-approved template message, or the send fails outright.
//    ingestion-service already writes `conv:{merchantId}:{phone}:window` on
//    every inbound message — this file reads it before every send and
//    swaps to a template automatically if the window has closed.
//
// 3) UPDATED GRAPH API VERSION (v22.0 — Meta deprecates old versions on a
//    rolling schedule; pin to a current one and revisit periodically).
//
// 4) DEAD-LETTER ON EXHAUSTED RETRIES. The original threw on final
//    failure, which is correct for surfacing the error — but in a queue
//    worker, an uncaught throw can crash the whole worker process and take
//    down every OTHER customer's in-flight message with it. We still
//    throw (callers should decide how to handle it) but first persist the
//    failed send so it's recoverable/replayable instead of just lost.
//
// 5) MEDIA MESSAGE SUPPORT. Real commerce conversations involve sending
//    product photos, not just text.

import { redis, sql } from "@ace/shared/clients";
import { loadCommsEnv } from "@ace/shared/env";
import type { OutboundMessage } from "@ace/shared/types";

const env = loadCommsEnv();
const GRAPH_API_VERSION = env.GRAPH_API_VERSION;

export enum EscalationPriority {
  Critical = "critical", // order value > ₦50k -> consider voice call (Phase 2+)
  High = "high", // ₦20k-50k -> standard send, but track delivery receipt closely
  Medium = "medium", // ₦5k-20k
  Low = "low", // cart reminders etc.
}

// ─── Per-merchant token resolution ──────────────────────────────────────────
// Cached briefly to avoid a DB round trip on every send; short TTL because a
// merchant re-authenticating their WABA should propagate reasonably fast.
const tokenCache = new Map<string, { token: string; expiresAt: number }>();
const TOKEN_CACHE_TTL_MS = 60 * 1000;

async function resolveAccessToken(merchantId: string): Promise<string> {
  const cached = tokenCache.get(merchantId);
  if (cached && cached.expiresAt > Date.now()) return cached.token;

  let token: string | undefined = undefined;
  try {
    const rows = await sql<{ access_token: string | null }[]>`
      select access_token from merchant_whatsapp_credentials
      where merchant_id = ${merchantId}
      limit 1
    `;
    token = rows[0]?.access_token ?? undefined;
  } catch {
    // Ignore if table doesn't exist yet
  }

  token = token ?? env.WHATSAPP_ACCESS_TOKEN_FALLBACK ?? process.env.WHATSAPP_TOKEN;

  if (!token) {
    throw new Error(`no WhatsApp access token available for merchant ${merchantId}`);
  }

  tokenCache.set(merchantId, { token, expiresAt: Date.now() + TOKEN_CACHE_TTL_MS });
  return token;
}

// ─── 24h session window ─────────────────────────────────────────────────────

async function isWithinSessionWindow(merchantId: string, customerPhone: string): Promise<boolean> {
  const windowKey = `conv:${merchantId}:${customerPhone}:window`;
  const expiresAtRaw = await redis.get(windowKey);
  if (!expiresAtRaw) return false; // no record — treat as expired/never-opened, safest default
  return Number(expiresAtRaw) > Date.now();
}

// ─── Public API ──────────────────────────────────────────────────────────────

export async function sendWhatsAppMessage(
  msg: OutboundMessage,
  phoneNumberId: string,
  merchantId: string,
): Promise<void> {
  const accessToken = await resolveAccessToken(merchantId);
  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`;

  const withinWindow = await isWithinSessionWindow(merchantId, msg.toPhone ?? "");

  let body: unknown;
  if (!withinWindow) {
    if (!msg.templateName) {
      // Outside the free-form window with no template configured for this
      // situation — this WILL be rejected by Meta if sent as free text.
      // Fail loud here rather than let Meta's 4xx surprise you downstream.
      throw new Error(
        `session window closed for ${msg.toPhone} (merchant ${merchantId}) and no templateName provided — ` +
        `send a pre-approved template instead of free text`,
      );
    }
    body = buildTemplateBody(msg);
  } else if (msg.mediaUrl) {
    body = buildMediaBody(msg);
  } else if (msg.buttons?.length) {
    body = buildInteractiveBody(msg);
  } else {
    body = {
      messaging_product: "whatsapp",
      to: msg.toPhone,
      type: "text",
      text: { body: msg.text },
    };
  }

  try {
    await sendWithRetry(url, body, accessToken);
  } catch (err) {
    await deadLetter(merchantId, msg, phoneNumberId, err as Error);
    throw err;
  }
}

function buildTemplateBody(msg: OutboundMessage) {
  return {
    messaging_product: "whatsapp",
    to: msg.toPhone,
    type: "template",
    template: {
      name: msg.templateName,
      language: { code: msg.templateLanguage ?? "en" },
      components: msg.templateParams
        ? [{ type: "body", parameters: msg.templateParams.map((p: string) => ({ type: "text", text: p })) }]
        : [],
    },
  };
}

function buildMediaBody(msg: OutboundMessage) {
  return {
    messaging_product: "whatsapp",
    to: msg.toPhone,
    type: "image",
    image: { link: msg.mediaUrl, caption: msg.text },
  };
}

function buildInteractiveBody(msg: OutboundMessage) {
  return {
    messaging_product: "whatsapp",
    to: msg.toPhone,
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: msg.text },
      action: {
        buttons: msg.buttons!.slice(0, 3).map((b: { id: string; label: string }) => ({
          // WhatsApp caps button labels at 20 chars and allows max 3 buttons.
          type: "reply",
          reply: { id: b.id, title: b.label.slice(0, 20) },
        })),
      },
    },
  };
}

const MAX_RETRIES = 3;

async function sendWithRetry(
  url: string,
  body: unknown,
  accessToken: string,
  attempt = 1,
): Promise<void> {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (res.ok) return;

  const isRetryable = res.status === 429 || res.status >= 500;
  if (isRetryable && attempt < MAX_RETRIES) {
    const backoffMs = 500 * 2 ** (attempt - 1) + Math.random() * 250;
    await new Promise((r) => setTimeout(r, backoffMs));
    return sendWithRetry(url, body, accessToken, attempt + 1);
  }

  const errorBody = await res.text();
  throw new Error(
    `WhatsApp send failed (status ${res.status}, attempt ${attempt}): ${errorBody}`,
  );
}

// ─── Dead-letter on exhausted retries ───────────────────────────────────────
// A message that fails all retries is not gone — it's recoverable. Persist
// it so a replay job (or a human) can retry it later instead of it just
// vanishing from a worker's stack trace into the void.
async function deadLetter(
  merchantId: string,
  msg: OutboundMessage,
  phoneNumberId: string,
  error: Error,
): Promise<void> {
  try {
    await sql`
      insert into outbound_dead_letters (merchant_id, phone_number_id, payload, error, created_at)
      values (${merchantId}, ${phoneNumberId}, ${JSON.stringify(msg)}, ${error.message}, now())
    `;
  } catch (dlqErr) {
    // If even the dead-letter write fails, at minimum this must hit logs/alerts.
    console.error(`[whatsapp] CRITICAL: failed to dead-letter a failed send for merchant ${merchantId}:`, dlqErr);
  }
}