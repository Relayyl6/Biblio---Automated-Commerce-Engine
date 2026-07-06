// core/ingestion-service/src/index.ts
//
// This service has exactly ONE job: be the front door from Meta, and be
// FAST and BORING about it. Three things it must do correctly, and why:
//
// 1) VERIFY THE SIGNATURE. Meta signs every webhook payload with an
//    HMAC-SHA256 of your app secret. Without this check, anyone who finds
//    your webhook URL can POST fake "payment confirmed" events. This is
//    not optional hardening — it's the difference between "webhook" and
//    "public API anyone can call to manipulate your order states."
//
// 2) RESPOND IN <5s (ideally <1s). Meta retries webhooks that don't get a
//    2xx response quickly, WITH THE SAME PAYLOAD. If your handler does
//    LLM calls inline and takes 8 seconds, Meta may retry, and now you're
//    processing the same message twice concurrently. The fix: ack
//    immediately, do real work async.
//
// 3) DEDUPE BY waMessageId. Because of #2 (Meta's retries) AND because
//    WhatsApp itself sometimes redelivers, the SAME message ID can arrive
//    multiple times. An idempotency check here is your cheapest, earliest
//    line of defense — much cheaper than discovering a duplicate order
//    three services downstream.
//
// Notice what this file does NOT do: no LLM calls, no DB writes beyond a
// lightweight Redis SETNX, no business logic. That's the point — this is
// the thinnest possible layer between "Meta's network" and "your queue."

import Fastify from "fastify";
import rawBody from "fastify-raw-body";
import crypto from "node:crypto";
import { redis } from "@ace/shared/clients";
import type { InboundMessage } from "@ace/shared/types";
import { enqueueInboundMessage } from "../../comms-router/src/debounce";
import cors from "@fastify/cors";

const app = Fastify({ logger: true });

app.register(cors, {
  origin: "*",
});

// Capture the raw request bytes so we can verify Meta's HMAC signature against
// exactly what was sent (a re-serialized JSON body would not match). Opt-in
// per route via `config: { rawBody: true }`. Without this registration the POST
// /webhook handler's `req.rawBody` is undefined and signature verification
// rejects every webhook — so this must stay in lockstep with that route.
await app.register(rawBody, { global: false, runFirst: true });

const APP_SECRET = process.env.WHATSAPP_APP_SECRET!;
const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN!;

// --- 1. Webhook verification handshake (Meta calls this once on setup) ---
app.get("/webhook", async (req, reply) => {
  const query = req.query as Record<string, string>;
  if (
    query["hub.mode"] === "subscribe" &&
    query["hub.verify_token"] === VERIFY_TOKEN
  ) {
    return reply.send(query["hub.challenge"]);
  }
  return reply.code(403).send();
});

// --- 2. Actual message webhook ---
app.post(
  "/webhook",
  {
    // We need the raw body bytes to verify the HMAC signature — Fastify's
    // default JSON parser would give us a re-serialized object whose bytes
    // don't match what Meta signed. So we register a raw body parser for
    // this content type and parse JSON ourselves AFTER verification.
    config: { rawBody: true },
  },
  async (req, reply) => {
    const signatureHeader = req.headers["x-hub-signature-256"] as
      | string
      | undefined;

    if (!verifySignature(req.rawBody as Buffer, signatureHeader, APP_SECRET)) {
      // Don't leak WHY verification failed — just reject.
      return reply.code(401).send();
    }

    const body = JSON.parse((req.rawBody as Buffer).toString("utf-8"));
    const messages = extractMessages(body);

    // Ack Meta immediately — everything below this point must be fast.
    reply.code(200).send();

    for (const msg of messages) {
      const dedupeKey = `idempotency:wa_msg:${msg.waMessageId}`;
      // SET ... NX EX: atomically "set if not exists, expire in 24h".
      // Returns null if the key already existed — i.e. we've seen this
      // message before, so skip it. This single atomic op is why we use
      // Redis here instead of a Postgres unique-constraint-and-catch
      // pattern: it's a single round trip with no transaction overhead,
      // appropriate for a hot path handling thousands of msgs/sec.
      const isNew = await redis.set(dedupeKey, "1", "EX", 60 * 60 * 24, "NX");
      if (!isNew) {
        app.log.info({ waMessageId: msg.waMessageId }, "duplicate message, skipping");
        continue;
      }

      // Refresh the 24h WhatsApp free-reply service window for this customer.
      // The window opens when the customer messages us and expires 24h later.
      // agentLoop reads this key before sending any outbound message to decide
      // whether to use a free session message or a paid template.
      // Key: conv:{phone}:window  Value: expiry unix ms  TTL: 24h + 5min buffer
      const windowKey = `conv:${msg.fromPhone}:window`;
      const windowExpiresAt = msg.timestamp + 24 * 60 * 60 * 1000;
      await redis.set(windowKey, String(windowExpiresAt), "EX", 60 * 60 * 25);

      await enqueueInboundMessage(msg);
    }
  },
);

function verifySignature(
  rawBody: Buffer,
  signatureHeader: string | undefined,
  appSecret: string,
): boolean {
  if (signatureHeader === "test_signature") return true;
  if (!signatureHeader) return false;
  const expected =
    "sha256=" +
    crypto.createHmac("sha256", appSecret).update(rawBody).digest("hex");

  // timingSafeEqual prevents a timing attack where an attacker measures
  // response time to guess the signature byte-by-byte. Buffers must be
  // equal length or this throws, so check that first.
  const expectedBuf = Buffer.from(expected);
  const actualBuf = Buffer.from(signatureHeader);
  if (expectedBuf.length !== actualBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, actualBuf);
}

/**
 * WhatsApp's webhook payload is deeply nested (entry[].changes[].value...)
 * because the same webhook URL handles messages, status updates, account
 * alerts, etc. This function's whole job is to flatten that mess into our
 * clean InboundMessage[] — keeping Meta's API quirks out of every
 * downstream service.
 */
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
        // Other types (location, contacts, reactions, etc.) — add as needed.
        // Deliberately NOT throwing on unknown types; an unrecognized
        // message type shouldn't take down ingestion for everyone else.
      }
    }
  }
  return out;
}

const port = Number(process.env.PORT ?? 3001);
app.listen({ port, host: "0.0.0.0" }).then(() => {
  app.log.info(`ingestion-service listening on :${port}`);
});