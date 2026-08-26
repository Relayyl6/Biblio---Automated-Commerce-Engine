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

const logger = P({ level: "info" });

// ─── In-process session registry ─────────────────────────────────────────────
// One entry per active vendor session. We don't need distributed state here
// because all messages for a vendor flow to the same process that holds the socket.
const sessions = new Map<string, WASocket>();
const merchantToVendor = new Map<string, string>();
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

// ─── Retry helper ────────────────────────────────────────────────────────────
// Retries an async operation with exponential backoff. Designed to survive
// a cold Neon DB wake-up (which can take 2-3 seconds) without dropping messages.
async function withRetry<T>(
  fn: () => Promise<T>,
  label: string,
  maxAttempts = 4,
  baseDelayMs = 2000
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt === maxAttempts) break;
      const delay = baseDelayMs * attempt; // 2s, 4s, 6s
      logger.warn({ label, attempt, delay, err }, `Retrying after failure (attempt ${attempt}/${maxAttempts})`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

// ─── Vendor Config ────────────────────────────────────────────────────────────

export interface VendorConfig {
  id: string;
  merchant_id: string;
  business_line_number: string;
  personal_number: string;        // The vendor's OWN WhatsApp — product submissions come from here
  auto_status_enabled: boolean;
  posting_frequency_hours: number;
  approve_before_post: boolean;
}

export async function loadVendorConfig(vendorId: string): Promise<VendorConfig> {
  const rows = await sql<VendorConfig[]>`
    SELECT id, merchant_id, business_line_number, personal_number,
           auto_status_enabled, posting_frequency_hours,
           approve_before_post
    FROM vendors
    WHERE id = ${vendorId}
    LIMIT 1
  `;
  if (!rows[0]) throw new Error(`Vendor ${vendorId} not found`);
  return rows[0];
}

/**
 * Auto-provisions a merchant and vendor record if one does not already exist
 * for the given phone number. Enables zero-configuration pairing for new merchants.
 */
export async function getOrCreateVendorByPhone(phoneNumber: string): Promise<VendorConfig> {
  const cleanPhone = phoneNumber.replace(/^\+/, "").replace(/\s/g, "");

  // 1. Try finding existing vendor by business_line_number or personal_number
  const existing = await sql<VendorConfig[]>`
    SELECT id, merchant_id, business_line_number, personal_number,
           auto_status_enabled, posting_frequency_hours,
           approve_before_post
    FROM vendors
    WHERE business_line_number = ${cleanPhone} OR personal_number = ${cleanPhone}
    LIMIT 1
  `;
  if (existing[0]) {
    return existing[0];
  }

  // 2. Check if a merchant exists with this phone or create one
  const existingMerchant = await sql<{ id: string }[]>`
    SELECT id FROM merchants WHERE phone = ${cleanPhone} LIMIT 1
  `;

  let merchantId = existingMerchant[0]?.id;
  if (!merchantId) {
    const merchantRows = await sql<{ id: string }[]>`
      INSERT INTO merchants (
        name, phone, currency, dialect, tone_guide
      ) VALUES (
        ${`Store +${cleanPhone}`}, ${cleanPhone}, 'NGN', 'pidgin',
        'Warm, respectful Nigerian merchant. Fast, polite, no-nonsense.'
      )
      RETURNING id
    `;
    merchantId = merchantRows[0].id;

    // Seed default pricing rules for this new merchant
    await sql`
      INSERT INTO merchant_pricing_rules (
        merchant_id, max_discount_pct, bundle_discount_pct, loyalty_discount_pct,
        floor_margin_pct, bulk_threshold_units, payment_method_discounts, dynamic_pricing_enabled
      ) VALUES (
        ${merchantId}, 0.20, 0.10, 0.15,
        0.10, 3, '{"transfer": 0.05, "card": 0.0}'::jsonb, true
      )
      ON CONFLICT (merchant_id) DO NOTHING
    `;
  }

  // 3. Create vendor record
  const vendorRows = await sql<VendorConfig[]>`
    INSERT INTO vendors (
      merchant_id, business_line_number, personal_number,
      session_status, auto_status_enabled, posting_frequency_hours, approve_before_post
    ) VALUES (
      ${merchantId}, ${cleanPhone}, ${cleanPhone},
      'pending', false, 24, false
    )
    RETURNING id, merchant_id, business_line_number, personal_number,
              auto_status_enabled, posting_frequency_hours,
              approve_before_post
  `;

  logger.info({ phone: cleanPhone, vendorId: vendorRows[0].id, merchantId }, "Auto-provisioned new merchant and vendor");
  return vendorRows[0];
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
    logger: P({ level: 'silent' }) as any,
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

  const vendor = await loadVendorConfig(vendorId).catch(() => null);

  // Track immediately by both vendorId and merchant_id for multi-vendor routing
  sessions.set(vendorId, sock);
  if (vendor?.merchant_id) {
    sessions.set(vendor.merchant_id, sock);
  }

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
      if (vendor?.merchant_id) {
        sessions.delete(vendor.merchant_id);
      }

      // Update DB so the merchant dashboard reflects the true state
      await sql`
        UPDATE vendors
        SET session_status = ${isLoggedOut ? "logged_out" : "reconnecting"},
            updated_at = now()
        WHERE id = ${vendorId}
      `.catch(err => logger.warn({ err }, "[SessionManager] Non-critical DB update failed, continuing"));

      if (isLoggedOut || isBadSession) {
        // Vendor needs to re-provision. Clear old creds so the next pairing starts fresh.
        await redis.del(`baileys:creds:${vendorId}`);
        reconnectAttempts.delete(vendorId);
        await alertVendorReprovision(vendorId).catch(err => logger.warn({ err, vendorId }, "[SessionManager] alertVendorReprovision failed"));
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
      // Also register under merchant_id so outbound routing works by merchantId
      const vendorCfg = await loadVendorConfig(vendorId).catch(() => null);
      if (vendorCfg?.merchant_id) {
        sessions.set(vendorCfg.merchant_id, sock);
        logger.info({ vendorId, merchantId: vendorCfg.merchant_id }, "Session registered under merchantId for outbound routing");
      }
      
      // Check previous status to send welcome message once
      const prevStatusRows = await sql<{ session_status: string }[]>`
        SELECT session_status FROM vendors WHERE id = ${vendorId}
      `.catch(() => []);
      
      const isFirstTime = prevStatusRows[0]?.session_status === "pending";

      await sql`
        UPDATE vendors SET session_status = 'connected', updated_at = now()
        WHERE id = ${vendorId}
      `.catch(err => logger.warn({ err }, "[SessionManager] Non-critical operation failed"));
      logger.info({ vendorId }, "Baileys session connected");

      // Send the onboarding trigger
      if (isFirstTime && vendorCfg?.personal_number) {
        const merchantRows = await sql<{ name: string }[]>`
          SELECT name FROM merchants WHERE id = ${vendorCfg.merchant_id}
        `.catch(() => []);
        const businessName = merchantRows[0]?.name || "your store";
        
        try {
          await sock.sendMessage(`${vendorCfg.personal_number}@s.whatsapp.net`, {
            text: `Hi ${businessName}, I'm Biblio. Nice call linking me — you'll never lose a client again! You can chat with me here to manage your inventory, approve customer offers, and track sales.`
          });
          logger.info({ vendorId }, "Sent Biblio Agent welcome message to vendor");
        } catch (err) {
          logger.error({ err, vendorId }, "Failed to send welcome message");
        }
      }
    }
  });

  // ── Inbound message handler ───────────────────────────────────────────────
  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    // type === 'notify': real-time new messages (what we want)
    // type === 'append': history sync — skip
    if (type !== "notify") return;

    for (const msg of messages) {
      if (!msg.message) continue;

      const rawText = (
        msg.message.conversation ||
        msg.message.extendedTextMessage?.text ||
        msg.message.imageMessage?.caption ||
        msg.message.videoMessage?.caption ||
        msg.message.documentMessage?.caption ||
        ""
      ).trim();

      const hasBusinessStart = /^(business|start-business|start\s+business)\b/i.test(rawText) || /^business[:\s]/i.test(rawText);
      const isEndBusiness = /^(end-business|end\s+business|exit-business|exit\s+business)$/i.test(rawText);
      const isBusinessModeActive = await redis.get(`vendor:${vendorId}:business_mode`);

      // If it's a message sent by the bot itself / note-to-self:
      if (msg.key.fromMe) {
        // ONLY process if business mode is active, or user sent 'business' / 'end-business'
        if (!isBusinessModeActive && !hasBusinessStart && !isEndBusiness) {
          continue;
        }
        logger.info({ msgId: msg.key.id, isBusinessModeActive: !!isBusinessModeActive, hasBusinessStart, isEndBusiness }, "Captured vendor Note-to-Self command");
      }

      // Cache message content for getMessage() — needed for Baileys internals
      if (msg.key.id && msg.message) {
        await redis
          .setex(`msg_cache:${msg.key.id}`, 3600, JSON.stringify(msg.message, BufferJSON.replacer))
          .catch(err => logger.warn({ err }, "[SessionManager] Non-critical operation failed"));
      }

      // Deduplicate — Baileys can re-deliver the same message ID on reconnect
      const dedupeKey = `idempotency:baileys:${msg.key.id}`;
      const isNew = await redis.set(dedupeKey, "1", "EX", 60 * 60 * 24, "NX");
      if (!isNew) {
        logger.debug({ msgId: msg.key.id }, "Duplicate Baileys message — skipping");
        continue;
      }

      try {
        // withRetry ensures a cold Neon DB wake-up never silently drops a message.
        const vendor = await withRetry(
          () => loadVendorConfig(vendorId),
          `loadVendorConfig:${vendorId}`
        );
        await classifyAndRoute(msg, vendor, sock);
      } catch (err) {
        logger.error({ err, vendorId, msgId: msg.key.id }, "Error routing message after retries");
      }
    }
  });

  return sock;
}

// ─── Pairing Code Provisioning ────────────────────────────────────────────────
// Called by merchant-api / CLI when a vendor sets up their business line.
// Returns the 8-character pairing code the vendor enters in WhatsApp →
// Settings → Linked Devices → Link with phone number.

export interface PairResult {
  code: string;
  vendorId: string;
  merchantId: string;
}

export async function pairVendorNumber(phoneNumber: string, vendorId?: string): Promise<PairResult> {
  // phoneNumber MUST be E.164 WITHOUT the '+' sign: "2348012345678"
  const normalised = phoneNumber.replace(/^\+/, "").replace(/\s/g, "");
  logger.info({ vendorId, normalised }, "pairVendorNumber called");

  let vendor: VendorConfig;
  if (vendorId) {
    try {
      vendor = await loadVendorConfig(vendorId);
    } catch {
      vendor = await getOrCreateVendorByPhone(normalised);
    }
  } else {
    vendor = await getOrCreateVendorByPhone(normalised);
  }

  const effectiveVendorId = vendor.id;

  // Save the business line number
  await sql`
    UPDATE vendors 
    SET business_line_number = ${normalised}, updated_at = now()
    WHERE id = ${effectiveVendorId}
  `.catch(err => logger.warn({ err }, "[SessionManager] Non-critical operation failed"));

  // Destroy any existing dead/zombie session to ensure fresh pairing code
  if (sessions.has(effectiveVendorId)) {
    const oldSock = sessions.get(effectiveVendorId)!;
    oldSock.end(undefined);
    sessions.delete(effectiveVendorId);
  }

  // Force a completely fresh state for pairing
  await redis.del(`baileys:creds:${effectiveVendorId}`);
  const keys = await redis.keys(`baileys:keys:${effectiveVendorId}:*`);
  if (keys.length > 0) {
    await redis.del(...keys);
  }

  const sock = await createSession(effectiveVendorId, true);
  if (!sock) throw new Error("Failed to create session");
  logger.info({ vendorId: effectiveVendorId }, "Socket created, waiting for connection handshake...");

  // Event-driven wait: Wait for the socket to be fully ready for auth/pairing
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      logger.error({ vendorId: effectiveVendorId }, "Timeout waiting for socket to reach pairing state");
      reject(new Error("Socket did not reach pairing state in time"));
    }, 15_000);

    const handler = (update: any) => {
      logger.debug({ vendorId: effectiveVendorId, update }, "Pairing connection update");
      // The `qr` event signifies that the NOISE handshake is done and it's waiting for auth.
      // If it reaches 'open', it's already authenticated.
      if (update.qr || update.connection === "open") {
        sock.ev.off("connection.update", handler);
        clearTimeout(timeout);
        logger.info({ vendorId: effectiveVendorId }, "Socket ready, proceeding to request pairing code");
        resolve();
      }
    };

    sock.ev.on("connection.update", handler);
  });

  if (!sock.authState.creds.registered) {
    // Mark this vendor as needing a post-515 pairing restart BEFORE requesting
    // the code — the 515 arrives within seconds of the user accepting on phone.
    pendingPairingRestart.add(effectiveVendorId);
    logger.info({ vendorId: effectiveVendorId, phone: normalised }, "Requesting pairing code from WhatsApp servers");
    const code = await sock.requestPairingCode(normalised);
    logger.info({ vendorId: effectiveVendorId, code }, "Pairing code issued successfully");
    return { code, vendorId: effectiveVendorId, merchantId: vendor.merchant_id };
  }

  return { code: "already_registered", vendorId: effectiveVendorId, merchantId: vendor.merchant_id };
}

// ─── Public accessors ─────────────────────────────────────────────────────────

export function getSession(id: string): WASocket | undefined {
  if (sessions.has(id)) return sessions.get(id);
  const mappedVendorId = merchantToVendor.get(id);
  if (mappedVendorId && sessions.has(mappedVendorId)) return sessions.get(mappedVendorId);
  if (sessions.size === 1) return [...sessions.values()][0];
  return undefined;
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
    { vendorId, phone: vendor?.personal_number },
    "VENDOR SESSION LOGGED OUT — reprovision required"
  );
}
