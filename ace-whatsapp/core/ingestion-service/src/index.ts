// core/ingestion-service/src/index.ts
//
// This service has exactly ONE job: be the front door from Meta, and be
// FAST and BORING about it.
//
// PRODUCTION ADDITIONS IN THIS VERSION:
//
// 1) MULTI-TENANCY: Resolves phone_number_id -> merchantId via a cached DB lookup.
// 2) FAIL-CLOSED ENV VALIDATION: Crash on boot if misconfigured.
// 3) HEALTH CHECK: Liveness/readiness endpoint.
// 4) GRACEFUL SHUTDOWN: Drains requests and workers on SIGTERM.
// 5) RAW BODY HMAC VERIFICATION: Verifies x-hub-signature-256 with timing-safe comparison.
// 6) DURABLE QUEUE & IDEMPOTENT DEDUPLICATION:
//    - Pushes incoming messages into BullMQ with deterministic jobId (wa_inbound_<waMessageId>)
//      to prevent duplicate deliveries when Meta retries on network blips.
//    - Comprehensive payload parsing: text, audio, image, button, interactive (lists/buttons),
//      document, location, contacts.

import Fastify from "fastify";
import rawBody from "fastify-raw-body";
import crypto from "node:crypto";
import { Queue, Worker } from "bullmq";
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

// ── Inbound Webhook Durable Queue ─────────────────────────────────────
// Instead of processing in-memory (which risks data loss if the DB is
// cold/sleeping or the pod crashes), we push raw webhooks into BullMQ.
const webhookQueue = new Queue("inbound-webhooks", {
  connection: { ...redis.options, maxRetriesPerRequest: null },
});

const webhookWorker = new Worker(
  "inbound-webhooks",
  async (job) => {
    await processMessage(job.data as InboundMessage);
  },
  {
    connection: { ...redis.options, maxRetriesPerRequest: null },
    concurrency: 5,
  }
);

webhookWorker.on("error", (err) => app.log.error(err, "Webhook worker Redis error"));
webhookWorker.on("failed", (job, err) =>
  app.log.error({ jobId: job?.id, err }, "Webhook processing failed, will retry")
);

// ─── Merchant resolution cache ─────────────────────────────────────────────
const merchantCache = new Map<string, { merchantId: string; expiresAt: number }>();
const MERCHANT_CACHE_TTL_MS = 5 * 60 * 1000;

function purgeExpiredMerchantCache(): void {
  const now = Date.now();
  for (const [key, item] of merchantCache.entries()) {
    if (now > item.expiresAt) {
      merchantCache.delete(key);
    }
  }
}

setInterval(purgeExpiredMerchantCache, 60_000).unref();

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

    if (!req.rawBody || !verifySignature(req.rawBody as Buffer, signatureHeader, env.WHATSAPP_APP_SECRET)) {
      return reply.code(401).send();
    }

    let body: unknown;
    try {
      body = JSON.parse((req.rawBody as Buffer).toString("utf-8"));
    } catch (err) {
      app.log.warn(err, "failed to parse webhook body — acking anyway, Meta will not retry a 400 usefully");
      return reply.code(200).send();
    }

    const messages = extractMessages(body);

    // Ack Meta immediately — everything below this point must be fast and
    // must not be able to make Meta wait.
    reply.code(200).send();

    // Push raw payloads to durable queue immediately.
    // Set jobId to waMessageId so BullMQ natively deduplicates duplicate webhook deliveries.
    for (const msg of messages) {
      webhookQueue
        .add("process-webhook", msg, {
          jobId: `wa_inbound_${msg.waMessageId}`,
          attempts: 5,
          backoff: { type: "exponential", delay: 2000 },
          removeOnComplete: true,
        })
        .catch((err) => {
          app.log.error({ err, msg }, "CRITICAL: failed to enqueue inbound message");
        });
    }

    return reply;
  }
);

async function processMessage(msg: InboundMessage): Promise<void> {
  const dedupeKey = `idempotency:wa_msg:${msg.waMessageId}`;
  const isNew = await redis.set(dedupeKey, "1", "EX", 60 * 60 * 24, "NX");
  if (!isNew) {
    app.log.info({ waMessageId: msg.waMessageId }, "duplicate message, skipping");
    return;
  }

  try {
    const merchantId = await resolveMerchantId(msg.toPhoneNumberId);
    if (!merchantId) {
      app.log.error({ phoneNumberId: msg.toPhoneNumberId }, "no merchant mapped to this phone_number_id");
      return;
    }

    // Refresh the 24h WhatsApp free-reply service window for this customer.
    const windowKey = `conv:${merchantId}:${msg.fromPhone}:window`;
    const windowExpiresAt = msg.timestamp + 24 * 60 * 60 * 1000;
    await redis.set(windowKey, String(windowExpiresAt), "EX", 60 * 60 * 25);

    await enqueueInboundMessage({ ...msg, merchantId });
  } catch (err) {
    // If downstream enqueuing fails, delete the idempotency key so BullMQ retry attempts can succeed!
    await redis.del(dedupeKey).catch(() => {});
    throw err;
  }
}

function verifySignature(
  rawBody: Buffer,
  signatureHeader: string | undefined,
  appSecret: string
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
          out.push({ ...base, content: { type: "text", text: m.text?.body || "" } });
        } else if (m.type === "audio") {
          out.push({ ...base, content: { type: "audio", mediaId: m.audio?.id } });
        } else if (m.type === "image") {
          out.push({
            ...base,
            content: { type: "image", mediaId: m.image?.id, caption: m.image?.caption },
          });
        } else if (m.type === "interactive") {
          let payload = m.interactive;
          if (m.interactive?.type === "button_reply") {
            payload = {
              type: "button_reply",
              id: m.interactive.button_reply?.id,
              text: m.interactive.button_reply?.title,
              title: m.interactive.button_reply?.title,
            };
          } else if (m.interactive?.type === "list_reply") {
            payload = {
              type: "list_reply",
              id: m.interactive.list_reply?.id,
              title: m.interactive.list_reply?.title,
              text: m.interactive.list_reply?.title,
              description: m.interactive.list_reply?.description,
            };
          }
          out.push({ ...base, content: { type: "interactive", payload } });
        } else if (m.type === "button") {
          out.push({
            ...base,
            content: {
              type: "interactive",
              payload: {
                type: "button_reply",
                id: m.button?.payload,
                text: m.button?.text,
              },
            },
          });
        } else if (m.type === "document") {
          out.push({
            ...base,
            content: {
              type: "document",
              mediaId: m.document?.id,
              filename: m.document?.filename,
              caption: m.document?.caption,
              mimeType: m.document?.mime_type,
            },
          });
        } else if (m.type === "location") {
          out.push({
            ...base,
            content: {
              type: "location",
              latitude: m.location?.latitude ?? 0,
              longitude: m.location?.longitude ?? 0,
              name: m.location?.name,
              address: m.location?.address,
              url: m.location?.url,
            },
          });
        } else if (m.type === "contacts") {
          const contacts = (m.contacts || []).map((c: any) => ({
            displayName: c.name?.formatted_name || c.name?.first_name || "Contact",
            phone: c.phones?.[0]?.phone,
          }));
          out.push({
            ...base,
            content: {
              type: "contact",
              contacts,
            },
          });
        }
      }
    }
  }
  return out;
}

// ─── Vendor SMS Webhook (Communiqué Engine) ──────────────────────────────────
import { vendorCommunique } from "../../comms-router/src/vendorCommunique.js";

app.post("/sms/webhook", async (req, reply) => {
  const b = req.body as { from: string; text: string };
  if (!b.from || !b.text) return reply.send({ ok: false });

  const rows = await sql<{ id: string }[]>`
    select id from merchants where phone_number_id = ${b.from} limit 1
  `;
  if (!rows[0]) {
    app.log.warn({ phone: b.from }, "SMS received from unknown merchant phone");
    return reply.send({ ok: true });
  }

  const merchantId = rows[0].id;
  const handled = await vendorCommunique.handleMerchantReply(merchantId, b.text);

  if (handled) {
    app.log.info({ merchantId, text: b.text }, "Processed Vendor Communique SMS reply");
  }

  return reply.send({ ok: true });
});

// ─── Boot + graceful shutdown ───────────────────────────────────────────────
app.listen({ port: env.PORT, host: "0.0.0.0" }).then(() => {
  app.log.info(`ingestion-service listening on :${env.PORT}`);
});

async function shutdown(signal: string) {
  app.log.info(`received ${signal}, shutting down gracefully`);
  await app.close();
  await webhookWorker.close();
  await redis.quit();
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
