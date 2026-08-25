import { logger } from "@ace/shared/logger.js";
import { sql } from "@ace/shared/clients";
import { runBiblioAgentTurn } from "./ace-whatsapp/core/ai-negotiator/src/biblioAgentLoop.js";
import { runNegotiatorTurn } from "./ace-whatsapp/core/ai-negotiator/src/agentLoop.js";

// Mock fetch
const originalFetch = global.fetch;
global.fetch = async (url, options) => {
  let urlStr = "";
  if (typeof url === "string") urlStr = url;
  else if (url instanceof URL) urlStr = url.toString();
  else if (url && (url as any).url) urlStr = (url as any).url;

  if (!urlStr.includes("api.groq.com")) {
    return { ok: true, status: 200, text: async () => "{}", json: async () => ({}), headers: { get: () => null } } as any;
  }
  return originalFetch(url, options);
};

async function simulateAll() {
  logger.log("=== STARTING COMPREHENSIVE PIPELINE SIMULATION ===\n");

  const merchantRes = await sql`SELECT id, contact_phone, name FROM merchants LIMIT 1`;
  if (!merchantRes.length) {
    logger.error("No merchants found in DB. Run migrations/seeds first.");
    process.exit(1);
  }
  const merchant = merchantRes[0];
  const merchantId = merchant.id;
  const merchantPhone = merchant.contact_phone;
  const customerId = "2348999999999"; 

  logger.log(`1. Using Merchant: ${merchant.name} (${merchantId})`);

  // Clear previous test actions
  await sql`DELETE FROM system_actions WHERE merchant_id = ${merchantId}`;
  await sql`DELETE FROM appointments WHERE merchant_id = ${merchantId} AND customer_id = ${customerId}`;

  // =========================================================================
  // SCENARIO A: B2B Supplier Restocking (Vendor -> Biblio)
  // =========================================================================
  logger.log("\n>>> SCENARIO A: Vendor requesting Restock (Inventory Sub-Agent)");
  const restockTurn: any = {
    customerId: merchantPhone,
    merchantId,
    orderState: { status: "no_order", items: [], quotedTotal: 0 },
    messages: [{ role: "customer", content: { text: "We are running low on Red Ankara. Contact Alhaji to restock 50 yards." }, timestamp: Date.now() }]
  };
  await runBiblioAgentTurn(restockTurn);

  // =========================================================================
  // SCENARIO B: Predictive CRM Winback (Vendor -> Biblio)
  // =========================================================================
  logger.log("\n>>> SCENARIO B: Vendor requesting Churn Analysis (CRM Sub-Agent)");
  const churnTurn: any = {
    customerId: merchantPhone,
    merchantId,
    orderState: { status: "no_order", items: [], quotedTotal: 0 },
    messages: [{ role: "customer", content: { text: "Run a churn analysis and draft a winback campaign for Blessing." }, timestamp: Date.now() }]
  };
  await runBiblioAgentTurn(churnTurn);

  // =========================================================================
  // SCENARIO C: Visual Confirmation for Logistics (Vendor -> Biblio)
  // =========================================================================
  logger.log("\n>>> SCENARIO C: Vendor dispatching Logistics (Order Sub-Agent)");
  const logTurn: any = {
    customerId: merchantPhone,
    merchantId,
    orderState: { status: "no_order", items: [], quotedTotal: 0 },
    messages: [{ role: "customer", content: { text: "Send a visual confirmation photo to the customer for order ORD-12345, then dispatch the rider." }, timestamp: Date.now() }]
  };
  await runBiblioAgentTurn(logTurn);

  // =========================================================================
  // SCENARIO D: Social Context Multimodal (Customer -> Negotiator)
  // =========================================================================
  logger.log("\n>>> SCENARIO D: Customer asking about IG Reel (AI Negotiator)");
  const socialTurn: any = {
    customerId: customerId,
    merchantId,
    orderState: { status: "no_order", items: [], quotedTotal: 0 },
    messages: [{ role: "user", content: "How much is the blue dress from your last IG reel?", timestamp: Date.now() }]
  };
  await runNegotiatorTurn(socialTurn);

  // =========================================================================
  // SCENARIO E: Service Booking (Customer -> Negotiator)
  // =========================================================================
  logger.log("\n>>> SCENARIO E: Customer Booking an Appointment (AI Negotiator)");
  // Seed the service for this test
  await sql`
    INSERT INTO services (merchant_id, name, description, duration_minutes, price)
    VALUES (${merchantId}, 'Hair Consultation', 'Professional hair consultation', 45, 10000)
    ON CONFLICT DO NOTHING
  `;
  const services = await sql`SELECT id FROM services WHERE merchant_id = ${merchantId} AND name = 'Hair Consultation' LIMIT 1`;
  const serviceId = services.length > 0 ? services[0].id : 'test-service-id';

  const bookingTurn: any = {
    customerId: customerId,
    merchantId,
    orderState: { status: "no_order", items: [], quotedTotal: 0 },
    messages: [{ role: "user", content: { text: `I want to book a Hair Consultation (Service ID: ${serviceId}) for tomorrow at 2 PM. Book it right now.` }, timestamp: Date.now() }]
  };
  await runNegotiatorTurn(bookingTurn);

  // Wait a moment for async DB operations to flush
  await new Promise(r => setTimeout(r, 2000));

  // =========================================================================
  // VERIFICATION
  // =========================================================================
  logger.log("\n>>> VERIFYING SYSTEM ACTIONS IN DATABASE...");
  const actions = await sql`
    SELECT action_type, payload FROM system_actions 
    WHERE merchant_id = ${merchantId}
    ORDER BY created_at ASC
  `;

  if (actions.length > 0) {
    logger.log(`✅ Success! Found ${actions.length} executed workflows:`);
    actions.forEach((a, i) => {
      logger.log(`   [${i+1}] ${a.action_type}: ${JSON.stringify(a.payload)}`);
    });
  } else {
    logger.error("❌ No actions found. The AI failed to trigger the tool handlers.");
  }

  // Check appointments
  const apts = await sql`
    SELECT s.name, a.start_time FROM appointments a 
    JOIN services s ON a.service_id = s.id 
    WHERE a.customer_id = ${customerId}
  `;
  if (apts.length > 0) {
    logger.log(`✅ Appointment Booking Flow Succeeded: ${apts[0].name}`);
  } else {
    logger.log(`⚠️ Appointment NOT booked directly. (Agent might have requested clarification first).`);
  }

  process.exit(0);
}

// End of simulation

simulateAll().catch(logger.error);
