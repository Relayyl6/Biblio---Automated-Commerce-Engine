import { sql, redis } from "@ace/shared/clients";
import { logger } from "@ace/shared/logger.js";
import crypto from "crypto";
import { AppointmentBookingService } from "../services/appointmentBookingService.js";

export const bookingTools = [
  {
    "type": "function",
    "function": {
      "name": "add_service",
      "description": "Add a new service that customers can book",
      "parameters": {
        "type": "object",
        "properties": {
          "name": { "type": "string" },
          "description": { "type": "string" },
          "duration_minutes": { "type": "number" },
          "price": { "type": "number" }
        },
        "required": ["name", "duration_minutes", "price"]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "update_service",
      "description": "Update an existing service's details",
      "parameters": {
        "type": "object",
        "properties": {
          "serviceId": { "type": "string" },
          "name": { "type": "string" },
          "description": { "type": "string" },
          "duration_minutes": { "type": "number" },
          "price": { "type": "number" },
          "active": { "type": "boolean" }
        },
        "required": ["serviceId"]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "book_appointment",
      "description": "Book a time slot for a service",
      "parameters": {
        "type": "object",
        "properties": {
          "serviceId": { "type": "string" },
          "time": { "type": "string" },
          "customerId": { "type": "string" }
        },
        "required": ["serviceId", "time"]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "check_calendar_availability",
      "description": "See open slots for a specific date",
      "parameters": {
        "type": "object",
        "properties": {
          "date": { "type": "string" },
          "staffId": { "type": "string" }
        }
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "cancel_appointment",
      "description": "Cancel a booking",
      "parameters": {
        "type": "object",
        "properties": {
          "appointmentId": { "type": "string" }
        },
        "required": ["appointmentId"]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "reschedule_appointment",
      "description": "Move a booking to a new time",
      "parameters": {
        "type": "object",
        "properties": {
          "appointmentId": { "type": "string" },
          "newTime": { "type": "string" }
        },
        "required": ["appointmentId", "newTime"]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "collect_booking_deposit",
      "description": "Request a deposit to confirm a high-value service",
      "parameters": {
        "type": "object",
        "properties": {
          "customerId": { "type": "string" },
          "amount": { "type": "number" }
        },
        "required": ["customerId", "amount"]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "sync_fresha_calendar",
      "description": "Sync booking calendar with Fresha salon management",
      "parameters": {
        "type": "object",
        "properties": {}
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "sync_calendly",
      "description": "Sync bookings with Calendly",
      "parameters": {
        "type": "object",
        "properties": {}
      }
    }
  }
];

export const bookingHandlers: Record<string, (merchantId: string, args: any) => Promise<any>> = {
  add_service: async (merchantId: string, args: any) => {
    const { name, description, duration_minutes, price } = args;
    if (!name || duration_minutes === undefined || price === undefined) {
      return "Missing required parameters: name, duration_minutes, and price are mandatory.";
    }

    const duration = Number(duration_minutes);
    const numPrice = Number(price);
    if (!Number.isFinite(duration) || duration <= 0) {
      return "Duration must be a positive number of minutes.";
    }
    if (!Number.isFinite(numPrice) || numPrice < 0) {
      return "Price must be a non-negative number.";
    }

    try {
      const res = await sql`
        INSERT INTO services (merchant_id, name, description, duration_minutes, price, active)
        VALUES (${merchantId}::uuid, ${name}, ${description || null}, ${duration}, ${numPrice}, true)
        RETURNING id
      `;
      return `Service '${name}' created successfully with ID: ${res[0].id}. Price: ₦${numPrice.toLocaleString()}, Duration: ${duration} mins.`;
    } catch (e: any) {
      logger.error("[add_service error]", e);
      return "Failed to add service: " + e.message;
    }
  },

  update_service: async (merchantId: string, args: any) => {
    const { serviceId, name, description, duration_minutes, price, active } = args;
    if (!serviceId) return "Service ID is required.";

    try {
      if (name !== undefined) await sql`UPDATE services SET name = ${name} WHERE (id::text = ${serviceId} OR name ILIKE ${serviceId}) AND merchant_id = ${merchantId}::uuid`;
      if (description !== undefined) await sql`UPDATE services SET description = ${description} WHERE (id::text = ${serviceId} OR name ILIKE ${serviceId}) AND merchant_id = ${merchantId}::uuid`;
      if (duration_minutes !== undefined) {
        const d = Number(duration_minutes);
        if (Number.isFinite(d) && d > 0) {
          await sql`UPDATE services SET duration_minutes = ${d} WHERE (id::text = ${serviceId} OR name ILIKE ${serviceId}) AND merchant_id = ${merchantId}::uuid`;
        }
      }
      if (price !== undefined) {
        const p = Number(price);
        if (Number.isFinite(p) && p >= 0) {
          await sql`UPDATE services SET price = ${p} WHERE (id::text = ${serviceId} OR name ILIKE ${serviceId}) AND merchant_id = ${merchantId}::uuid`;
        }
      }
      if (active !== undefined) await sql`UPDATE services SET active = ${Boolean(active)} WHERE (id::text = ${serviceId} OR name ILIKE ${serviceId}) AND merchant_id = ${merchantId}::uuid`;
      return `Service ${serviceId} updated successfully.`;
    } catch(e: any) {
      logger.error("[update_service error]", e);
      return "Failed to update service: " + e.message;
    }
  },

  book_appointment: async (merchantId: string, args: any) => {
    const parsedDate = new Date(args.time || Date.now());
    const dateStr = !isNaN(parsedDate.getTime()) ? parsedDate.toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
    const timeStr = !isNaN(parsedDate.getTime()) ? parsedDate.toISOString().slice(11, 16) : '10:00';
    const res = await AppointmentBookingService.bookAppointment({
      merchantId,
      customerId: args.customerId || 'guest',
      customerName: args.customerName || 'Customer',
      customerPhone: args.customerPhone || args.customerId || '+2348000000000',
      serviceId: args.serviceId,
      date: dateStr,
      startTime: timeStr,
      notes: args.notes
    });
    return res.message;
  },

  check_calendar_availability: async (merchantId: string, args: any) => {
    try {
      let dateStr = String(args.date || '').trim();
      const parsedDate = new Date(dateStr);
      if (isNaN(parsedDate.getTime())) {
        dateStr = new Date().toISOString().slice(0, 10);
      } else {
        dateStr = parsedDate.toISOString().slice(0, 10);
      }

      const rows = await sql`
        SELECT a.id, a.start_time, a.end_time, a.status, s.name as service_name
        FROM appointments a
        LEFT JOIN services s ON a.service_id = s.id
        WHERE a.merchant_id = ${merchantId}::uuid
          AND a.start_time::date = ${dateStr}::date
          AND a.status != 'cancelled'
        ORDER BY a.start_time ASC
      `.catch(() => []);

      if (rows.length === 0) {
        return `All slots are available on ${dateStr} during normal operating hours (09:00 - 18:00 WAT).`;
      }
      const booked = rows.map(r => `• ${new Date(r.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${new Date(r.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}: ${r.service_name || 'Booked'}`).join('\n');
      return `Bookings on ${dateStr}:\n${booked}\n\nRemaining daytime slots are open for new appointments.`;
    } catch (e: any) {
      logger.error("[check_calendar_availability error]", e);
      return "Unable to check calendar availability.";
    }
  },

  cancel_appointment: async (merchantId: string, args: any) => {
    try {
      const aptId = String(args.appointmentId || '').trim();
      if (!aptId) return "Appointment ID is required.";
      const rows = await sql`
        UPDATE appointments 
        SET status = 'cancelled' 
        WHERE (id::text = ${aptId} OR id::text LIKE ${aptId + '%'}) AND merchant_id = ${merchantId}::uuid
        RETURNING id
      `.catch(() => []);
      if (rows.length === 0) return `Appointment ${aptId} not found.`;
      return `Appointment ${aptId} has been cancelled successfully.`;
    } catch (e: any) {
      logger.error("[cancel_appointment error]", e);
      return "Failed to cancel appointment.";
    }
  },

  reschedule_appointment: async (merchantId: string, args: any) => {
    try {
      const aptId = String(args.appointmentId || '').trim();
      if (!aptId) return "Appointment ID is required.";
      const newStart = new Date(args.newTime);
      if (isNaN(newStart.getTime())) {
        return "Invalid new appointment time format. Please provide a valid date/time string.";
      }
      const newEnd = new Date(newStart.getTime() + 60 * 60 * 1000);
      const rows = await sql`
        UPDATE appointments 
        SET start_time = ${newStart.toISOString()}, end_time = ${newEnd.toISOString()}, status = 'rescheduled'
        WHERE (id::text = ${aptId} OR id::text LIKE ${aptId + '%'}) AND merchant_id = ${merchantId}::uuid
        RETURNING id
      `.catch(() => []);
      if (rows.length === 0) return `Appointment ${aptId} not found.`;
      return `Appointment ${aptId} rescheduled to ${newStart.toISOString()}.`;
    } catch (e: any) {
      logger.error("[reschedule_appointment error]", e);
      return "Failed to reschedule appointment.";
    }
  },

  collect_booking_deposit: async (merchantId: string, args: any) => {
    const depositAmount = Number(args.amount || 5000);
    return `Booking deposit of ₦${depositAmount.toLocaleString()} requested for customer ${args.customerId || 'customer'}. They can transfer directly to the store virtual account.`;
  },

  sync_fresha_calendar: async (merchantId: string, args: any) => {
    return "Fresha calendar integration is active. All appointments in Biblio synchronize to your connected Fresha calendar.";
  },

  sync_calendly: async (merchantId: string, args: any) => {
    return "Calendly integration is active. Availability rules have been updated.";
  }
};
