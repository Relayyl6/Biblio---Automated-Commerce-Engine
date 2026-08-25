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

const DEBOUNCE_MS = Number(process.env.DEBOUNCE_MS ?? 5_000); // 5s default — tune per merchant

const connection = {
  connection: { ...redis.options, maxRetriesPerRequest: null },
};

export const turnQueue = new Queue<{ customerId: string; merchantId: string }>(
  "conversation-turns",
  connection
);

export const biblioAgentQueue = new Queue<{ customerId: string; merchantId: string }>(
  "biblio-agent-turns",
  connection
);

function scratchKey(merchantId: string, customerId: string) {
  return `scratch:${merchantId}:${customerId}`;
}

function biblioScratchKey(merchantId: string, customerId: string) {
  return `scratch:biblio:${merchantId}:${customerId}`;
}

export async function enqueueBiblioAgentMessage(msg: InboundMessage): Promise<void> {
  const customerId = msg.fromPhone;
  const merchantId = msg.toPhoneNumberId;

  if (!merchantId) throw new Error("No merchantId");

  const key = biblioScratchKey(merchantId, customerId);
  await redis.rpush(key, JSON.stringify(msg));

  const bullJobId = `biblio_turn_${merchantId}_${customerId}`;
  const existing = await biblioAgentQueue.getJob(bullJobId);
  if (existing) {
    const state = await existing.getState();
    if (state === "delayed") {
      await existing.remove();
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

export const biblioWorker = new Worker<{ customerId: string; merchantId: string }>(
  "biblio-agent-turns",
  async (job: Job<{ customerId: string; merchantId: string }>) => {
    const { customerId, merchantId } = job.data;
    const key = biblioScratchKey(merchantId, customerId);

    const tx = redis.multi();
    tx.lrange(key, 0, -1);
    tx.del(key);
    const results = await tx.exec();
    const rawMessages = (results?.[0]?.[1] as string[]) ?? [];

    if (rawMessages.length === 0) return;

    const messages: InboundMessage[] = rawMessages.map((r) => JSON.parse(r));
    const turn: ConversationTurn = { customerId, merchantId, messages, orderState: { status: "no_order" } };
    await runBiblioAgentTurn(turn);
  },
  connection
);

/**
 * Called for every deduped inbound message.
 * Scoped strictly per (merchantId, customerId) for multi-vendor isolation.
 */
export async function enqueueInboundMessage(msg: InboundMessage): Promise<void> {
  const customerId = msg.fromPhone;
  const merchantId = msg.toPhoneNumberId;

  if (!merchantId) {
    throw new Error(
      `Inbound message ${msg.waMessageId} has no toPhoneNumberId (merchant/vendor ID)`
    );
  }

  // ── Source Reply Detection ──────────────────────────────────────────────────
  // If the message is from a known source, it routes differently (no debounce,
  // directly unpauses the customer arc).
  const sourceRows = await sql<{id: string, name: string, pricing_rules: any}[]>`
    SELECT id, name, pricing_rules FROM sources 
    WHERE contact = ${customerId} AND merchant_id = ${merchantId} AND active = true 
    LIMIT 1
  `;
  if (sourceRows.length > 0) {
    const handled = await handleSourceReply(msg, sourceRows[0]);
    if (handled) return;
  }
  // ────────────────────────────────────────────────────────────────────────────

  // Push raw message onto this merchant-customer conversation buffer
  const key = scratchKey(merchantId, customerId);
  await redis.rpush(key, JSON.stringify(msg));

  // Upsert customer-merchant link asynchronously
  sql`
    INSERT INTO customer_merchant_links (customer_id, merchant_id)
    VALUES (${customerId}, ${merchantId})
    ON CONFLICT DO NOTHING
  `.catch(() => {});

  // Sliding debounce: unique per (merchantId, customerId)
  const bullJobId = `turn_${merchantId}_${customerId}`;
  const existing = await turnQueue.getJob(bullJobId);
  if (existing) {
    const state = await existing.getState();
    if (state === "delayed") {
      await existing.remove();
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

    const turn: ConversationTurn = { customerId, merchantId, messages, orderState };
    await runNegotiatorTurn(turn);
  },
  connection
);

async function loadOrderState(customerId: string, merchantId: string): Promise<OrderState> {
  const rows = await sql<{ state: OrderState }[]>`
    select state from orders
    where customer_id = ${customerId} and merchant_id = ${merchantId}
      and state->>'status' not in ('delivered', 'cancelled')
    order by updated_at desc
    limit 1
  `;
  return rows[0]?.state ?? { status: "no_order" };
}