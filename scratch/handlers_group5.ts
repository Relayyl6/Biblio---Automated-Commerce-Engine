import { sql, redis } from "@ace/shared/clients";
import { makeThirdPartyRequest } from "./utils.js";
import { randomUUID } from "crypto";

export const group5Handlers: Record<string, Function> = {
  // --- INTEGRATION TOOLS ---
  
  register_webhook: async (merchantId: string, args: { url: string; event: string }) => {
    const { url, event } = args;
    if (!url || !event) throw new Error("Missing url or event");
    
    const webhookId = randomUUID();
    await sql`
      INSERT INTO webhooks (id, merchant_id, url, event, active, created_at)
      VALUES (${webhookId}, ${merchantId}, ${url}, ${event}, true, NOW())
    `;
    
    // Test the webhook using background queue
    await redis.lpush("webhook_queue", JSON.stringify({ webhookId, payload: { test: true } }));
    
    return { success: true, webhookId, message: "Webhook registered and test queued." };
  },

  remove_webhook: async (merchantId: string, args: { webhookId: string }) => {
    const { webhookId } = args;
    const result = await sql`
      DELETE FROM webhooks 
      WHERE id = ${webhookId} AND merchant_id = ${merchantId}
      RETURNING id
    `;
    if (result.length === 0) throw new Error("Webhook not found or unauthorized");
    return { success: true, message: "Webhook removed successfully" };
  },

  connect_mailchimp: async (merchantId: string, args: { apiKey: string }) => {
    const { apiKey } = args;
    // Validate key with mailchimp mock
    const mcRes = await makeThirdPartyRequest("mailchimp", "/ping", { apiKey });
    if (!mcRes?.ok) throw new Error("Invalid Mailchimp API Key");
    
    await sql`
      INSERT INTO merchant_integrations (merchant_id, provider, credentials, status)
      VALUES (${merchantId}, 'mailchimp', ${JSON.stringify({ apiKey })}, 'active')
      ON CONFLICT (merchant_id, provider) DO UPDATE SET credentials = EXCLUDED.credentials
    `;
    return { success: true, message: "Mailchimp connected" };
  },

  connect_zapier: async (merchantId: string, args: any) => {
    const zapierKey = `zap_${randomUUID()}`;
    await sql`
      INSERT INTO api_keys (merchant_id, key_value, service, created_at)
      VALUES (${merchantId}, ${zapierKey}, 'zapier', NOW())
    `;
    return { success: true, zapierKey, message: "Zapier key generated" };
  },

  connect_slack: async (merchantId: string, args: { webhookUrl: string }) => {
    const { webhookUrl } = args;
    const testRes = await makeThirdPartyRequest("slack", webhookUrl, { text: "Slack integration connected to ACE!" });
    if (!testRes?.ok) throw new Error("Failed to reach Slack webhook");

    await sql`
      INSERT INTO merchant_integrations (merchant_id, provider, config, status)
      VALUES (${merchantId}, 'slack', ${JSON.stringify({ webhookUrl })}, 'active')
      ON CONFLICT (merchant_id, provider) DO UPDATE SET config = EXCLUDED.config
    `;
    return { success: true, message: "Slack connected via webhook" };
  },

  connect_discord: async (merchantId: string, args: { webhookUrl: string }) => {
    const { webhookUrl } = args;
    const testRes = await makeThirdPartyRequest("discord", webhookUrl, { content: "Discord integration connected to ACE!" });
    if (!testRes?.ok) throw new Error("Failed to reach Discord webhook");

    await sql`
      INSERT INTO merchant_integrations (merchant_id, provider, config, status)
      VALUES (${merchantId}, 'discord', ${JSON.stringify({ webhookUrl })}, 'active')
      ON CONFLICT (merchant_id, provider) DO UPDATE SET config = EXCLUDED.config
    `;
    return { success: true, message: "Discord connected via webhook" };
  },

  sync_google_sheets: async (merchantId: string, args: { sheetUrl: string }) => {
    const { sheetUrl } = args;
    await sql`
      INSERT INTO merchant_integrations (merchant_id, provider, config, status)
      VALUES (${merchantId}, 'google_sheets', ${JSON.stringify({ sheetUrl })}, 'active')
      ON CONFLICT (merchant_id, provider) DO UPDATE SET config = EXCLUDED.config
    `;
    await redis.lpush("sync_queue", JSON.stringify({ merchantId, target: "google_sheets", sheetUrl }));
    return { success: true, message: "Google Sheets sync initiated" };
  },

  generate_api_key: async (merchantId: string, args: any) => {
    const customKey = `pk_live_${randomUUID()}`;
    await sql`
      INSERT INTO api_keys (merchant_id, key_value, service, created_at)
      VALUES (${merchantId}, ${customKey}, 'custom_storefront', NOW())
    `;
    return { success: true, customKey, message: "Headless API Key generated" };
  },

  // --- BOOKING TOOLS ---

  book_appointment: async (merchantId: string, args: { serviceId: string; time: string; customerId?: string }) => {
    const { serviceId, time, customerId } = args;
    
    // Check overlapping appointments in Postgres
    const overlaps = await sql`
      SELECT id FROM appointments 
      WHERE merchant_id = ${merchantId} 
      AND service_id = ${serviceId}
      AND appointment_time = ${time}::timestamp
      AND status != 'cancelled'
    `;
    if (overlaps.length > 0) throw new Error("Time slot unavailable");

    // Book via Google Calendar Mock
    const gcalRes = await makeThirdPartyRequest("google_calendar", "/events/insert", {
      startTime: time,
      summary: \`Booking for Service \${serviceId}\`
    });
    if (!gcalRes?.eventId) throw new Error("Google Calendar scheduling failed");

    const appointmentId = randomUUID();
    await sql`
      INSERT INTO appointments (id, merchant_id, service_id, customer_id, appointment_time, external_event_id, status)
      VALUES (${appointmentId}, ${merchantId}, ${serviceId}, ${customerId || null}, ${time}::timestamp, ${gcalRes.eventId}, 'confirmed')
    `;
    return { success: true, appointmentId, message: "Appointment booked successfully" };
  },

  check_calendar_availability: async (merchantId: string, args: { date: string; staffId?: string }) => {
    const { date, staffId } = args;
    const gcalAvail = await makeThirdPartyRequest("google_calendar", "/freebusy", { date, staffId });
    
    const dbBookings = await sql`
      SELECT appointment_time FROM appointments
      WHERE merchant_id = ${merchantId}
      AND DATE(appointment_time) = ${date}::date
      AND status != 'cancelled'
      ${staffId ? sql`AND staff_id = ${staffId}` : sql``}
    `;
    
    return { success: true, availableSlots: gcalAvail?.slots || [], booked: dbBookings };
  },

  cancel_appointment: async (merchantId: string, args: { appointmentId: string }) => {
    const { appointmentId } = args;
    const [appt] = await sql`
      UPDATE appointments 
      SET status = 'cancelled' 
      WHERE id = ${appointmentId} AND merchant_id = ${merchantId}
      RETURNING external_event_id
    `;
    if (!appt) throw new Error("Appointment not found");

    if (appt.external_event_id) {
      await makeThirdPartyRequest("google_calendar", \`/events/\${appt.external_event_id}/delete\`, {});
    }
    return { success: true, message: "Appointment cancelled" };
  },

  reschedule_appointment: async (merchantId: string, args: { appointmentId: string; newTime: string }) => {
    const { appointmentId, newTime } = args;
    
    const [appt] = await sql`SELECT service_id, external_event_id FROM appointments WHERE id = ${appointmentId} AND merchant_id = ${merchantId}`;
    if (!appt) throw new Error("Appointment not found");

    const overlaps = await sql`
      SELECT id FROM appointments 
      WHERE merchant_id = ${merchantId} 
      AND service_id = ${appt.service_id}
      AND appointment_time = ${newTime}::timestamp
      AND status != 'cancelled'
    `;
    if (overlaps.length > 0) throw new Error("New time slot is unavailable");

    if (appt.external_event_id) {
      await makeThirdPartyRequest("google_calendar", \`/events/\${appt.external_event_id}/update\`, { startTime: newTime });
    }

    await sql`
      UPDATE appointments 
      SET appointment_time = ${newTime}::timestamp 
      WHERE id = ${appointmentId}
    `;
    return { success: true, message: "Appointment rescheduled successfully" };
  },

  collect_booking_deposit: async (merchantId: string, args: { appointmentId: string; amount: number }) => {
    const { appointmentId, amount } = args;
    if (amount <= 0) throw new Error("Deposit must be positive");

    const paymentIntentId = \`pi_\${randomUUID()}\`;
    await sql`
      INSERT INTO deposits (appointment_id, merchant_id, amount, status, payment_intent)
      VALUES (${appointmentId}, ${merchantId}, ${amount}, 'pending', ${paymentIntentId})
    `;
    
    // Add to Redis job queue for tracking expiration
    await redis.setex(\`deposit_timeout:\${paymentIntentId}\`, 3600, appointmentId);
    
    return { success: true, paymentIntentId, amount, message: "Deposit requested" };
  },

  sync_fresha_calendar: async (merchantId: string, args: { apiKey: string }) => {
    const { apiKey } = args;
    const authRes = await makeThirdPartyRequest("fresha", "/auth", { apiKey });
    if (!authRes?.ok) throw new Error("Invalid Fresha API key");

    await sql`
      INSERT INTO merchant_integrations (merchant_id, provider, credentials, status)
      VALUES (${merchantId}, 'fresha', ${JSON.stringify({ apiKey })}, 'active')
      ON CONFLICT (merchant_id, provider) DO UPDATE SET credentials = EXCLUDED.credentials
    `;
    await redis.lpush("booking_sync_queue", JSON.stringify({ merchantId, provider: "fresha" }));
    return { success: true, message: "Fresha CRM connected" };
  },

  sync_calendly: async (merchantId: string, args: { accessToken: string }) => {
    const { accessToken } = args;
    const authRes = await makeThirdPartyRequest("calendly", "/users/me", { token: accessToken });
    if (!authRes?.ok) throw new Error("Invalid Calendly Access Token");

    await sql`
      INSERT INTO merchant_integrations (merchant_id, provider, credentials, status)
      VALUES (${merchantId}, 'calendly', ${JSON.stringify({ accessToken })}, 'active')
      ON CONFLICT (merchant_id, provider) DO UPDATE SET credentials = EXCLUDED.credentials
    `;
    await redis.lpush("booking_sync_queue", JSON.stringify({ merchantId, provider: "calendly" }));
    return { success: true, message: "Calendly connected" };
  }
};
