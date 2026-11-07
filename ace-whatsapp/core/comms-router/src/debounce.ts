import { logger } from "@ace/shared/logger.js";
// core/comms-router/src/debounce.ts
//
// THE PROBLEM THIS SOLVES (from our earlier discussion): a customer sends
// "hey", then 2 seconds later "I need that black gown", then 3 seconds
// later "the one from your IG post". Naively, that's 3 separate triggers
// to the LLM, 3 separate replies, and a confusing customer experience.
//
// THE PATTERN: "debounce with a sliding window via job replacement."
//   - Every inbound message gets pushed onto a per-customer Redis list
//     (the "scratch buffer").
//   - We also try to schedule a delayed BullMQ job, keyed by customerId,
//     to fire DEBOUNCE_MS from now.
//   - If a delayed job for this customerId ALREADY exists, we remove it
//     and re-add it — resetting the timer. This is the "sliding window":
//     as long as messages keep arriving faster than DEBOUNCE_MS apart,
//     the job never fires.
//   - When the customer finally goes quiet for DEBOUNCE_MS, the job
//     fires, the worker drains the scratch buffer, and THAT'S the
//     ConversationTurn handed to ai-negotiator.
//
// WHY BULLMQ over a raw `setTimeout`: setTimeout lives in process memory.
// If ingestion-service restarts (deploy, crash) mid-debounce, you lose the
// timer and that customer's turn never fires. BullMQ persists the delayed
// job in Redis — survives restarts, and lets you run multiple
// comms-router instances without double-processing (BullMQ's locking
// ensures one worker picks up each job).
//
// TRADE-OFF WORTH KNOWING: this means a "turn" can wait up to DEBOUNCE_MS
// even for a single, complete message (worst case: customer sends one
// message and goes silent — they wait the full window for a reply). 30s
// is what the BIBLO doc proposes; for an MVP I'd start at 8-12s. Tune
// based on real usage — this is a UX knob, not an architecture one.

import { Queue, Worker, type Job } from "bullmq";
import { redis, sql } from "@ace/shared/clients";
import type { InboundMessage, ConversationTurn, OrderState } from "@ace/shared/types";
import { runNegotiatorTurn } from "../../ai-negotiator/src/agentLoop";
import { runBiblioAgentTurn } from "../../ai-negotiator/src/biblioAgentLoop";
import { handleSourceReply } from "./sourceReplyHandler.js";
import { identityEngine } from "@ace/shared/identity-resolution/index.js";

const DEBOUNCE_MS = Number(process.env.DEBOUNCE_MS ?? 5_000); // 5s default — tune per merchant

const defaultConnection = {
  connection: { host: redis.options.host || "127.0.0.1", port: redis.options.port || 6381, maxRetriesPerRequest: null }
};

export const turnQueue = new Queue<{ customerId: string; merchantId: string }>(
  "conversation-turns",
  defaultConnection
);

export const biblioAgentQueue = new Queue<{ customerId: string; merchantId: string }>(
  "biblio-agent-turns",
  defaultConnection
);

const workerConnection = defaultConnection;

function scratchKey(merchantId: string, customerId: string) {
  return `scratch:${merchantId}:${customerId}`;
}

function biblioScratchKey(merchantId: string, customerId: string) {
  return `scratch:biblio:${merchantId}:${customerId}`;
}

async function resolveToUuid(merchantId: string): Promise<string | null> {
  if (!merchantId) return null;
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(merchantId);
  if (isUuid) return merchantId;
  const rows = await sql<{ id: string }[]>`
    SELECT id FROM merchants 
    WHERE phone_number_id = ${merchantId} OR contact_phone = ${merchantId}
    LIMIT 1
  `.catch(() => []);
  return rows[0]?.id ?? null;
}

export async function enqueueBiblioAgentMessage(msg: InboundMessage): Promise<void> {
  const customerId = msg.fromPhone;
  const rawMerchantId = msg.merchantId || msg.toPhoneNumberId;

  if (!rawMerchantId) throw new Error("No merchantId");
  const resolvedUuid = await resolveToUuid(rawMerchantId);
  const merchantId = resolvedUuid || rawMerchantId;

  const key = biblioScratchKey(merchantId, customerId);
  await redis.rpush(key, JSON.stringify(msg));

  const bullJobId = `biblio_turn_${merchantId}_${customerId}`;
  const existing = await biblioAgentQueue.getJob(bullJobId);
  if (existing) {
    const state = await existing.getState();
    if (state !== "active") {
      try {
        await existing.remove();
      } catch (err) {
        logger.debug("[Debounce] Could not remove existing biblio job", { jobId: bullJobId, err });
      }
    }
  }

  await biblioAgentQueue.add(
    "process-biblio-turn",
    { customerId, merchantId },
    {
      jobId: bullJobId,
      delay: DEBOUNCE_MS,
      removeOnComplete: true,
      removeOnFail: true,
    }
  );
}

/**
 * Evaluates whether Biblio should take a conversation turn or yield to vendor presence / killswitches / settings.
 * Single source of truth evaluation: presence schedule, SLA, grace windows, Cover Me, Hands Off,
 * allow/deny lists, personal contact pre-authorizations, and the 6 veto layers.
 */
export async function shouldBiblioTakeTurn(
  merchantId: string,
  customerId: string
): Promise<{ proceed: boolean; reason?: string }> {
  try {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(merchantId);
    let resolvedId = isUuid ? merchantId : await resolveToUuid(merchantId);
    if (!resolvedId) return { proceed: true };

    // 1. Hands-off (per-chat silence / Layer 5 Veto)
    const cachedHandsOff = await redis.get(`killswitch:chat:${resolvedId}:${customerId}`);
    if (cachedHandsOff) return { proceed: false, reason: "chat_killswitch_active" };

    const overrideRows = await sql<{ hands_off: boolean }[]>`
      SELECT hands_off FROM chat_overrides
      WHERE merchant_id = ${resolvedId}::uuid AND chat_id = ${customerId}
      LIMIT 1
    `.catch(() => []);
    if (overrideRows[0]?.hands_off) {
      await redis.set(`killswitch:chat:${resolvedId}:${customerId}`, "1").catch(() => {});
      return { proceed: false, reason: "chat_killswitch_active" };
    }

    // 2. Global pause / killswitch (Layer 6 Veto)
    const globalPause = await redis.get(`killswitch:global:${resolvedId}`);
    if (globalPause) return { proceed: false, reason: "global_killswitch_active" };

    // 3. Personal-Contact Pre-Authorizations & Chat Classification
    const classRows = await sql<{ vendor_override: string | null; classification: string }[]>`
      SELECT vendor_override, classification FROM chat_classifications
      WHERE merchant_id = ${resolvedId}::uuid AND chat_id = ${customerId}
      LIMIT 1
    `.catch(() => []);

    if (classRows.length > 0) {
      const { vendor_override, classification } = classRows[0];
      if (vendor_override === 'personal' || vendor_override === 'ignore' || (!vendor_override && classification === 'personal')) {
        return { proceed: false, reason: "personal_contact_pre_authorized" };
      }
    }

    // 4. Deny List & Allow List
    const merchantRows = await sql<{
      deny_list: any;
      allow_list: any;
      operating_hours: any;
    }[]>`
      SELECT deny_list, allow_list, operating_hours
      FROM merchants
      WHERE id = ${resolvedId}::uuid
      LIMIT 1
    `.catch(() => []);

    const m = merchantRows[0];
    if (m) {
      let denyList: string[] = [];
      if (typeof m.deny_list === 'string') {
        try { denyList = JSON.parse(m.deny_list); } catch { denyList = []; }
      } else if (Array.isArray(m.deny_list)) {
        denyList = m.deny_list;
      }

      if (denyList.some((denied) => customerId.includes(denied) || denied.includes(customerId))) {
        return { proceed: false, reason: "sender_in_deny_list" };
      }
    }

    // 5. Vendor Presence & Cover Me
    const presenceRows = await sql<{
      state: string;
      cover_me: boolean;
      sla_minutes: number;
      read_grace_minutes: number;
      last_active_at: string;
    }[]>`
      SELECT state, cover_me, sla_minutes, read_grace_minutes, last_active_at
      FROM vendor_presence
      WHERE merchant_id = ${resolvedId}::uuid
      LIMIT 1
    `.catch(() => []);

    const presence = presenceRows[0];

    // Cover Me overrides everything else (Instant Biblio duty)
    const cachedCoverMe = await redis.get(`vendor:cover_me:${resolvedId}`);
    if (cachedCoverMe === "1" || presence?.cover_me) {
      return { proceed: true, reason: "cover_me_active" };
    }

    if (presence?.state === 'off') {
      return { proceed: false, reason: "global_killswitch_active" };
    }

    // 6. Live Barge-In (Layer 2 Veto: Vendor Typing or Recent Manual Reply)
    const vendorPresence = await redis.get(`presence:vendor:${resolvedId}:chat:${customerId}`);
    if (vendorPresence === "typing" || vendorPresence === "recording") {
      return { proceed: false, reason: "vendor_typing_in_chat" };
    }
    if (vendorPresence === "replied") {
      return { proceed: false, reason: "vendor_recently_replied" };
    }

    // 7. Read Grace Window Check
    const readGraceMinutes = presence?.read_grace_minutes ?? 5;
    const readReceiptTimestamp = await redis.get(`presence:read:${resolvedId}:${customerId}`);
    if (readReceiptTimestamp) {
      const readElapsedMs = Date.now() - Number(readReceiptTimestamp);
      if (readElapsedMs < readGraceMinutes * 60 * 1000) {
        return { proceed: false, reason: "vendor_in_read_grace_window" };
      }
    }

    // 8. Presence Schedule & SLA Window
    if (presence?.state === 'present') {
      const slaMinutes = presence?.sla_minutes ?? 10;
      const lastInboundTimestamp = await redis.get(`last_inbound_time:${resolvedId}:${customerId}`);
      if (lastInboundTimestamp) {
        const elapsedMinutes = (Date.now() - Number(lastInboundTimestamp)) / (60 * 1000);
        if (elapsedMinutes < slaMinutes) {
          return { proceed: false, reason: "vendor_within_sla_window" };
        }
      } else {
        return { proceed: false, reason: "vendor_presence_mode_present" };
      }
    }

    return { proceed: true };
  } catch (err) {
    logger.warn("[Debounce] Presence check error, defaulting to proceed", { err, merchantId, customerId });
    return { proceed: true };
  }
}

export const biblioWorker = new Worker<{ customerId: string; merchantId: string }>(
  "biblio-agent-turns",
  async (job: Job<{ customerId: string; merchantId: string }>) => {
    const { customerId, merchantId } = job.data;

    // Presence Gate: Yield if vendor is actively typing, replied, or present
    const gate = await shouldBiblioTakeTurn(merchantId, customerId);
    if (!gate.proceed) {
      logger.info("[BiblioWorker] Yielding turn — Vendor presence outranks Biblio", { customerId, merchantId, reason: gate.reason });
      return;
    }

    const key = biblioScratchKey(merchantId, customerId);

    const tx = redis.multi();
    tx.lrange(key, 0, -1);
    tx.del(key);
    const results = await tx.exec();
    const rawMessages = (results?.[0]?.[1] as string[]) ?? [];

    if (rawMessages.length === 0) return;

    const messages: InboundMessage[] = rawMessages.map((r) => JSON.parse(r));
    const turn: ConversationTurn = { customerId, merchantId, messages, orderState: { status: "no_order" } };
    try {
      await runBiblioAgentTurn(turn);
    } catch (turnErr) {
      logger.error("[BiblioWorker] Error processing biblio agent turn:", turnErr);
    }

    // Check if new burst messages arrived while worker was executing
    const remaining = await redis.llen(key);
    if (remaining > 0) {
      const bullJobId = `biblio_turn_${merchantId}_${customerId}`;
      await biblioAgentQueue.add(
        "process-biblio-turn",
        { customerId, merchantId },
        {
          jobId: bullJobId,
          delay: DEBOUNCE_MS,
          removeOnComplete: true,
          removeOnFail: true,
        }
      );
    }
  },
  workerConnection
);

/**
 * Called for every deduped inbound message.
 * Scoped strictly per (merchantId, customerId) for multi-vendor isolation.
 */
export async function enqueueInboundMessage(msg: InboundMessage): Promise<void> {
  const customerId = msg.fromPhone;
  const rawMerchantId = msg.merchantId || msg.toPhoneNumberId;

  if (!rawMerchantId) {
    throw new Error(
      `Inbound message ${msg.waMessageId} has no toPhoneNumberId (merchant/vendor ID)`
    );
  }

  const resolvedUuid = await resolveToUuid(rawMerchantId);
  const merchantId = resolvedUuid || rawMerchantId;

  // ── Source Reply Detection ──────────────────────────────────────────────────
  // If the message is from a known source, it routes differently (no debounce,
  // directly unpauses the customer arc).
  const sourceRows = resolvedUuid ? await sql<{id: string, name: string, pricing_rules: any}[]>`
    SELECT id, name, pricing_rules FROM sources 
    WHERE contact = ${customerId} AND merchant_id = ${resolvedUuid}::uuid AND active = true 
    LIMIT 1
  `.catch(() => []) : [];
  if (sourceRows.length > 0) {
    const handled = await handleSourceReply(msg, sourceRows[0]);
    if (handled) return;
  }
  // ────────────────────────────────────────────────────────────────────────────

  // Push raw message onto this merchant-customer conversation buffer
  const key = scratchKey(merchantId, customerId);
  await redis.rpush(key, JSON.stringify(msg));

  // Upsert customer-merchant link asynchronously
  if (resolvedUuid) {
    sql`
      INSERT INTO customer_merchant_links (customer_id, merchant_id)
      VALUES (${customerId}, ${resolvedUuid}::uuid)
      ON CONFLICT DO NOTHING
    `.catch(err => logger.error("[Debounce] Non-critical telemetry emit failed", err));
  }
  identityEngine.resolveBuyerIdentity(customerId, merchantId).catch(() => {});

  // Sliding debounce: unique per (merchantId, customerId)
  const bullJobId = `turn_${merchantId}_${customerId}`;
  const existing = await turnQueue.getJob(bullJobId);
  if (existing) {
    const state = await existing.getState();
    if (state !== "active") {
      try {
        await existing.remove();
      } catch (err) {
        logger.debug("[Debounce] Could not remove existing turn job", { jobId: bullJobId, err });
      }
    }
  }

  await turnQueue.add(
    "process-turn",
    { customerId, merchantId },
    {
      jobId: bullJobId,
      delay: DEBOUNCE_MS,
      removeOnComplete: true,
      removeOnFail: true,
    }
  );
}

/**
 * Worker: fires once the debounce window closes for a specific (merchant, customer) pair.
 */
export const turnWorker = new Worker<{ customerId: string; merchantId: string }>(
  "conversation-turns",
  async (job: Job<{ customerId: string; merchantId: string }>) => {
    const { customerId, merchantId } = job.data;

    // Presence Gate: Yield if vendor is actively typing, replied, or present
    const gate = await shouldBiblioTakeTurn(merchantId, customerId);
    if (!gate.proceed) {
      logger.info("[TurnWorker] Yielding turn — Vendor presence outranks Biblio", { customerId, merchantId, reason: gate.reason });
      return;
    }
    const key = scratchKey(merchantId, customerId);

    // Atomically read-and-clear the buffer
    const tx = redis.multi();
    tx.lrange(key, 0, -1);
    tx.del(key);
    const results = await tx.exec();
    const rawMessages = (results?.[0]?.[1] as string[]) ?? [];

    if (rawMessages.length === 0) {
      return;
    }

    const messages: InboundMessage[] = rawMessages.map((r) => JSON.parse(r));
    const orderState = await loadOrderState(customerId, merchantId);

    const { downloadWhatsAppMedia } = await import('./whatsapp.js');
    
    for (const msg of messages) {
      if (msg.content.type === 'image' && msg.content.mediaId && !msg.content.base64) {
        const media = await downloadWhatsAppMedia(msg.content.mediaId, merchantId);
        if (media) {
          msg.content.base64 = media.base64;
          msg.content.mimeType = media.mimeType;
        }
      } else if (msg.content.type === 'audio' && msg.content.mediaId && !msg.content.transcript) {
        const media = await downloadWhatsAppMedia(msg.content.mediaId, merchantId);
        if (media?.base64) {
          try {
            const audioBuf = Buffer.from(media.base64, 'base64');
            const { transcribeBuffer } = await import('../../baileys-gateway/src/mediaProcessor.js');
            const transcript = await transcribeBuffer(audioBuf);
            if (transcript) {
              msg.content.transcript = transcript;
              logger.info('[debounce] Meta Cloud voice note transcribed via Whisper', { mediaId: msg.content.mediaId });
            }
          } catch (transcribeErr) {
            logger.warn('[debounce] Failed to transcribe Meta audio note', { transcribeErr, mediaId: msg.content.mediaId });
          }
        }
      }
    }

    const turn: ConversationTurn = { customerId, merchantId, messages, orderState };
    try {
      await runNegotiatorTurn(turn);
    } catch (turnErr) {
      logger.error("[TurnWorker] Error running negotiator turn:", turnErr);
    }

    // Check if new burst messages arrived while negotiator was thinking
    const remaining = await redis.llen(key);
    if (remaining > 0) {
      const bullJobId = `turn_${merchantId}_${customerId}`;
      await turnQueue.add(
        "process-turn",
        { customerId, merchantId },
        {
          jobId: bullJobId,
          delay: DEBOUNCE_MS,
          removeOnComplete: true,
          removeOnFail: true,
        }
      );
    }
  },
  workerConnection
);

async function loadOrderState(customerId: string, merchantId: string): Promise<OrderState> {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(merchantId);
  if (!isUuid) return { status: "no_order" };
  const rows = await sql<{ state: OrderState }[]>`
    select state from orders
    where customer_id = ${customerId} and merchant_id = ${merchantId}::uuid
      and state->>'status' not in ('delivered', 'cancelled')
    order by updated_at desc
    limit 1
  `.catch(() => []);
  return rows[0]?.state ?? { status: "no_order" };
}
biblioWorker.on("error", (err) => logger.error("[BiblioWorker] Redis error:", err));
biblioWorker.on("failed", (job, err) => logger.error(`[BiblioWorker] Job ${job?.id} failed:`, err));

turnWorker.on("error", (err) => logger.error("[TurnWorker] Redis error:", err));
turnWorker.on("failed", (job, err) => logger.error(`[TurnWorker] Job ${job?.id} failed:`, err));

