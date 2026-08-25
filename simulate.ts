import { logger } from "@ace/shared/logger.js";
import { sql, redis } from "@ace/shared/clients";
// Mock global fetch to intercept Meta Graph API calls
global.fetch = async (url) => {
  logger.log(`[Mocked fetch] Called with ${url.toString()}`);
  return { ok: true, status: 200, text: async () => "{}" } as any;
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
  logger.log("Vendor Decision Record:", decisions[0]);

  logger.log("\n6. Simulating a direct Biblio Agent chat (Upload Inventory)...");
  const turn = {
    customerId: merchantPhone,
    merchantId: merchantId,
    messages: [
      {
        id: "msg1",
        timestamp: Date.now(),
        fromMe: false,
        content: {
          text: "Add these to my store: Nike Air Max for 45k, and post it to my status. [Image: https://s3.amazonaws.com/sim/nike.jpg]"
        }
      }
    ]
  };
  
  await runBiblioAgentTurn(turn);

  logger.log("\n7. Checking Database for newly added inventory...");
  const products = await sql`SELECT sku, name, price, image_url, last_posted_at FROM products WHERE merchant_id = ${merchantId} ORDER BY updated_at DESC LIMIT 1`;
  logger.log("Products in DB:", products[0]);

  logger.log("\n=== SIMULATION COMPLETE ===");
  process.exit(0);
}

simulate().catch(logger.error);
