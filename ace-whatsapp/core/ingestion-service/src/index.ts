// core/ingestion-service/src/index.ts
//
// This service has exactly ONE job: be the front door from Meta, and be
// FAST and BORING about it.
//
// PRODUCTION ADDITIONS IN THIS VERSION (vs. the single-merchant draft):
//
// 1) MULTI-TENANCY. A real ACE deployment serves many merchants, each with
//    their own WhatsApp Business number (their own phone_number_id). Meta
//    sends ALL of them to the SAME webhook URL — there's only one webhook
//    per app, not one per merchant. So the first real job after parsing a
//    message is "whose message is this?" — we resolve phone_number_id ->
//    merchantId via a cached DB lookup and attach it before enqueueing.
//    Skipping this means agentLoop has no idea which merchant's pricing
//    rules / catalog / tone to use.
//
// 2) FAIL-CLOSED ENV VALIDATION. Import from shared/env — crash on boot if
//    misconfigured, not on the first webhook.
//
// 3) HEALTH CHECK. Any real deployment (k8s, Fly, Render, ECS) needs a
//    liveness/readiness endpoint to know when to route traffic to this
//    instance and when to restart it.
//
// 4) GRACEFUL SHUTDOWN. On SIGTERM (every container platform sends this
//    before killing a pod), stop accepting new connections, let in-flight
//    requests finish, close the Redis/DB connections cleanly. Without
//    this, deploys can silently drop a webhook mid-flight.
//
// 5) NO OPEN CORS. This endpoint is only ever called server-to-server by
//    Meta — no browser ever hits it. `cors: { origin: "*" }` on a webhook
//    is meaningless for security (Meta doesn't send an Origin header you
//    care about) but it's also dead weight and can mask misconfiguration
//    elsewhere. Removed.
//
// 6) DEFENSIVE JSON PARSING + PER-MESSAGE ERROR ISOLATION. One malformed
//    message in a batch of 5 must not take down the other 4.

import Fastify from "fastify";
import rawBody from "fastify-raw-body";
import crypto from "node:crypto";
import { redis, sql } from "@ace/shared/clients";
import { loadIngestionEnv } from "@ace/shared/env";
import type { InboundMessage } from "@ace/shared/types";
import { enqueueInboundMessage } from "../../comms-router/src/debounce";

const env = loadIngestionEnv();
const app = Fastify({
  logger: {
    level: env.NODE_ENV === "production" ? "info" : "debug",
    redact: ["req.headers.authorization", "req.headers['x-hub-signature-256']"],
  },
});

// Raw bytes are required for HMAC verification — a re-serialized JSON body
// would not match what Meta signed. Registered per-route via `config: { rawBody: true }`.
await app.register(rawBody, { global: false, runFirst: true });

// ─── Merchant resolution cache ─────────────────────────────────────────────
// phone_number_id -> merchantId rarely changes (only on merchant onboarding
// or number rotation), so a short-TTL in-memory cache avoids a DB round trip
// on every single inbound message without risking long-lived staleness.
const merchantCache = new Map<string, { merchantId: string; expiresAt: number }>();
const MERCHANT_CACHE_TTL_MS = 5 * 60 * 1000;

async function resolveMerchantId(phoneNumberId: string): Promise<string | null> {
  const cached = merchantCache.get(phoneNumberId);
  if (cached && cached.expiresAt > Date.now()) return cached.merchantId;

  const rows = await sql<{ merchant_id: string }[]>`
    select merchant_id from merchant_whatsapp_numbers
    where phone_number_id = ${phoneNumberId}
    limit 1
  `;
  const merchantId = rows[0]?.merchant_id ?? null;
  if (merchantId) {
    merchantCache.set(phoneNumberId, {
      merchantId,
      expiresAt: Date.now() + MERCHANT_CACHE_TTL_MS,
    });
  }
  return merchantId;
}

// ─── Health check ───────────────────────────────────────────────────────────
app.get("/health", async (_req, reply) => {
  try {
    await redis.ping();
    return reply.code(200).send({ status: "ok" });
  } catch (err) {
    app.log.error(err, "health check failed: redis unreachable");
    return reply.code(503).send({ status: "degraded" });
  }
});

// ─── 1. Webhook verification handshake (Meta calls this once on setup) ────
app.get("/webhook", async (req, reply) => {
  const query = req.query as Record<string, string>;
  if (
    query["hub.mode"] === "subscribe" &&
    query["hub.verify_token"] === env.WHATSAPP_VERIFY_TOKEN
  ) {
    return reply.send(query["hub.challenge"]);
  }
  return reply.code(403).send();
});

// ─── 2. Actual message webhook ─────────────────────────────────────────────
app.post(
  "/webhook",
  { config: { rawBody: true } },
  async (req, reply) => {
    const signatureHeader = req.headers["x-hub-signature-256"] as string | undefined;

    if (!verifySignature(req.rawBody as Buffer, signatureHeader, env.WHATSAPP_APP_SECRET)) {
      return reply.code(401).send();
    }

    let body: unknown;
    try {
      body = JSON.parse((req.rawBody as Buffer).toString("utf-8"));
    } catch (err) {
      app.log.warn(err, "failed to parse webhook body — acking anyway, Meta will not retry a 400 usefully");
      return reply.code(200).send(); // ack; a malformed body from Meta itself is not our bug to retry into
    }

    const messages = extractMessages(body);

    // Ack Meta immediately — everything below this point must be fast and
    // must not be able to make Meta wait, even if a merchant lookup or
    // Redis call is slow.
    reply.code(200).send();

    for (const msg of messages) {
      try {
        await processMessage(msg);
      } catch (err) {
        // One bad message must not take down the batch. Log with enough
        // context to replay/debug, then move on.
        app.log.error({ err, waMessageId: msg.waMessageId }, "failed to process inbound message");
      }
    }
  },
);

async function processMessage(msg: InboundMessage): Promise<void> {
  const dedupeKey = `idempotency:wa_msg:${msg.waMessageId}`;
  const isNew = await redis.set(dedupeKey, "1", "EX", 60 * 60 * 24, "NX");
  if (!isNew) {
    app.log.info({ waMessageId: msg.waMessageId }, "duplicate message, skipping");
    return;
  }

  const merchantId = await resolveMerchantId(msg.toPhoneNumberId);
  if (!merchantId) {
    // A message arrived for a phone_number_id we don't recognize — either a
    // merchant mid-offboarding, a stale webhook subscription, or a config
    // bug. Don't silently drop it: log loud enough to alert on.
    app.log.error({ phoneNumberId: msg.toPhoneNumberId }, "no merchant mapped to this phone_number_id");
    return;
  }

  // Refresh the 24h WhatsApp free-reply service window for this customer.
  // comms-router reads this before sending to decide free-form vs. template.
  const windowKey = `conv:${merchantId}:${msg.fromPhone}:window`;
  const windowExpiresAt = msg.timestamp + 24 * 60 * 60 * 1000;
  await redis.set(windowKey, String(windowExpiresAt), "EX", 60 * 60 * 25);

  await enqueueInboundMessage({ ...msg, merchantId });
}

function verifySignature(
  rawBody: Buffer,
  signatureHeader: string | undefined,
  appSecret: string,
): boolean {
  if (!signatureHeader) return false;
  const expected =
    "sha256=" + crypto.createHmac("sha256", appSecret).update(rawBody).digest("hex");

  const expectedBuf = Buffer.from(expected);
  const actualBuf = Buffer.from(signatureHeader);
  if (expectedBuf.length !== actualBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, actualBuf);
}

function extractMessages(body: unknown): InboundMessage[] {
  const out: InboundMessage[] = [];
  const entries = (body as any)?.entry ?? [];

  for (const entry of entries) {
    for (const change of entry.changes ?? []) {
      const value = change.value;
      const phoneNumberId = value?.metadata?.phone_number_id;

      for (const m of value?.messages ?? []) {
        const base = {
          waMessageId: m.id,
          fromPhone: m.from,
          toPhoneNumberId: phoneNumberId,
          timestamp: Number(m.timestamp) * 1000,
        };

        if (m.type === "text") {
          out.push({ ...base, content: { type: "text", text: m.text.body } });
        } else if (m.type === "audio") {
          out.push({ ...base, content: { type: "audio", mediaId: m.audio.id } });
        } else if (m.type === "image") {
          out.push({
            ...base,
            content: { type: "image", mediaId: m.image.id, caption: m.image.caption },
          });
        } else if (m.type === "interactive") {
          out.push({ ...base, content: { type: "interactive", payload: m.interactive } });
        }
        // Other types (location, contacts, reactions) — extend as needed.
        // Deliberately not throwing on unknown types.
      }
    }
  }
  return out;
}

// ─── Boot + graceful shutdown ───────────────────────────────────────────────
app.listen({ port: env.PORT, host: "0.0.0.0" }).then(() => {
  app.log.info(`ingestion-service listening on :${env.PORT}`);
});

async function shutdown(signal: string) {
  app.log.info(`received ${signal}, shutting down gracefully`);
  await app.close(); // stops accepting new connections, drains in-flight requests
  await redis.quit();
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));