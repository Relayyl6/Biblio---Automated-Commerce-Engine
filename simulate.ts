import { logger } from "@ace/shared/logger.js";
import { sql, redis } from "@ace/shared/clients";
const originalFetch = global.fetch;
global.fetch = async (url, options) => {
  const urlStr = url.toString();
  if (!urlStr.includes("api.groq.com")) {
    logger.log(`[Mocked fetch] Intercepted ${urlStr}`);
    return { 
      ok: true, 
      status: 200, 
      text: async () => "{}",
      json: async () => ({}),
      headers: { get: () => null }
    } as any;
  }
  return originalFetch(url, options);
};
import { vendorCommunique } from "./ace-whatsapp/core/comms-router/src/vendorCommunique.ts";
import { runBiblioAgentTurn } from "./ace-whatsapp/core/ai-negotiator/src/biblioAgentLoop.ts";
import { dataIntelligence } from "@ace/shared/data-intelligence/engine";

async function simulate() {
  logger.log("=== STARTING BIBLIO AGENT & COMMUNIQUE SIMULATION ===\n");

  const vendor = await sql`SELECT * FROM vendors WHERE session_status = 'connected' LIMIT 1`;
  if (!vendor[0]) {
    logger.error("No connected vendor found!");
    process.exit(1);
  }
  
  const merchantId = vendor[0].merchant_id;
  const merchantPhone = vendor[0].business_line_number;
  const customerId = "2348000000001";

  logger.log(`Using existing merchant: ${merchantId}, phone: ${merchantPhone}`);
  // Set the 24h window for the simulation
  await redis.set(`conv:${merchantId}:${merchantPhone}:window`, Date.now() + 86400000);

  logger.log("\n2. Triggering an Escalation (simulating AI Negotiator hitting the floor limit)...");
  await vendorCommunique.dispatchEscalation(
    merchantId,
    merchantPhone,
    customerId,
    "Customer offered 15k, floor is 18k",
    {
      turn: { customerId, merchantId, messages: [] },
      arc: { sessionId: "sim-session-1", customerLastOffer: 15000, floor: 18000, productSku: "PROD-123", targetPrice: 20000 } as any
    }
  );

  logger.log("\n3. Checking Redis for active Communiqué session...");
  const sessionKey = `communique:${merchantId}:active`;
  const session = await redis.get(sessionKey);
  logger.log("Session in Redis:", session);

  logger.log("\n4. Simulating an SMS Webhook reply ('1' - Approve Exception)...");
  const handled = await vendorCommunique.handleMerchantReply(merchantId, "1");
  logger.log("Was reply handled successfully?", handled);

  logger.log("\n5. Checking Database for recorded vendor decision...");
  const decisions = await sql`SELECT * FROM vendor_decisions WHERE merchant_id = ${merchantId} ORDER BY created_at DESC LIMIT 1`;
  
  // 6. Simulating a direct Customer Chat (Booking a Service)...
  logger.log("\n6. Simulating a direct Customer Chat (Booking a Service)...");
  
  const turn: any = {
    customerId: "2348000000001",
    merchantId: vendor[0].id,
    orderState: { status: "no_order", items: [], quotedTotal: 0 },
    messages: [
      { role: "customer", content: "I want to book a hair consultation for tomorrow", timestamp: Date.now() }
    ]
  };

  try {
    const { runNegotiatorTurn } = await import("./ace-whatsapp/core/ai-negotiator/src/agentLoop.ts");
    await runNegotiatorTurn(turn);
  } catch (err) {
    logger.error("[Negotiator] Error running negotiator turn:", err);
  }

  logger.log("\n7. Checking Database for newly added inventory...");
  const products = await sql`SELECT sku, name, price, image_url, last_posted_at FROM products WHERE merchant_id = ${merchantId} ORDER BY updated_at DESC LIMIT 1`;
  logger.log("Products in DB:", products[0]);

  logger.log("\n=== SIMULATION COMPLETE ===");
  process.exit(0);
}

simulate().catch(logger.error);
