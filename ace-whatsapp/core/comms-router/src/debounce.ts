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

const DEBOUNCE_MS = Number(process.env.DEBOUNCE_MS ?? 10_000);

// BullMQ needs its OWN connection options, not the shared client's. Two things
// matter here:
//   - maxRetriesPerRequest MUST be null: BullMQ uses blocking commands (BRPOP)
//     and ioredis throws on them unless retries are disabled. Reusing the
//     shared `redis` (which has the default retry count) makes the Worker crash
//     on startup.
//   - We pass connection OPTIONS (not the shared instance) so BullMQ manages
//     its own dedicated connections for the blocking loop.
const connection = {
  connection: { ...redis.options, maxRetriesPerRequest: null },
};

export const turnQueue = new Queue<{ customerId: string }>("conversation-turns", connection);

function scratchKey(customerId: string) {
  return `scratch:${customerId}`;
}

/**
 * Called by ingestion-service for every deduped inbound message.
 */
export async function enqueueInboundMessage(msg: InboundMessage): Promise<void> {
  const customerId = msg.fromPhone; // Phase 1 identity resolution: see core/identity-resolution stub

  // Push the raw message onto this customer's scratch buffer.
  await redis.rpush(scratchKey(customerId), JSON.stringify(msg));

  // Sliding debounce: remove any existing delayed job for this customer,
  // then schedule a fresh one. BullMQ job IDs must be unique per queue —
  // using customerId as the jobId is what makes "remove + re-add" act as
  // a reset rather than creating a second job.
  const bullJobId = `turn_${customerId}`;
  const existing = await turnQueue.getJob(bullJobId);
  if (existing) {
    // A job that's already running (not just delayed) can't be removed —
    // in that case, let it run; the NEXT message will schedule its own
    // fresh job once this one completes. Don't throw on this race.
    const state = await existing.getState();
    if (state === "delayed") {
      await existing.remove();
    }
  }

  await turnQueue.add(
    "process-turn",
    { customerId },
    {
      jobId: bullJobId,
      delay: DEBOUNCE_MS,
      // CRITICAL: free the jobId as soon as the job settles. BullMQ treats
      // add() with an existing jobId as a no-op across ALL states — including
      // `completed`/`failed`. Without these, the FIRST turn for a customer
      // completes, its job is retained under jobId=customerId, and every
      // subsequent message's add() silently no-ops — so the customer's second
      // conversation turn never fires. removeOnComplete/Fail releases the id.
      removeOnComplete: true,
      removeOnFail: true,
    },
  );
}

/**
 * Worker: fires once the debounce window closes. Drains the scratch
 * buffer, loads current order state, and hands everything to the
 * negotiator.
 */
export const turnWorker = new Worker<{ customerId: string }>(
  "conversation-turns",
  async (job: Job<{ customerId: string }>) => {
    const { customerId } = job.data;
    const key = scratchKey(customerId);

    // Atomically read-and-clear the buffer. LMPOP would be ideal (Redis
    // 7+); for broad compatibility we use a small MULTI transaction.
    const tx = redis.multi();
    tx.lrange(key, 0, -1);
    tx.del(key);
    const results = await tx.exec();
    const rawMessages = (results?.[0]?.[1] as string[]) ?? [];

    if (rawMessages.length === 0) {
      // Can happen if two jobs raced; nothing to do.
      return;
    }

    const messages: InboundMessage[] = rawMessages.map((r) => JSON.parse(r));
    const merchantId = await resolveMerchantForCustomer(customerId);
    const orderState = await loadOrderState(customerId, merchantId);

    const turn: ConversationTurn = { customerId, merchantId, messages, orderState };
    await runNegotiatorTurn(turn);
  },
  connection,
);

// --- Placeholder lookups — these are the "stubs" mentioned in the build map ---

async function resolveMerchantForCustomer(customerId: string): Promise<string> {
  // Phase 1: every customer talks to ONE merchant (the business phone
  // number they messaged). Replace with a real lookup once you support
  // multiple merchants on shared infrastructure.
  const rows = await sql<{ merchant_id: string }[]>`
    select merchant_id from customer_merchant_links where customer_id = ${customerId} limit 1
  `;
  if (rows.length === 0) {
    throw new Error(`No merchant association for customer ${customerId}`);
  }
  return rows[0].merchant_id;
}

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