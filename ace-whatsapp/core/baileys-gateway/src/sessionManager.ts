// core/baileys-gateway/src/sessionManager.ts
//
// WHAT THIS FILE DOES:
// Manages one persistent Baileys WebSocket session per vendor. Each vendor
// runs their OWN dedicated WhatsApp number (the "business line"). This module
// spins up the socket, persists auth state to Redis (L1) and PostgreSQL (L2 durable),
// handles reconnects with exponential backoff and disconnect code specialization,
// manages message deduplication and retry-counter storms, and routes every
// inbound message to the classifier.
//
// DISCONNECT CODE SPECIFICATION:
// - 401 (loggedOut): Session invalidated on phone. Clean creds, mark logged_out, do not reconnect.
// - 403 (forbidden): Account banned or unauthorized. Mark logged_out/banned, do not thrash reconnects.
// - 408 (timedOut): Transient network timeout. Exponential backoff reconnect.
// - 411 (multideviceMismatch): Multi-device state mismatch. Invalidate in-memory cache and re-sync.
// - 428 (connectionClosed): Precondition required / normal socket close. Exponential backoff reconnect.
// - 440 (connectionReplaced): Session opened elsewhere. Paced 30s delay; halts after 3 consecutive conflicts.
// - 500 (badSession): Corrupt auth session. Purge creds, mark logged_out, do not reconnect.
// - 515 (restartRequired): Pairing / handshake step. Reconnect quickly (250ms) to finalize.
//
// CRYPTOGRAPHIC STORAGE INTEGRITY:
// - All creds/keys mutations pass through a per-vendor serializeVendorWrite queue (FIFO lock).
// - Redis and PostgreSQL key deserialization guarantees no null/undefined Signal keys.
// - getMessage() returns undefined on cache miss (never empty conversation), preventing retry loops.
// - msgRetryCounterCache prevents retry storms on failed message delivery.

import makeWASocket, {
  DisconnectReason,
  makeCacheableSignalKeyStore,
  BufferJSON,
  initAuthCreds,
  fetchLatestBaileysVersion,
  jidNormalizedUser,
  type WASocket,
  type AuthenticationCreds,
  type CacheStore,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import P from "pino";
import { redis, sql } from "@ace/shared/clients";
import { classifyAndRoute } from "./messageClassifier.js";

const logger = P({ level: "info" });

// ─── In-memory CacheStore for Baileys Retry Counters ────────────────────────
class MemoryCacheStore implements CacheStore {
  private map = new Map<string, { value: any; expiresAt: number }>();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Periodically clean up expired retry counter records every 5 minutes to prevent memory leaks
    this.cleanupInterval = setInterval(() => this.purgeExpired(), 300_000);
    if (this.cleanupInterval.unref) this.cleanupInterval.unref();
  }

  private purgeExpired(): void {
    const now = Date.now();
    for (const [key, item] of this.map.entries()) {
      if (now > item.expiresAt) {
        this.map.delete(key);
      }
    }
  }

  get<T>(key: string): T | undefined {
    const item = this.map.get(key);
    if (!item) return undefined;
    if (Date.now() > item.expiresAt) {
      this.map.delete(key);
      return undefined;
    }
    return item.value as T;
  }

  set<T>(key: string, value: T): void {
    // 5-minute TTL for retry counter records
    this.map.set(key, { value, expiresAt: Date.now() + 300_000 });
  }

  del(key: string): void {
    this.map.delete(key);
  }

  flushAll(): void {
    this.map.clear();
  }
}

const globalRetryCounterCache = new MemoryCacheStore();

// ─── In-process session registry ─────────────────────────────────────────────
const sessions = new Map<string, WASocket>();
const merchantToVendor = new Map<string, string>();
const reconnectAttempts = new Map<string, number>();
const reconnectTimers = new Map<string, NodeJS.Timeout>();
const consecutiveConflictCount = new Map<string, number>();

// Track vendors that need a post-515 reconnect to finalise pairing
const pendingPairingRestart = new Set<string>();
// Track active pairing window (120s TTL) so multi-step handshakes survive restarts
const pairingActiveUntil = new Map<string, number>();
// Track the latest human-actionable connection error
const lastSessionError = new Map<string, string>();
// In-memory creds mirror
const credsCache = new Map<string, AuthenticationCreds>();

// Per-vendor FIFO write serializer to prevent race conditions on simultaneous session updates.
// Automatically pruned on completion to prevent Promise closure memory leaks.
const writeQueues = new Map<string, Promise<unknown>>();

function serializeVendorWrite<T>(vendorId: string, task: () => Promise<T>): Promise<T> {
  const current = writeQueues.get(vendorId) ?? Promise.resolve();
  const next = current.then(task, task).finally(() => {
    if (writeQueues.get(vendorId) === next) {
      writeQueues.delete(vendorId);
    }
  });
  writeQueues.set(vendorId, next);
  return next as Promise<T>;
}

function clearReconnectTimer(vendorId: string): void {
  const existing = reconnectTimers.get(vendorId);
  if (existing) {
    clearTimeout(existing);
    reconnectTimers.delete(vendorId);
  }
}

function scheduleReconnect(vendorId: string, delayMs: number, isPairing = false): void {
  clearReconnectTimer(vendorId);
  const timer = setTimeout(async () => {
    reconnectTimers.delete(vendorId);
    try {
      await createSession(vendorId, isPairing);
    } catch (err) {
      logger.error({ err, vendorId }, "[SessionManager] Scheduled reconnection failed");
    }
  }, delayMs);
  reconnectTimers.set(vendorId, timer);
}

// ─── Dual-Tier Redis + PostgreSQL Durable Auth State ─────────────────────────

async function loadCredsFromRedis(vendorId: string): Promise<AuthenticationCreds | undefined> {
  // 1. Try Redis fast cache first
  try {
    const raw = await redis.get(`baileys:creds:${vendorId}`);
    if (raw) {
      try {
        const parsed = JSON.parse(raw, BufferJSON.reviver) as AuthenticationCreds;
        if (parsed && parsed.noiseKey) {
          return parsed;
        }
      } catch {
        // Corrupted in Redis, fall through to PostgreSQL
      }
    }
  } catch (err) {
    logger.warn({ err, vendorId }, "[SessionManager] Redis read failed, falling back to PostgreSQL");
  }

  // 2. Fallback to durable PostgreSQL storage
  try {
    const rows = await sql<{ auth_creds: string | null }[]>`
      SELECT auth_creds FROM vendors WHERE id = ${vendorId}::uuid LIMIT 1
    `;
    if (rows[0]?.auth_creds) {
      const parsed = JSON.parse(rows[0].auth_creds, BufferJSON.reviver) as AuthenticationCreds;
      if (parsed && parsed.noiseKey) {
        // Re-hydrate Redis cache
        await redis.setex(
          `baileys:creds:${vendorId}`,
          60 * 60 * 24 * 30,
          rows[0].auth_creds
        ).catch(() => {});
        logger.info({ vendorId }, "[SessionManager] Successfully re-hydrated WhatsApp creds from PostgreSQL");
        return parsed;
      }
    }
  } catch (err) {
    logger.warn({ err, vendorId }, "[SessionManager] Failed to load WhatsApp creds from PostgreSQL");
  }

  return undefined;
}

async function saveCredsToRedis(vendorId: string, creds: AuthenticationCreds): Promise<void> {
  return serializeVendorWrite(vendorId, async () => {
    const serialized = JSON.stringify(creds, BufferJSON.replacer);

    // 1. Write to Redis (30-day TTL)
    await redis.setex(
      `baileys:creds:${vendorId}`,
      60 * 60 * 24 * 30,
      serialized
    ).catch(err => logger.warn({ err, vendorId }, "[SessionManager] Redis creds write failed"));

    // 2. Write to PostgreSQL durable storage
    await sql`
      UPDATE vendors
      SET auth_creds = ${serialized}, updated_at = now()
      WHERE id = ${vendorId}::uuid
    `.catch(err => logger.warn({ err, vendorId }, "[SessionManager] PostgreSQL creds write failed"));
  });
}

function buildKeyStore(vendorId: string) {
  return {
    async get(type: string, ids: string[]): Promise<Record<string, unknown>> {
      const results: Record<string, unknown> = {};
      const missingIds: string[] = [];

      // 1. Batch fetch from Redis using a pipeline
      try {
        const pipe = redis.pipeline();
        for (const id of ids) {
          pipe.get(`baileys:keys:${vendorId}:${type}:${id}`);
        }
        const responses = await pipe.exec();
        for (let i = 0; i < ids.length; i++) {
          const raw = responses?.[i]?.[1] as string | null;
          if (raw) {
            try {
              const parsed = JSON.parse(raw, BufferJSON.reviver);
              if (parsed !== null && parsed !== undefined) {
                results[ids[i]] = parsed;
              } else {
                missingIds.push(ids[i]);
              }
            } catch {
              missingIds.push(ids[i]);
            }
          } else {
            missingIds.push(ids[i]);
          }
        }
      } catch {
        missingIds.push(...ids);
      }

      // 2. Fallback to PostgreSQL for any missing keys
      if (missingIds.length > 0) {
        try {
          const dbRows = await sql<{ key_id: string; key_data: string }[]>`
            SELECT key_id, key_data FROM vendor_baileys_keys
            WHERE vendor_id = ${vendorId}::uuid AND key_type = ${type} AND key_id = ANY(${missingIds})
          `;
          for (const row of dbRows) {
            try {
              const val = JSON.parse(row.key_data, BufferJSON.reviver);
              if (val !== null && val !== undefined) {
                results[row.key_id] = val;
                // Re-hydrate Redis cache
                redis.setex(
                  `baileys:keys:${vendorId}:${type}:${row.key_id}`,
                  60 * 60 * 24 * 30,
                  row.key_data
                ).catch(() => {});
              }
            } catch {}
          }
        } catch (err) {
          logger.warn({ err, vendorId, type }, "[SessionManager] PostgreSQL key fetch failed");
        }
      }

      return results;
    },

    async set(data: Record<string, Record<string, unknown>>): Promise<void> {
      return serializeVendorWrite(vendorId, async () => {
        // 1. Write to Redis
        try {
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
        } catch (err) {
          logger.warn({ err, vendorId }, "[SessionManager] Redis key pipeline failed");
        }

        // 2. Persist to PostgreSQL durable storage in batches
        try {
          for (const [type, entries] of Object.entries(data)) {
            for (const [id, value] of Object.entries(entries)) {
              if (value == null) {
                await sql`
                  DELETE FROM vendor_baileys_keys
                  WHERE vendor_id = ${vendorId}::uuid AND key_type = ${type} AND key_id = ${id}
                `.catch(() => {});
              } else {
                const serialized = JSON.stringify(value, BufferJSON.replacer);
                await sql`
                  INSERT INTO vendor_baileys_keys (vendor_id, key_type, key_id, key_data, updated_at)
                  VALUES (${vendorId}::uuid, ${type}, ${id}, ${serialized}, now())
                  ON CONFLICT (vendor_id, key_type, key_id)
                  DO UPDATE SET key_data = ${serialized}, updated_at = now()
                `.catch(() => {});
              }
            }
          }
        } catch (err) {
          logger.warn({ err, vendorId }, "[SessionManager] PostgreSQL key write failed");
        }
      });
    },
  };
}

// ─── Retry helper ────────────────────────────────────────────────────────────
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
      const delay = baseDelayMs * attempt;
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
  personal_number: string;
  auto_status_enabled: boolean;
  posting_frequency_hours: number;
  approve_before_post: boolean;
}

export async function loadVendorConfig(vendorId: string): Promise<VendorConfig> {
  const rows = await sql<VendorConfig[]>`
    SELECT v.id, v.merchant_id, v.business_line_number,
           COALESCE(v.personal_number, m.contact_phone) as personal_number,
           v.auto_status_enabled, v.posting_frequency_hours,
           v.approve_before_post
    FROM vendors v
    LEFT JOIN merchants m ON m.id = v.merchant_id
    WHERE v.id = ${vendorId}::uuid OR v.merchant_id = ${vendorId}::uuid
    LIMIT 1
  `;
  if (!rows[0]) throw new Error(`Vendor ${vendorId} not found`);
  return rows[0];
}

export async function getOrCreateVendorByPhone(phoneNumber: string, merchantId?: string): Promise<VendorConfig> {
  const cleanPhone = phoneNumber.replace(/^\+/, "").replace(/\s/g, "");

  const existing = await sql<VendorConfig[]>`
    SELECT id, merchant_id, business_line_number, personal_number,
           auto_status_enabled, posting_frequency_hours,
           approve_before_post
    FROM vendors
    WHERE business_line_number = ${cleanPhone} 
       OR personal_number = ${cleanPhone}
       ${merchantId ? sql`OR merchant_id = ${merchantId}::uuid` : sql``}
    LIMIT 1
  `;
  if (existing[0]) {
    return existing[0];
  }

  let targetMerchantId = merchantId;
  if (!targetMerchantId) {
    const existingMerchant = await sql<{ id: string }[]>`
      SELECT id FROM merchants 
      WHERE phone_number_id = ${cleanPhone} 
         OR contact_phone = ${cleanPhone} 
         OR support_phone = ${cleanPhone} 
      LIMIT 1
    `;
    targetMerchantId = existingMerchant[0]?.id;
  }

  if (!targetMerchantId) {
    const merchantRows = await sql<{ id: string }[]>`
      INSERT INTO merchants (
        name, phone_number_id, contact_phone, dialect, tone_guide
      ) VALUES (
        ${`Store +${cleanPhone}`}, ${cleanPhone}, ${cleanPhone}, 'pidgin',
        'Warm, respectful Nigerian merchant. Fast, polite, no-nonsense.'
      )
      RETURNING id
    `;
    targetMerchantId = merchantRows[0].id;

    await sql`
      INSERT INTO merchant_pricing_rules (
        merchant_id, max_discount_pct, bundle_discount_pct, loyalty_discount_pct,
        floor_margin_pct, bulk_threshold_units, payment_method_discounts, dynamic_pricing_enabled
      ) VALUES (
        ${targetMerchantId}, 0.20, 0.10, 0.15,
        0.10, 3, '{"transfer": 0.05, "card": 0.0}'::jsonb, true
      )
      ON CONFLICT (merchant_id) DO NOTHING
    `;
  }

  const vendorRows = await sql<VendorConfig[]>`
    INSERT INTO vendors (
      merchant_id, business_line_number, personal_number,
      session_status, auto_status_enabled, posting_frequency_hours, approve_before_post
    ) VALUES (
      ${targetMerchantId}, ${cleanPhone}, ${cleanPhone},
      'pending', false, 24, false
    )
    RETURNING id, merchant_id, business_line_number, personal_number,
              auto_status_enabled, posting_frequency_hours,
              approve_before_post
  `;

  logger.info({ phone: cleanPhone, vendorId: vendorRows[0].id, merchantId: targetMerchantId }, "Auto-provisioned new merchant and vendor");
  return vendorRows[0];
}

// ─── Session Lifecycle ────────────────────────────────────────────────────────

// Cached Baileys version (refreshed every 24h) to avoid hitting GitHub/npm on every socket restart
let cachedBaileysVersion: { version: [number, number, number]; isLatest: boolean; fetchedAt: number } | null = null;

async function getCachedBaileysVersion(): Promise<{ version: [number, number, number]; isLatest: boolean }> {
  const now = Date.now();
  if (cachedBaileysVersion && now - cachedBaileysVersion.fetchedAt < 24 * 60 * 60 * 1000) {
    return { version: cachedBaileysVersion.version, isLatest: cachedBaileysVersion.isLatest };
  }
  try {
    const result = await fetchLatestBaileysVersion();
    cachedBaileysVersion = { ...result, fetchedAt: now };
    logger.info({ version: result.version, isLatest: result.isLatest }, "[SessionManager] Fetched latest Baileys version");
    return result;
  } catch (err) {
    logger.warn({ err }, "[SessionManager] fetchLatestBaileysVersion failed — using fallback/cached version");
    if (cachedBaileysVersion) {
      return { version: cachedBaileysVersion.version, isLatest: cachedBaileysVersion.isLatest };
    }
    // Hardcoded fallback stable WhatsApp Web version if registry unreachable
    return { version: [2, 3000, 1015901307], isLatest: false };
  }
}

export async function createSession(vendorId: string, isPairing = false): Promise<WASocket | null> {
  if (sessions.has(vendorId)) {
    return sessions.get(vendorId)!;
  }

  clearReconnectTimer(vendorId);

  const isPairingWindow = (pairingActiveUntil.get(vendorId) ?? 0) > Date.now();
  const effectiveIsPairing = isPairing || isPairingWindow || pendingPairingRestart.has(vendorId);

  let existingCreds = credsCache.get(vendorId);
  if (!existingCreds) {
    existingCreds = await loadCredsFromRedis(vendorId);
  }
  if (existingCreds && !existingCreds.noiseKey) {
    existingCreds = undefined;
  }
  const creds = existingCreds || initAuthCreds();
  credsCache.set(vendorId, creds);

  if (!creds.registered && !effectiveIsPairing) {
    logger.info({ vendorId }, "Unregistered vendor, skipping boot to prevent zombie socket.");
    return null;
  }

  const keyStore = buildKeyStore(vendorId);

  const { version } = await getCachedBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: {
      creds,
      keys: makeCacheableSignalKeyStore(keyStore as any, logger),
    },
    logger: P({ level: "silent" }) as any,
    printQRInTerminal: false,
    browser: ["Ubuntu", "Chrome", "22.04.4"],
    connectTimeoutMs: 60_000,
    keepAliveIntervalMs: 25_000,
    markOnlineOnConnect: true,
    msgRetryCounterCache: globalRetryCounterCache,
    maxMsgRetryCount: 5,
    retryRequestDelayMs: 500,
    getMessage: async (key) => {
      // Baileys needs this to decrypt retries and polls.
      // Must return undefined on cache miss (never empty object) to avoid retry loops.
      if (!key?.id) return undefined;
      try {
        const raw = await redis.get(`msg_cache:${key.id}`);
        if (!raw) return undefined;
        return JSON.parse(raw, BufferJSON.reviver);
      } catch {
        return undefined;
      }
    },
  });

  const vendor = await loadVendorConfig(vendorId).catch(() => null);

  // Key strictly by vendorId in the sessions registry
  sessions.set(vendorId, sock);
  if (vendor?.merchant_id) {
    merchantToVendor.set(vendor.merchant_id, vendorId);
  }

  // ── Always persist creds updates ───────────────────────────────────────────
  sock.ev.on("creds.update", async (update) => {
    const full = credsCache.get(vendorId) ?? creds;
    const merged = { ...full, ...update } as AuthenticationCreds;
    credsCache.set(vendorId, merged);
    await saveCredsToRedis(vendorId, merged);
  });

  // ── Connection lifecycle ──────────────────────────────────────────────────
  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === "close") {
      const boomError = lastDisconnect?.error as Boom | undefined;
      const statusCode =
        boomError?.output?.statusCode ??
        (lastDisconnect?.error as any)?.statusCode ??
        (lastDisconnect?.error as any)?.code;

      const isLoggedOut = statusCode === DisconnectReason.loggedOut || statusCode === 401;
      const isForbidden = statusCode === (DisconnectReason as any).forbidden || statusCode === 403;
      const isBadSession = statusCode === DisconnectReason.badSession || statusCode === 500;
      const isRestartRequired = statusCode === DisconnectReason.restartRequired || statusCode === 515;
      const isConnectionReplaced = statusCode === DisconnectReason.connectionReplaced || statusCode === 440;
      const isMultideviceMismatch = statusCode === DisconnectReason.multideviceMismatch || statusCode === 411;

      let failureMessage = "";
      if (isLoggedOut) {
        failureMessage = "WhatsApp session logged out or unlinked from phone (401).";
      } else if (isForbidden) {
        failureMessage = "WhatsApp account banned or forbidden by Meta (403).";
      } else if (isBadSession) {
        failureMessage = "Corrupt or invalid session detected (500). Please generate a fresh pairing code.";
      } else if (isConnectionReplaced) {
        failureMessage = "WhatsApp connection replaced (440) — session opened elsewhere.";
      } else if (isMultideviceMismatch) {
        failureMessage = "WhatsApp multi-device mismatch (411). Re-syncing session...";
      } else if (statusCode === 405) {
        failureMessage = "WhatsApp pairing rejected (405). The pairing code may have expired.";
      } else if (statusCode === 408) {
        failureMessage = "WhatsApp connection timed out (408). Retrying...";
      } else if (statusCode === 428) {
        failureMessage = "WhatsApp connection closed by server (428). Reconnecting...";
      } else if (lastDisconnect?.error) {
        failureMessage = (lastDisconnect.error as Error).message || `Connection closed with code ${statusCode}`;
      }

      logger.warn({ vendorId, statusCode, failureMessage }, "[SessionManager] Connection closed");

      if (failureMessage) {
        lastSessionError.set(vendorId, failureMessage);
        await redis.setex(`baileys:last_error:${vendorId}`, 3600, failureMessage).catch(() => {});
        await sql`
          UPDATE vendors
          SET last_error = ${failureMessage}, updated_at = now()
          WHERE id = ${vendorId}::uuid
        `.catch(() => {});
      }

      // Clean up socket instance and registry.
      // Remove all listeners first so end() does not trigger recursive close events.
      clearReconnectTimer(vendorId);
      sessions.delete(vendorId);
      if (vendor?.merchant_id) {
        merchantToVendor.delete(vendor.merchant_id);
      }
      try {
        sock.ev.removeAllListeners("connection.update");
        sock.ev.removeAllListeners("creds.update");
        sock.ev.removeAllListeners("messages.upsert");
        sock.ev.removeAllListeners("presence.update");
        sock.end(undefined);
      } catch {}

      // 1. FATAL STATES: 401 (logged out), 403 (banned/forbidden), 500 (bad session)
      if (isLoggedOut || isForbidden || isBadSession) {
        pairingActiveUntil.delete(vendorId);
        pendingPairingRestart.delete(vendorId);
        credsCache.delete(vendorId);
        reconnectAttempts.delete(vendorId);
        consecutiveConflictCount.delete(vendorId);

        await redis.del(`baileys:creds:${vendorId}`).catch(() => {});
        const keys = await redis.keys(`baileys:keys:${vendorId}:*`).catch(() => []);
        if (keys.length > 0) await redis.del(...keys).catch(() => {});

        await sql`
          DELETE FROM vendor_baileys_keys WHERE vendor_id = ${vendorId}::uuid
        `.catch(() => {});

        await sql`
          UPDATE vendors
          SET session_status = 'logged_out', auth_creds = NULL, updated_at = now()
          WHERE id = ${vendorId}::uuid
        `.catch(() => {});

        await alertVendorReprovision(vendorId).catch(err =>
          logger.warn({ err, vendorId }, "[SessionManager] alertVendorReprovision failed")
        );
        return;
      }

      // 2. 440 CONFLICT (connectionReplaced): Anti-Thrashing Guard
      if (isConnectionReplaced) {
        const conflicts = (consecutiveConflictCount.get(vendorId) ?? 0) + 1;
        consecutiveConflictCount.set(vendorId, conflicts);

        await sql`
          UPDATE vendors
          SET session_status = 'conflict', updated_at = now()
          WHERE id = ${vendorId}::uuid
        `.catch(() => {});

        if (conflicts > 3) {
          const conflictMsg = "Halting auto-reconnect: 3 consecutive 440 conflicts detected. Session opened elsewhere.";
          logger.error({ vendorId, conflicts }, `[SessionManager] ${conflictMsg}`);
          lastSessionError.set(vendorId, conflictMsg);
          await redis.setex(`baileys:last_error:${vendorId}`, 3600, conflictMsg).catch(() => {});
          await sql`
            UPDATE vendors
            SET session_status = 'conflict', last_error = ${conflictMsg}, updated_at = now()
            WHERE id = ${vendorId}::uuid
          `.catch(() => {});
          return;
        }

        // Backoff heavily (30s * conflict count) to allow external session to stabilize
        const delayMs = 30_000 * conflicts;
        logger.info({ vendorId, conflicts, delayMs }, "[SessionManager] Pacing 440 reconnect delay");
        scheduleReconnect(vendorId, delayMs);
        return;
      }

      // 3. 411 MULTIDEVICE MISMATCH: Invalidate local cache and re-sync
      if (isMultideviceMismatch) {
        credsCache.delete(vendorId);
      }

      // Update DB to reflect reconnecting state
      await sql`
        UPDATE vendors
        SET session_status = 'reconnecting', updated_at = now()
        WHERE id = ${vendorId}::uuid
      `.catch(() => {});

      // 4. 515 (restartRequired) or Active Pairing Window: Reconnect immediately
      const isPairingActive = (pairingActiveUntil.get(vendorId) ?? 0) > Date.now();
      if (isRestartRequired || isPairingActive) {
        if (!isPairingActive) {
          pendingPairingRestart.delete(vendorId);
        }
        logger.info({ vendorId, isRestartRequired, isPairingActive }, "Restart required or pairing active — reconnecting immediately");
        scheduleReconnect(vendorId, 250, true);
        return;
      }

      // 5. TRANSIENT DISCONNECT (408, 428, network drop): Exponential Backoff
      const attempts = reconnectAttempts.get(vendorId) ?? 0;
      // Cap backoff at 60 seconds
      const delayMs = Math.min(1000 * 2 ** attempts, 60_000);
      reconnectAttempts.set(vendorId, attempts + 1);

      if (attempts >= 10) {
        await sql`
          UPDATE vendors
          SET session_status = 'disconnected', last_error = 'Connection failed repeatedly. Reconnecting gently...', updated_at = now()
          WHERE id = ${vendorId}::uuid
        `.catch(() => {});
      }

      logger.info({ vendorId, attempt: attempts + 1, delayMs }, "Reconnecting Baileys session");
      scheduleReconnect(vendorId, delayMs);
    }

    if (connection === "open") {
      clearReconnectTimer(vendorId);
      consecutiveConflictCount.delete(vendorId);
      pairingActiveUntil.delete(vendorId);
      pendingPairingRestart.delete(vendorId);
      lastSessionError.delete(vendorId);
      await redis.del(`baileys:last_error:${vendorId}`).catch(() => {});
      reconnectAttempts.set(vendorId, 0);

      sessions.set(vendorId, sock);
      const vendorCfg = await loadVendorConfig(vendorId).catch(() => null);
      if (vendorCfg?.merchant_id) {
        merchantToVendor.set(vendorCfg.merchant_id, vendorId);
        logger.info({ vendorId, merchantId: vendorCfg.merchant_id }, "Mapped merchantId to vendor session");
      }

      await sql`
        UPDATE vendors SET session_status = 'connected', last_error = NULL, updated_at = now()
        WHERE id = ${vendorId}::uuid
      `.catch(err => logger.warn({ err }, "[SessionManager] Non-critical DB update failed"));
      logger.info({ vendorId }, "Baileys session connected successfully");

      // Onboarding welcome notification
      const lockKey = `vendor:${vendorId}:onboarding_cooldown`;
      const isCooldown = await redis.get(lockKey);

      if (!isCooldown) {
        let targetPhone = vendorCfg?.personal_number || "";
        let ownerName = "";
        let businessName = "your store";

        if (vendorCfg?.merchant_id) {
          try {
            const mRows = await sql<{ name: string; owner_first_name: string; contact_phone: string; phone_number_id: string }[]>`
              SELECT name, owner_first_name, contact_phone, phone_number_id
              FROM merchants
              WHERE id = ${vendorCfg.merchant_id}
              LIMIT 1
            `;
            if (mRows[0]) {
              businessName = mRows[0].name || businessName;
              ownerName = mRows[0].owner_first_name || "";
              if (!targetPhone) {
                targetPhone = mRows[0].contact_phone || mRows[0].phone_number_id || "";
              }
            }
          } catch {}
        }
        const greetingName = ownerName || businessName;

        const welcomeText =
          `👋 Hello ${greetingName}! I am Biblio, your autonomous commerce assistant.\n\n` +
          `Your WhatsApp is now linked and active. Here is how I work for you 24/7:\n\n` +
          `1. 🛍️ Automated Sales & Negotiation: When buyers message your business line, I handle inquiries, check product stock, and negotiate discounts up to your approved limits.\n` +
          `2. 💳 Instant Zero-Deduction Settlements: For every order, I generate a Providus Virtual Account Number (VAN). Customers pay, and funds settle directly into your bank account with zero deductions.\n` +
          `3. ⚡ Store Command Center: You can chat with me right here anytime to manage your store.\n\n` +
          `Try texting me any of these commands right now:\n` +
          `• "Show my settlement account"\n` +
          `• "Show recent customer inquiries"\n` +
          `• "Add product: [Product Name] [Price]"\n` +
          `• "Generate WhatsApp status post"\n\n` +
          `I am live and ready to take sales!`;

        let targetJid = "";
        if (targetPhone) {
          let bare = targetPhone.replace(/\D/g, "");
          if (bare.startsWith("0") && bare.length === 11) {
            bare = `234${bare.slice(1)}`;
          }
          targetJid = `${bare}@s.whatsapp.net`;
        } else if (sock.user?.id) {
          targetJid = jidNormalizedUser(sock.user.id);
        }

        if (targetJid) {
          try {
            await sock.sendMessage(targetJid, { text: welcomeText });
            await redis.setex(lockKey, 300, "1");
            logger.info({ vendorId, targetJid }, "Sent Biblio Agent onboarding message to vendor");

            const merchantId = vendorCfg?.merchant_id;
            if (merchantId) {
              await sql`
                INSERT INTO merchant_agent_transcripts (merchant_id, channel, sender_role, content, metadata)
                VALUES (${merchantId}, 'whatsapp', 'agent', ${welcomeText}, ${JSON.stringify({ type: 'onboarding_welcome', timestamp: Date.now() })}::jsonb)
              `.catch(() => {});

              await redis.publish(`agent:stream:${merchantId}`, JSON.stringify({
                channel: 'whatsapp',
                sender_role: 'agent',
                content: welcomeText,
                created_at: new Date().toISOString()
              })).catch(() => {});
            }
          } catch (err) {
            logger.error({ err, vendorId, targetJid }, "Failed to send onboarding message");
          }
        }
      }
    }
  });

  // ── Presence & Typing Interception (Vendor Outranking Biblio) ──────────────
  sock.ev.on("presence.update", async ({ id, presences }) => {
    try {
      const myJid = sock.user?.id ? jidNormalizedUser(sock.user.id) : null;
      if (!myJid) return;

      const vendorPresence = presences[myJid];
      if (
        vendorPresence &&
        (vendorPresence.lastKnownPresence === "composing" ||
          vendorPresence.lastKnownPresence === "recording")
      ) {
        const chatJid = id;
        await redis.set(`presence:vendor:${vendorId}:chat:${chatJid}`, "typing", "EX", 35);
        await redis.set(`presence:vendor:${vendorId}:global`, "active", "EX", 300);

        logger.info(
          { vendorId, chatJid, presence: vendorPresence.lastKnownPresence },
          "[SessionManager] Vendor typing presence detected! Setting presence lock."
        );
      }
    } catch (presenceErr) {
      logger.warn({ presenceErr, vendorId }, "[SessionManager] Error handling presence.update");
    }
  });

  // ── Inbound Message Handling & Deduplication ───────────────────────────────
  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;

    for (const msg of messages) {
      if (!msg.message) continue;

      // Vendor manual reply detection
      if (msg.key.fromMe) {
        const remoteJid = msg.key.remoteJid;
        if (remoteJid && !remoteJid.endsWith("@g.us") && remoteJid !== "status@broadcast") {
          await redis.set(`presence:vendor:${vendorId}:chat:${remoteJid}`, "replied", "EX", 600);
          await redis.set(`presence:vendor:${vendorId}:last_manual_reply`, Date.now().toString());
          logger.info(
            { vendorId, remoteJid },
            "[SessionManager] Vendor manually replied in chat — Biblio silenced for 10 mins."
          );
        }
      }

      // Cache message content for getMessage() retry handling
      if (msg.key.id && msg.message) {
        await redis
          .setex(`msg_cache:${msg.key.id}`, 3600, JSON.stringify(msg.message, BufferJSON.replacer))
          .catch(err => logger.warn({ err }, "[SessionManager] Failed to cache inbound message"));
      }

      // Deduplicate — Baileys can re-deliver the same message ID on reconnect
      const dedupeKey = `idempotency:baileys:${msg.key.id}`;
      const isNew = await redis.set(dedupeKey, "1", "EX", 60 * 60 * 24, "NX");
      if (!isNew) {
        logger.debug({ msgId: msg.key.id }, "Duplicate Baileys message — skipping");
        continue;
      }

      try {
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

export interface PairResult {
  code: string;
  vendorId: string;
  merchantId: string;
}

export async function pairVendorNumber(phoneNumber: string, vendorId?: string, merchantId?: string): Promise<PairResult> {
  const normalised = phoneNumber.replace(/^\+/, "").replace(/\s/g, "");
  logger.info({ vendorId, merchantId, normalised }, "pairVendorNumber called");

  let vendor: VendorConfig;
  const lookupId = vendorId || merchantId;
  if (lookupId) {
    try {
      vendor = await loadVendorConfig(lookupId);
    } catch {
      vendor = await getOrCreateVendorByPhone(normalised, merchantId || vendorId);
    }
  } else {
    vendor = await getOrCreateVendorByPhone(normalised);
  }

  const effectiveVendorId = vendor.id;

  clearReconnectTimer(effectiveVendorId);
  consecutiveConflictCount.delete(effectiveVendorId);

  await sql`
    UPDATE vendors 
    SET business_line_number = ${normalised},
        session_status = 'pairing',
        last_error = NULL,
        auth_creds = NULL,
        updated_at = now()
    WHERE id = ${effectiveVendorId}::uuid
  `.catch(err => logger.warn({ err }, "[SessionManager] DB update failed"));

  await sql`
    DELETE FROM vendor_baileys_keys WHERE vendor_id = ${effectiveVendorId}::uuid
  `.catch(err => logger.warn({ err }, "[SessionManager] Failed to clear DB Signal keys"));

  credsCache.delete(effectiveVendorId);
  lastSessionError.delete(effectiveVendorId);
  if (sessions.has(effectiveVendorId)) {
    const oldSock = sessions.get(effectiveVendorId)!;
    try {
      oldSock.ev.removeAllListeners("connection.update");
      oldSock.ev.removeAllListeners("creds.update");
      oldSock.ev.removeAllListeners("messages.upsert");
      oldSock.ev.removeAllListeners("presence.update");
      oldSock.end(undefined);
    } catch {}
    sessions.delete(effectiveVendorId);
  }
  if (vendor?.merchant_id) {
    merchantToVendor.delete(vendor.merchant_id);
  }

  await redis.del(`baileys:creds:${effectiveVendorId}`);
  await redis.del(`baileys:last_error:${effectiveVendorId}`);
  const keys = await redis.keys(`baileys:keys:${effectiveVendorId}:*`);
  if (keys.length > 0) {
    await redis.del(...keys);
  }

  pairingActiveUntil.set(effectiveVendorId, Date.now() + 120_000);
  pendingPairingRestart.add(effectiveVendorId);

  const sock = await createSession(effectiveVendorId, true);
  if (!sock) throw new Error("Failed to create session");
  logger.info({ vendorId: effectiveVendorId }, "Socket created, waiting for connection handshake...");

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      logger.error({ vendorId: effectiveVendorId }, "Timeout waiting for socket to reach pairing state");
      reject(new Error("Socket did not reach pairing state in time"));
    }, 15_000);

    const handler = (update: any) => {
      logger.debug({ vendorId: effectiveVendorId, update }, "Pairing connection update");
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

export async function getSessionStatus(vendorId: string) {
  const active = sessions.has(vendorId);
  const isPairing = (pairingActiveUntil.get(vendorId) ?? 0) > Date.now();
  let lastError = lastSessionError.get(vendorId);
  if (!lastError) {
    lastError = (await redis.get(`baileys:last_error:${vendorId}`)) ?? undefined;
  }
  const rows = await sql<{ session_status: string; last_error: string | null }[]>`
    SELECT session_status, last_error FROM vendors WHERE id = ${vendorId}::uuid OR merchant_id = ${vendorId}::uuid LIMIT 1
  `.catch(() => []);

  return {
    vendorId,
    inMemory: active,
    dbStatus: rows[0]?.session_status ?? (active ? "connected" : "unknown"),
    isPairing,
    lastError: lastError || rows[0]?.last_error || null,
  };
}

// ─── Reprovision Alert ────────────────────────────────────────────────────────

async function alertVendorReprovision(vendorId: string): Promise<void> {
  const vendor = await loadVendorConfig(vendorId).catch(() => null);
  logger.error(
    { vendorId, phone: vendor?.personal_number },
    "VENDOR SESSION LOGGED OUT OR BANNED — reprovision required"
  );
}
