import { config } from "dotenv";
config();
import { bookingHandlers } from "./ace-whatsapp/core/ai-negotiator/src/tools/bookingTools.js";
import { sql } from "@ace/shared/clients";

async function testBookingTool() {
  console.log("=== Testing Booking Tool Infrastructure ===");
  
  const merchantId = "11111111-1111-1111-1111-111111111111"; // Amaka Fashion House
  const customerId = "2348999999999";
  
  // Create a service first
  await sql`
    INSERT INTO services (merchant_id, name, description, duration_minutes, price)
    VALUES (${merchantId}, 'Hair Consultation Test', 'Professional hair consultation', 45, 10000)
    ON CONFLICT DO NOTHING
  `;
  const services = await sql`SELECT id FROM services WHERE merchant_id = ${merchantId} AND name = 'Hair Consultation Test' LIMIT 1`;
  const serviceId = services[0].id;
  
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(17, 0, 0, 0); // 5 PM tomorrow
  
  await sql`
    INSERT INTO merchant_integrations (merchant_id, provider, access_token, refresh_token)
    VALUES (${merchantId}, 'google_calendar', 'fake_access_token', 'fake_refresh_token')
    ON CONFLICT DO NOTHING
  `;

  console.log(`Executing book_appointment for Service ID: ${serviceId}...`);
  
  const args = {
    serviceId: serviceId,
    time: tomorrow.toISOString(),
    customerId: customerId
  };
  
  const result = await bookingHandlers.book_appointment(merchantId, args);
  console.log("\n[Tool Result]:", result);
  
  const check = await sql`SELECT * FROM appointments WHERE merchant_id = ${merchantId} AND service_id = ${serviceId}`;
  console.log("\n[DB Verify]: Found", check.length, "appointment(s) in database.");
  if (check.length > 0) {
    console.log("  -> Appt ID:", check[0].id);
    console.log("  -> Time:", check[0].start_time);
    console.log("  -> Status:", check[0].status);
  }
  
  process.exit(0);
}

testBookingTool();
