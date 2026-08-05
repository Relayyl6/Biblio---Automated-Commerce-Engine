// core/baileys-gateway/src/index.ts
//
// Entry point for the baileys-gateway service.
//
// At startup:
//   1. Queries the DB for all vendors with a stored session (session_status != 'logged_out')
//   2. Calls createSession() for each, which reconnects the Baileys WebSocket
//      using the stored Redis auth state — no re-pairing needed
//   3. Starts the Status posting cron
//   4. Starts a small Fastify HTTP server for internal management calls
//     (pairing a new vendor, checking session status, manually triggering a
//      Status post or cron run)
//
// PROCESS MODEL:
// This runs as a single long-lived Node.js process. Each vendor gets one
// Baileys socket (one WebSocket connection) maintained by sessionManager.
// BullMQ workers (for the negotiator) are in the comms-router process —
// this process only routes inbound events to the same BullMQ queue and
// reads from the same Redis/PG.
//
// PORT: 3005 (configurable via BAILEYS_GATEWAY_PORT)

import Fastify from "fastify";
import cors from "@fastify/cors";
import P from "pino";
import { sql } from "@ace/shared/clients";
import { createSession, getSession, getAllActiveSessions, pairVendorNumber } from "./sessionManager.js";
import { startStatusCron, runStatusCron } from "./statusPoster.js";
import { sendViaBaileys, canSendViaBaileys } from "./outboundAdapter.js";
import type { OutboundMessage } from "@ace/shared/types";

const logger = P({ level: "info" });
const app = Fastify({ logger: true });

await app.register(cors, { origin: "*" });

// ─── Health ───────────────────────────────────────────────────────────────────
app.get("/health", async () => ({
  ok: true,
  activeSessions: getAllActiveSessions().length,
  sessions: getAllActiveSessions(),
}));

// ─── Pair a new vendor business line ─────────────────────────────────────────
// Called from the merchant-api / dashboard onboarding flow or CLI.
// Body: { phoneNumber: string, vendorId?: string }
// Returns: { ok: true, code: string, vendorId: string, merchantId: string }
app.post("/pair", async (req, reply) => {
  const { vendorId, phoneNumber } = req.body as {
    vendorId?: string;
    phoneNumber?: string;
  };

  if (!phoneNumber) {
    return reply.code(400).send({ error: "phoneNumber is required (E.164 format, e.g. 2348012345678)" });
  }

  try {
    const res = await pairVendorNumber(phoneNumber, vendorId);
    return reply.send({ ok: true, ...res });
  } catch (err) {
    req.log.error({ err, vendorId, phoneNumber }, "Pairing failed");
    return reply.code(500).send({ ok: false, error: (err as Error).message });
  }
});

// ─── Get vendor session status ────────────────────────────────────────────────
app.get("/sessions/:vendorId", async (req, reply) => {
  const { vendorId } = req.params as { vendorId: string };
  const active = getAllActiveSessions().includes(vendorId);

  const rows = await sql<{ session_status: string }[]>`
    SELECT session_status FROM vendors WHERE id = ${vendorId} LIMIT 1
  `;

  return {
    vendorId,
    inMemory: active,
    dbStatus: rows[0]?.session_status ?? "unknown",
  };
});

// ─── Manually reconnect a vendor session ─────────────────────────────────────
app.post("/sessions/:vendorId/connect", async (req, reply) => {
  const { vendorId } = req.params as { vendorId: string };
  try {
    await createSession(vendorId);
    return reply.send({ ok: true, message: `Session creation started for vendor ${vendorId}` });
  } catch (err) {
    return reply.code(500).send({ ok: false, error: (err as Error).message });
  }
});

// ─── Manually trigger status cron ────────────────────────────────────────────
// Useful for testing — mirrors the scheduled cron job
app.post("/status/cron", async (_req, reply) => {
  await runStatusCron();
  return reply.send({ ok: true, message: "Status cron run completed" });
});

// ─── Outbound send (called by comms-router across process boundary) ───────────
// Body: OutboundMessage & { merchantId: string }
// Returns: { ok: true } or { ok: false, error: string }
app.post("/send", async (req, reply) => {
  const body = req.body as OutboundMessage & { merchantId: string };
  if (!body.merchantId) {
    return reply.code(400).send({ ok: false, error: "merchantId is required" });
  }
  if (!canSendViaBaileys(body.merchantId)) {
    return reply.code(503).send({ ok: false, error: `No active Baileys session for merchant ${body.merchantId}` });
  }
  try {
    await sendViaBaileys(body, body.merchantId);
    return reply.send({ ok: true });
  } catch (err) {
    req.log.error({ err, merchantId: body.merchantId }, "Baileys send failed via /send");
    return reply.code(500).send({ ok: false, error: (err as Error).message });
  }
});

// ─── Presence update (called by comms-router to show typing indicator) ────────
// Body: { merchantId: string, toJid: string, presence: "composing" | "paused" }
app.post("/presence", async (req, reply) => {
  const { merchantId, toJid, presence } = req.body as { merchantId?: string; toJid?: string; presence?: "composing" | "paused" };
  if (!merchantId || !toJid || !presence) {
    return reply.code(400).send({ ok: false, error: "merchantId, toJid, and presence are required" });
  }
  
  const sock = getSession(merchantId);
  if (!sock) {
    return reply.code(503).send({ ok: false, error: `No active session for merchant ${merchantId}` });
  }
  
  try {
    await sock.sendPresenceUpdate(presence, toJid);
    return reply.send({ ok: true });
  } catch (err) {
    req.log.error({ err, merchantId, toJid }, "Failed to send presence update");
    return reply.code(500).send({ ok: false, error: (err as Error).message });
  }
});

// ─── Startup ─────────────────────────────────────────────────────────────────

async function boot() {
  // Load all vendors that should have active sessions
  const vendors = await sql<{ id: string; session_status: string }[]>`
    SELECT id, session_status FROM vendors
    WHERE session_status NOT IN ('logged_out')
    ORDER BY created_at ASC
  `;

  logger.info({ count: vendors.length }, "Bootstrapping Baileys sessions");

  // Stagger session startup to avoid hammering WA servers simultaneously
  for (let i = 0; i < vendors.length; i++) {
    const vendor = vendors[i];
    setTimeout(async () => {
      try {
        await createSession(vendor.id);
        logger.info({ vendorId: vendor.id }, "Session bootstrapped");
      } catch (err) {
        logger.error({ err, vendorId: vendor.id }, "Session bootstrap failed");
      }
    }, i * 2000); // 2 second stagger between sessions
  }

  // Start the Status posting cron
  startStatusCron();

  // Start the management HTTP server
  const port = Number(process.env.BAILEYS_GATEWAY_PORT ?? 3005);
  await app.listen({ port, host: "0.0.0.0" });
  logger.info({ port }, "baileys-gateway listening");
}

boot().catch((err) => {
  logger.error({ err }, "baileys-gateway failed to boot");
  process.exit(1);
});
