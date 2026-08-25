import { logger } from "@ace/shared/logger.js";
import { sql, redis } from "@ace/shared/clients";

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

import { runBiblioAgentTurn } from "./ace-whatsapp/core/ai-negotiator/src/biblioAgentLoop.ts";
import { runNegotiatorTurn } from "./ace-whatsapp/core/ai-negotiator/src/agentLoop.ts";

async function simulate() {
  logger.log("=== STARTING SERVICE BOOKING SIMULATION ===\n");

  const merchantRes = await sql`SELECT id, contact_phone, name FROM merchants LIMIT 1`;
  const merchant = merchantRes[0];
  const merchantId = merchant.id;
  const merchantPhone = merchant.contact_phone;
  const customerId = "2348000000002"; 

  logger.log(`1. Using Merchant: ${merchant.name} (${merchantId})`);

  await sql`DELETE FROM appointments WHERE merchant_id = ${merchantId} AND customer_id = ${customerId}`;
  await sql`DELETE FROM services WHERE merchant_id = ${merchantId} AND name ILIKE '%Hair Consultation%'`;

  logger.log("\n2. Simulating Vendor adding a service via Biblio Agent...");
  const vendorTurn: any = {
    customerId: merchantPhone,
    merchantId: merchantId,
    orderState: { status: "no_order", items: [], quotedTotal: 0 },
    messages: [{ role: "customer", content: "Add a new service: Hair Consultation, duration 45 minutes, price 10000 NGN.", timestamp: Date.now() }]
  };

  await runBiblioAgentTurn(vendorTurn);
  await new Promise(resolve => setTimeout(resolve, 2000));

  logger.log("\n3. Verifying service in Database...");
  const services = await sql`SELECT id, name, duration_minutes, price FROM services WHERE merchant_id = ${merchantId} AND name ILIKE '%Hair Consultation%' ORDER BY name DESC LIMIT 1`;
  if (services.length > 0) logger.log("✅ Service created successfully:", services[0]);
  else logger.error("❌ Service was NOT created.");

  logger.log("\n4. Simulating Customer booking the service via AI Negotiator...");
  // Manually ensure the service exists for the customer test
  const existingService = await sql`SELECT id FROM services WHERE merchant_id = ${merchantId} AND name ILIKE '%Hair Consultation%'`;
  if (existingService.length === 0) {
    logger.log("Manually seeding 'Hair Consultation' service for customer test...");
    await sql`
      INSERT INTO services (merchant_id, name, description, duration_minutes, price)
      VALUES (${merchantId}, 'Hair Consultation', 'Professional hair consultation', 45, 10000)
    `;
  }

  const customerTurn: any = {
    customerId: customerId,
    merchantId: merchantId,
    orderState: { status: "no_order", items: [], quotedTotal: 0 },
    messages: [{ role: "customer", content: "Hi, I'd like to book a Hair Consultation for tomorrow at 10:00 AM.", timestamp: Date.now() }]
  };

  await runNegotiatorTurn(customerTurn);
  await new Promise(resolve => setTimeout(resolve, 2000));

  logger.log("\n5. Checking Database for recorded appointment...");
  const appointments = await sql`
    SELECT a.id, a.status, a.start_time, a.end_time, s.name as service_name
    FROM appointments a
    JOIN services s ON a.service_id = s.id
    WHERE a.merchant_id = ${merchantId} AND a.customer_id = ${customerId}
    ORDER BY a.created_at DESC LIMIT 1
  `;
  
  if (appointments.length > 0) logger.log("✅ Appointment booked successfully:", appointments[0]);
  else logger.error("❌ Appointment was NOT booked. (Note: The agent might have replied asking for a specific time).");

  process.exit(0);
}

simulate().catch(logger.error);
