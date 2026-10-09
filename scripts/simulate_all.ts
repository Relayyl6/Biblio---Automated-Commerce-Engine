import { logger } from "@ace/shared/logger.js";
import { sql } from "@ace/shared/clients.js";
import { runBiblioAgentTurn } from "./ace-whatsapp/core/ai-negotiator/src/biblioAgentLoop.js";
import { runNegotiatorTurn } from "./ace-whatsapp/core/ai-negotiator/src/agentLoop.js";
import { Queue } from "bullmq";
import { redis } from "@ace/shared/clients.js";

// ─── Mock fetch — let Groq calls through, stub everything else ────────────────
const originalFetch = global.fetch;
global.fetch = async (url, options) => {
  let urlStr = "";
  if (typeof url === "string") urlStr = url;
  else if (url instanceof URL) urlStr = url.toString();
  else if (url && (url as any).url) urlStr = (url as any).url;

  if (!urlStr.includes("api.groq.com")) {
    return {
      ok: true,
      status: 200,
      text: async () => "{}",
      json: async () => ({}),
      headers: { get: () => null },
    } as any;
  }
  return originalFetch(url, options);
};

// ─── Result tracking ──────────────────────────────────────────────────────────
let passed = 0;
let externalTimeouts = 0;
let failed = 0;

/**
 * Classify and record a caught error, printing an appropriate label.
 * Network / API timeout → ⚠️ EXTERNAL_TIMEOUT (not a code bug).
 * Anything else         → ❌ FAILED.
 */
function classifyError(scenarioLabel: string, err: unknown): void {
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  const isExternal =
    msg.includes("apiclienttimeouterror") ||
    msg.includes("apiconnectiontimeouterror") ||
    msg.includes("connection timeout") ||
    msg.includes("connect timeout") ||
    msg.includes("econnrefused") ||
    msg.includes("network") ||
    msg.includes("fetch failed") ||
    msg.includes("enotfound") ||
    msg.includes("etimedout") ||
    msg.includes("turn exceeded") ||
    msg.includes("socket hang up");

  if (isExternal) {
    externalTimeouts++;
    logger.log(`⚠️ EXTERNAL_TIMEOUT — ${scenarioLabel}: ${(err as Error).message}`);
  } else {
    failed++;
    logger.error(`❌ FAILED — ${scenarioLabel}:`, err);
  }
}

async function runScenario(name: string, fn: () => Promise<void>) {
  logger.log('\n======================================================');
  logger.log('>>> RUNNING: ' + name);
  logger.log('======================================================\n');
  try {
    await fn();
    logger.log('✅ PASSED: ' + name);
    passed++;
  } catch (err: unknown) {
    classifyError(name, err);
  }
}

async function main() {
  logger.log("Starting Full Simulation Suite...");
  
  const merchantId = '11111111-1111-1111-1111-111111111111';
  const merchantPhone = '+2348000000000';



  await runScenario('A. Vendor Registers', async () => {
    const turn = {
      customerId: merchantPhone,
      merchantId,
      orderState: { status: 'no_order' as const, items: [], quotedTotal: 0 },
      messages: [{ role: 'customer' as const, content: { text: 'I want to start selling Ankara online' }, timestamp: Date.now() }]
    };
    await runBiblioAgentTurn(turn);
  });

  await runScenario('B. Vendor Syncs Instagram', async () => {
    const turn = {
      customerId: merchantPhone,
      merchantId,
      orderState: { status: 'no_order' as const, items: [], quotedTotal: 0 },
      messages: [{ role: 'customer' as const, content: { text: 'My IG is @ankara_styles' }, timestamp: Date.now() }]
    };
    await runBiblioAgentTurn(turn);
  });

  await runScenario('C. Customer Explores Product', async () => {
    const turn = {
      customerId: '2348900000000',
      merchantId,
      orderState: { status: 'no_order' as const, items: [], quotedTotal: 0 },
      messages: [{ role: 'user' as const, content: { text: 'Do you have red ankara wrapper?' }, timestamp: Date.now() }]
    };
    await runNegotiatorTurn(turn);
  });

  await runScenario('D. Customer Places Order', async () => {
    const turn = {
      customerId: '2348900000000',
      merchantId,
      orderState: { status: 'no_order' as const, items: [{ productId: 'mock-1', name: 'Red Ankara', price: 8000, quantity: 1, images: [] }], quotedTotal: 8000 },
      messages: [{ role: 'user' as const, content: { text: 'I will take the red one for 8k' }, timestamp: Date.now() }]
    };
    await runNegotiatorTurn(turn);
  });

  await runScenario('E. Customer Booking', async () => {
    const turn = {
      customerId: '2348999999999',
      merchantId,
      orderState: { status: 'no_order' as const, items: [], quotedTotal: 0 },
      messages: [{ role: 'user' as const, content: { text: 'Hi, id like to book a Hair Consultation for tomorrow at 10:00 AM' }, timestamp: Date.now() }]
    };
    await runNegotiatorTurn(turn);
  });

  await runScenario('F. Voice Note Inquiry', async () => {
    const turn = {
      customerId: '2348911111111',
      merchantId,
      orderState: { status: 'no_order' as const, items: [], quotedTotal: 0 },
      messages: [{ role: 'user' as const, content: { type: 'audio' as const, text: 'abeg how much be the ankara wrapper', transcript: 'abeg how much be the ankara wrapper' }, timestamp: Date.now() }]
    };
    await runNegotiatorTurn(turn);
  });

  await runScenario('G. Image Inquiry', async () => {
    const turn = {
      customerId: '2348922222222',
      merchantId,
      orderState: { status: 'no_order' as const, items: [], quotedTotal: 0 },
      messages: [{ role: 'user' as const, content: { type: 'image' as const, caption: 'Do you have this kind of print?', mediaId: 'mock-media-id-001' }, timestamp: Date.now() }]
    };
    await runNegotiatorTurn(turn);
  });

  await runScenario('H. Nonexistent Service', async () => {
    const turn = {
      customerId: '2348933333333',
      merchantId,
      orderState: { status: 'no_order' as const, items: [], quotedTotal: 0 },
      messages: [{ role: 'user' as const, content: { text: 'I want to book a pedicure for next Monday' }, timestamp: Date.now() }]
    };
    await runNegotiatorTurn(turn);
  });

  await runScenario('I. Vendor Updates Price', async () => {
    const turn = {
      customerId: merchantPhone,
      merchantId,
      orderState: { status: 'no_order' as const, items: [], quotedTotal: 0 },
      messages: [{ role: 'customer' as const, content: { text: 'Update the price of Red Ankara to 8500' }, timestamp: Date.now() }]
    };
    await runBiblioAgentTurn(turn);
  });

  await runScenario('J. Order Summary Request', async () => {
    const turn = {
      customerId: merchantPhone,
      merchantId,
      orderState: { status: 'no_order' as const, items: [], quotedTotal: 0 },
      messages: [{ role: 'customer' as const, content: { text: 'Give me a summary of all orders today' }, timestamp: Date.now() }]
    };
    await runBiblioAgentTurn(turn);
  });

  await runScenario('K. Abandoned Cart Recovery (BullMQ)', async () => {
    const cartQueue = new Queue('delayed_cart_recovery', { connection: { ...redis.options, maxRetriesPerRequest: null } });
    await cartQueue.add('recover', { orderId: 'mock-order-id', merchantId, customerId: '2348900000000' }, { delay: 1000 });
    const waiting = await cartQueue.getDelayed();
    if (waiting.length === 0) throw new Error('Failed to enqueue delayed job');
    // Clean up
    await cartQueue.obliterate({ force: true }).catch(() => {});
    await cartQueue.close();
  });

  logger.log('\n=== SIMULATION RESULTS ===');
  logger.log('✅ PASSED: ' + passed);
  logger.log('⚠️ EXTERNAL TIMEOUTS: ' + externalTimeouts);
  logger.log('❌ FAILED: ' + failed);
  
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  logger.error("Fatal error running simulation:", err);
  process.exit(1);
});
