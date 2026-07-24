// core/baileys-gateway/src/sessionManager.ts
//
// WHAT THIS FILE DOES:
// Manages one persistent Baileys WebSocket session per vendor. Each vendor
// runs their OWN dedicated WhatsApp number (the "business line"). This module
// spins up the socket, persists auth state to Redis (NOT the filesystem —
// that would lose sessions on every process restart), handles reconnects with
// exponential backoff, and routes every inbound message to the classifier.
//
// CRITICAL: The auth state uses BufferJSON.replacer/reviver to serialise
// Signal protocol Buffers correctly. Missing this causes a "bad session" error
// on reconnect even though creds were saved. Every Redis set/get for auth
// MUST go through BufferJSON.
//
// v7.0.0 NOTES:
// - useMultiFileAuthState is for dev ONLY — replaced here with Redis store
// - New auth keys required: lid-mapping, device-list, tctoken — our generic
//   key store handles them automatically (type is just a string key)
// - markOnlineOnConnect = false reduces Meta's automated detection signal

import makeWASocket, {
  DisconnectReason,
  makeCacheableSignalKeyStore,
  BufferJSON,
  Browsers,
  initAuthCreds,
  fetchLatestBaileysVersion,
  type WASocket,
  type AuthenticationCreds,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import P from "pino";
import { redis, sql } from "@ace/shared/clients";
import { classifyAndRoute } from "./messageClassifier.js";

const logger = P({ level: "debug" });

// ─── In-process session registry ─────────────────────────────────────────────
// One entry per active vendor session. We don't need distributed state here
// because all messages for a vendor flow to the same process that holds the socket.
const sessions = new Map<string, WASocket>();
const reconnectAttempts = new Map<string, number>();
// Track vendors that need a post-515 reconnect to finalise pairing
const pendingPairingRestart = new Set<string>();
// In-memory creds mirror — needed so creds.update partial patches are merged
// before we write to Redis. Without this, the partial patch OVERWRITES the full
// creds object in Redis and the post-515 reconnect sees creds as unregistered.
const credsCache = new Map<string, AuthenticationCreds>();

// ─── Redis-backed Auth State ─────────────────────────────────────────────────
// Replaces useMultiFileAuthState for production. Session survives restarts.

async function loadCredsFromRedis(vendorId: string): Promise<AuthenticationCreds | undefined> {
  const raw = await redis.get(`baileys:creds:${vendorId}`);
  if (!raw) return undefined;
  try {
    return JSON.parse(raw, BufferJSON.reviver) as AuthenticationCreds;
  } catch {
    // Corrupted creds — return undefined so a fresh QR is triggered
    return undefined;
  }
}

async function saveCredsToRedis(vendorId: string, creds: AuthenticationCreds): Promise<void> {
  // 30-day TTL — a session inactive longer than this should be re-paired anyway
  await redis.setex(
    `baileys:creds:${vendorId}`,
    60 * 60 * 24 * 30,
    JSON.stringify(creds, BufferJSON.replacer)
  );
}

function buildKeyStore(vendorId: string) {
  return {
    async get(type: string, ids: string[]): Promise<Record<string, unknown>> {
      const results: Record<string, unknown> = {};
      // Batch fetch from Redis using a pipeline
      const pipe = redis.pipeline();
      for (const id of ids) {
        pipe.get(`baileys:keys:${vendorId}:${type}:${id}`);
      }
      const responses = await pipe.exec();
      for (let i = 0; i < ids.length; i++) {
        const raw = responses?.[i]?.[1] as string | null;
        if (raw) {
          try {
            results[ids[i]] = JSON.parse(raw, BufferJSON.reviver);
          } catch {
            // Corrupted key entry — skip it; Baileys will re-derive
          }
        }
      }
      return results;
    },

    async set(data: Record<string, Record<string, unknown>>): Promise<void> {
      const pipe = redis.pipeline();
      for (const [type, entries] of Object.entries(data)) {
        for (const [id, value] of Object.entries(entries)) {
          const key = `baileys:keys:${vendorId}:${type}:${id}`;
          if (value == null) {
            pipe.del(key);
          } else {
            pipe.setex(key, 60 * 60 * 24 * 30, JSON.stringify(value, BufferJSON.replacer));
          }
        }
      }
      await pipe.exec();
    },
  };
}

// ─── Vendor Config ────────────────────────────────────────────────────────────

export interface VendorConfig {
  id: string;
  merchant_id: string;
  business_line_number: string;
  personal_number: string;        // The vendor's OWN WhatsApp — product submissions come from here
  notification_phone: string;
  auto_status_enabled: boolean;
  posting_frequency_hours: number;
  approve_before_post: boolean;
}

export async function loadVendorConfig(vendorId: string): Promise<VendorConfig> {
  const rows = await sql<VendorConfig[]>`
    SELECT id, merchant_id, business_line_number, personal_number,
           notification_phone, auto_status_enabled, posting_frequency_hours,
           approve_before_post
    FROM vendors
    WHERE id = ${vendorId}
    LIMIT 1
  `;
  if (!rows[0]) throw new Error(`Vendor ${vendorId} not found`);
  return rows[0];
}

// ─── Session Lifecycle ────────────────────────────────────────────────────────

export async function createSession(vendorId: string, isPairing = false): Promise<WASocket | null> {
  if (sessions.has(vendorId)) {
    return sessions.get(vendorId)!;
  }

  let existingCreds = await loadCredsFromRedis(vendorId);
  // If the creds are an empty object (due to a previous bug) or missing, re-init
  if (existingCreds && !existingCreds.noiseKey) {
    existingCreds = undefined;
  }
  const creds = existingCreds || initAuthCreds();
  // Seed the in-memory cache so the first creds.update partial patch has a base to merge into
  credsCache.set(vendorId, creds);
  
  if (!creds.registered && !isPairing) {
    logger.info({ vendorId }, "Unregistered vendor, skipping boot to prevent zombie socket.");
    return null;
  }

  const keyStore = buildKeyStore(vendorId);

  const { version, isLatest } = await fetchLatestBaileysVersion();
  logger.info({ version, isLatest }, "Fetched latest Baileys version");

  const sock = makeWASocket({
    version,
    auth: {
      creds,
      // makeCacheableSignalKeyStore wraps our DB-backed store with an LRU
      // in-memory cache to reduce Redis round-trips for hot keys
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      keys: makeCacheableSignalKeyStore(keyStore as any, logger),
    },
    logger,
    printQRInTerminal: false, // Always headless — we use pairing codes
    browser: ['Ubuntu', 'Chrome', '22.04.4'], // Standard browser signature to prevent 400 bad-request
    connectTimeoutMs: 60_000,
    keepAliveIntervalMs: 25_000,
    markOnlineOnConnect: true,  // Must be true for pairing flow to complete on mobile
    getMessage: async (key) => {
      // Baileys needs this to decrypt polls and retry failed sends.
      // We cache recent inbound message content in Redis keyed by message ID.
      const raw = await redis.get(`msg_cache:${key.id}`);
      if (!raw) return { conversation: "" };
      try {
        return JSON.parse(raw, BufferJSON.reviver);
      } catch {
        return { conversation: "" };
      }
    },
  });

  // Track immediately to prevent duplicate sockets
  sessions.set(vendorId, sock);

  // ── CRITICAL: always save creds on every update ───────────────────────────
  // Failing to persist creds means the session is lost on the next restart
  // and the vendor has to re-pair. This is the single most important handler.
  sock.ev.on("creds.update", async (update) => {
    // creds.update fires with a PARTIAL object — only the changed fields.
    // We must merge it into the full in-memory creds before persisting,
    // otherwise we overwrite the full creds with an incomplete patch.
    const full = credsCache.get(vendorId) ?? creds;
    const merged = { ...full, ...update } as AuthenticationCreds;
    credsCache.set(vendorId, merged);
    await saveCredsToRedis(vendorId, merged);
  });

  // ── Connection lifecycle ──────────────────────────────────────────────────
  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === "close") {
      const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
      const isLoggedOut = statusCode === DisconnectReason.loggedOut;
      const isBadSession = statusCode === DisconnectReason.badSession;
      const isRestartRequired = statusCode === DisconnectReason.restartRequired;

      sessions.delete(vendorId);

      // Update DB so the merchant dashboard reflects the true state
      await sql`
        UPDATE vendors
        SET session_status = ${isLoggedOut ? "logged_out" : "reconnecting"},
            updated_at = now()
        WHERE id = ${vendorId}
      `.catch(() => {}); // Don't crash the handler if DB is briefly unavailable

      if (isLoggedOut || isBadSession) {
        // Vendor needs to re-provision. Clear old creds so the next pairing starts fresh.
        await redis.del(`baileys:creds:${vendorId}`);
        reconnectAttempts.delete(vendorId);
        await alertVendorReprovision(vendorId).catch(() => {});
        return;
      }

      if (isRestartRequired) {
        // 515 is WhatsApp's way of saying "pairing done, reconnect to finalise".
        // We MUST reconnect regardless of creds.registered state, because the
        // creds aren't marked registered until the reconnect completes.
        const isPostPairing = pendingPairingRestart.has(vendorId);
        pendingPairingRestart.delete(vendorId);
        logger.info({ vendorId, isPostPairing }, "Restart required — reconnecting immediately");
        setTimeout(() => createSession(vendorId, isPostPairing), 0);
        return;
      }

      // Transient disconnect — exponential backoff reconnect
      const attempts = reconnectAttempts.get(vendorId) ?? 0;
      const delayMs = Math.min(1000 * 2 ** attempts, 30_000); // max 30s
      reconnectAttempts.set(vendorId, attempts + 1);

      logger.info({ vendorId, attempt: attempts + 1, delayMs }, "Reconnecting Baileys session");
      setTimeout(() => createSession(vendorId), delayMs);
    }

    if (connection === "open") {
      reconnectAttempts.set(vendorId, 0);
      sessions.set(vendorId, sock);
      await sql`
        UPDATE vendors SET session_status = 'connected', updated_at = now()
        WHERE id = ${vendorId}
      `.catch(() => {});
      logger.info({ vendorId }, "Baileys session connected");
    }
  });

  // ── Inbound message handler ───────────────────────────────────────────────
  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    // type === 'notify': real-time new messages (what we want)
    // type === 'append': history sync — skip
    if (type !== "notify") return;

    for (const msg of messages) {
      // Skip messages we sent ourselves
      if (msg.key.fromMe || !msg.message) continue;

      // Cache message content for getMessage() — needed for Baileys internals
      if (msg.key.id && msg.message) {
        await redis
          .setex(`msg_cache:${msg.key.id}`, 3600, JSON.stringify(msg.message, BufferJSON.replacer))
          .catch(() => {});
      }

      // Deduplicate — Baileys can re-deliver the same message ID on reconnect
      const dedupeKey = `idempotency:baileys:${msg.key.id}`;
      const isNew = await redis.set(dedupeKey, "1", "EX", 60 * 60 * 24, "NX");
      if (!isNew) {
        logger.debug({ msgId: msg.key.id }, "Duplicate Baileys message — skipping");
        continue;
      }

      try {
        const vendor = await loadVendorConfig(vendorId);
        await classifyAndRoute(msg, vendor, sock);
      } catch (err) {
        logger.error({ err, vendorId, msgId: msg.key.id }, "Error routing message");
      }
    }
  });

  return sock;
}

// ─── Pairing Code Provisioning ────────────────────────────────────────────────
// Called by merchant-api when a vendor sets up their new business line.
// Returns the 8-character pairing code the vendor enters in WhatsApp →
// Settings → Linked Devices → Link with phone number.

export async function pairVendorNumber(vendorId: string, phoneNumber: string): Promise<string> {
  // phoneNumber MUST be E.164 WITHOUT the '+' sign: "2348012345678"
  const normalised = phoneNumber.replace(/^\+/, "").replace(/\s/g, "");
  logger.info({ vendorId, normalised }, "pairVendorNumber called");

  // Destroy any existing dead/zombie session to ensure fresh pairing code
  if (sessions.has(vendorId)) {
    const oldSock = sessions.get(vendorId)!;
    oldSock.end(undefined);
    sessions.delete(vendorId);
  }

  // Force a completely fresh state for pairing
  await redis.del(`baileys:creds:${vendorId}`);
  const keys = await redis.keys(`baileys:keys:${vendorId}:*`);
  if (keys.length > 0) {
    await redis.del(...keys);
  }

  const sock = await createSession(vendorId, true);
  if (!sock) throw new Error("Failed to create session");
  logger.info({ vendorId }, "Socket created, waiting for connection handshake...");

  // Event-driven wait: Wait for the socket to be fully ready for auth/pairing
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      logger.error({ vendorId }, "Timeout waiting for socket to reach pairing state");
      reject(new Error("Socket did not reach pairing state in time"));
    }, 15_000);

    const handler = (update: any) => {
      logger.debug({ vendorId, update }, "Pairing connection update");
      // The `qr` event signifies that the NOISE handshake is done and it's waiting for auth.
      // If it reaches 'open', it's already authenticated.
      if (update.qr || update.connection === "open") {
        sock.ev.off("connection.update", handler);
        clearTimeout(timeout);
        logger.info({ vendorId }, "Socket ready, proceeding to request pairing code");
        resolve();
      }
    };

    sock.ev.on("connection.update", handler);
  });

  if (!sock.authState.creds.registered) {
    // Mark this vendor as needing a post-515 pairing restart BEFORE requesting
    // the code — the 515 arrives within seconds of the user accepting on phone.
    pendingPairingRestart.add(vendorId);
    logger.info({ vendorId, phone: normalised }, "Requesting pairing code from WhatsApp servers");
    const code = await sock.requestPairingCode(normalised);
    logger.info({ vendorId, code }, "Pairing code issued successfully");
    return code;
  }

  return "already_registered";
}

// ─── Public accessors ─────────────────────────────────────────────────────────

export function getSession(vendorId: string): WASocket | undefined {
  return sessions.get(vendorId);
}

export function getAllActiveSessions(): string[] {
  return [...sessions.keys()];
}

// ─── Reprovision Alert ────────────────────────────────────────────────────────

async function alertVendorReprovision(vendorId: string): Promise<void> {
  // In Phase 2: send an SMS via Africa's Talking / Twilio to the vendor's
  // personal number telling them their business line needs re-pairing.
  // For now: log loud so ops can act.
  const vendor = await loadVendorConfig(vendorId).catch(() => null);
  logger.error(
    { vendorId, phone: vendor?.notification_phone },
    "VENDOR SESSION LOGGED OUT — reprovision required"
  );
}
