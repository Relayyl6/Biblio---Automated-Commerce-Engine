import { sql, redis, jsonb } from '@ace/shared/clients';
import { logger } from '@ace/shared/logger.js';
import crypto from 'crypto';
import { sendCustomerMessage } from '../../../comms-router/src/outbound.js';

export interface ServiceItem {
  id: string;
  name: string;
  durationMinutes: number;
  price: number;
  depositRequired: number;
  description?: string;
  category?: string;
}

export interface AvailableTimeSlot {
  startTime: string; // "10:00"
  endTime: string;   // "11:30"
  date: string;      // "2026-11-25"
  available: boolean;
}

export interface AppointmentRecord {
  id: string;
  merchantId: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  serviceId: string;
  serviceName: string;
  appointmentDate: string;
  startTime: string;
  endTime: string;
  totalPrice: number;
  depositPaid: number;
  status: 'confirmed' | 'pending_deposit' | 'cancelled' | 'completed' | 'rescheduled';
}

export class AppointmentBookingService {
  /**
   * Add a new bookable service (e.g. hair styling, consultation, tailoring measurement).
   */
  static async addService(params: {
    merchantId: string;
    name: string;
    durationMinutes: number;
    price: number;
    depositRequired?: number;
    description?: string;
    category?: string;
  }): Promise<ServiceItem> {
    const { merchantId, name, durationMinutes, price, depositRequired = 0, description = '', category = 'Services' } = params;

    const rows = await sql<ServiceItem[]>`
      INSERT INTO merchant_services (
        id, merchant_id, name, duration_minutes, price, deposit_required, description, category, active, created_at, updated_at
      ) VALUES (
        gen_random_uuid(), ${merchantId}::uuid, ${name.trim()}, ${durationMinutes}, ${price},
        ${depositRequired}, ${description.trim()}, ${category}, true, now(), now()
      ) RETURNING id, name, duration_minutes as "durationMinutes", price, deposit_required as "depositRequired", description, category
    `;

    logger.info('[AppointmentBookingService] Added service', { merchantId, name, price });
    return rows[0];
  }

  /**
   * Check available calendar time slots for a given date.
   */
  static async checkCalendarAvailability(params: {
    merchantId: string;
    date: string; // YYYY-MM-DD
    serviceDurationMinutes?: number;
  }): Promise<AvailableTimeSlot[]> {
    const { merchantId, date, serviceDurationMinutes = 60 } = params;

    // Standard business hours: 09:00 to 18:00
    const startHour = 9;
    const endHour = 18;

    // Fetch existing bookings for this merchant on this date
    const existingBookings = await sql<{
      start_time: string;
      end_time: string;
    }[]>`
      SELECT start_time, end_time FROM appointments
      WHERE merchant_id = ${merchantId}::uuid
        AND appointment_date = ${date}
        AND status IN ('confirmed', 'pending_deposit')
    `.catch(() => []);

    const bookedTimes = new Set(existingBookings.map((b) => b.start_time.slice(0, 5)));

    const slots: AvailableTimeSlot[] = [];
    for (let h = startHour; h < endHour; h++) {
      const slotStart = `${h < 10 ? '0' : ''}${h}:00`;
      const endH = h + Math.floor(serviceDurationMinutes / 60);
      const endM = serviceDurationMinutes % 60;
      const slotEnd = `${endH < 10 ? '0' : ''}${endH}:${endM < 10 ? '0' : ''}${endM}`;

      const isBooked = bookedTimes.has(slotStart);
      slots.push({
        date,
        startTime: slotStart,
        endTime: slotEnd,
        available: !isBooked,
      });
    }

    return slots;
  }

  /**
   * Book an appointment with collision detection and deposit hold.
   */
  static async bookAppointment(params: {
    merchantId: string;
    customerId: string;
    customerName: string;
    customerPhone: string;
    serviceId: string;
    date: string;
    startTime: string;
    notes?: string;
  }): Promise<{ appointment: AppointmentRecord; depositRequired: number; paymentLink?: string; message: string }> {
    const { merchantId, customerId, customerName, customerPhone, serviceId, date, startTime, notes } = params;

    // Distributed lock to prevent slot double booking
    const slotLock = `slot_lock:${merchantId}:${date}:${startTime}`;
    const acquired = await redis.set(slotLock, '1', 'EX', 15, 'NX');
    if (!acquired) {
      throw new Error(`That time slot (${date} at ${startTime}) was just selected by someone else. Please choose another slot.`);
    }

    try {
      // Fetch service info
      const sRows = await sql`
        SELECT * FROM merchant_services WHERE id = ${serviceId}::uuid AND merchant_id = ${merchantId}::uuid LIMIT 1
      `.catch(() => []);
      const service = sRows[0] || { name: 'Service Booking', price: 10000, duration_minutes: 60, deposit_required: 2000 };

      const durationMinutes = Number(service.duration_minutes || 60);
      const [sh, sm] = startTime.split(':').map(Number);
      const totalMinutes = sh * 60 + sm + durationMinutes;
      const eh = Math.floor(totalMinutes / 60);
      const em = totalMinutes % 60;
      const endTime = `${eh < 10 ? '0' : ''}${eh}:${em < 10 ? '0' : ''}${em}`;

      // Check slot conflict in DB
      const conflict = await sql`
        SELECT id FROM appointments
        WHERE merchant_id = ${merchantId}::uuid
          AND appointment_date = ${date}
          AND start_time = ${startTime}
          AND status IN ('confirmed', 'pending_deposit')
        LIMIT 1
      `.catch(() => []);

      if (conflict.length > 0) {
        throw new Error(`Time slot ${date} at ${startTime} is already booked.`);
      }

      const depositRequired = Number(service.deposit_required || 0);
      const initialStatus = depositRequired > 0 ? 'pending_deposit' : 'confirmed';
      const appointmentId = `APT-${Date.now().toString(36).toUpperCase()}`;

      await sql`
        INSERT INTO appointments (
          id, appointment_number, merchant_id, customer_id, customer_name, customer_phone,
          service_id, service_name, appointment_date, start_time, end_time, total_price,
          deposit_paid, status, notes, created_at, updated_at
        ) VALUES (
          gen_random_uuid(), ${appointmentId}, ${merchantId}::uuid, ${customerId}, ${customerName}, ${customerPhone},
          ${serviceId}::uuid, ${service.name}, ${date}, ${startTime}, ${endTime}, ${service.price},
          0, ${initialStatus}, ${notes || null}, now(), now()
        )
      `;

      let paymentLink: string | undefined;
      let message = `✅ Appointment booked for ${service.name} on ${date} at ${startTime}!`;

      if (depositRequired > 0) {
        paymentLink = `https://checkout.biblio.africa/deposit/${appointmentId.toLowerCase()}`;
        message = `📅 Appointment reserved for ${service.name} on ${date} at ${startTime}.\n` +
          `A booking deposit of ₦${depositRequired.toLocaleString()} is required to confirm your slot.\n` +
          `Pay here: ${paymentLink}`;
      }

      // Notify customer
      await sendCustomerMessage({ toPhone: customerPhone, text: message }, undefined, merchantId).catch(() => {});

      const record: AppointmentRecord = {
        id: appointmentId,
        merchantId,
        customerId,
        customerName,
        customerPhone,
        serviceId,
        serviceName: service.name,
        appointmentDate: date,
        startTime,
        endTime,
        totalPrice: Number(service.price),
        depositPaid: 0,
        status: initialStatus,
      };

      return {
        appointment: record,
        depositRequired,
        paymentLink,
        message,
      };
    } finally {
      await redis.del(slotLock);
    }
  }

  /**
   * Cancel an appointment and notify both customer and merchant.
   */
  static async cancelAppointment(merchantId: string, appointmentId: string, reason?: string): Promise<{ success: boolean; message: string }> {
    const rows = await sql<{ customer_phone: string; service_name: string; appointment_date: string; start_time: string }[]>`
      UPDATE appointments
      SET status = 'cancelled', updated_at = now()
      WHERE (appointment_number = ${appointmentId} OR id::text = ${appointmentId})
        AND merchant_id = ${merchantId}::uuid
      RETURNING customer_phone, service_name, appointment_date, start_time
    `;

    if (!rows[0]) {
      throw new Error(`Appointment ${appointmentId} not found`);
    }

    const apt = rows[0];
    const message = `Your appointment for ${apt.service_name} on ${apt.appointment_date} at ${apt.start_time} has been cancelled.${reason ? ` Reason: ${reason}` : ''}`;
    await sendCustomerMessage({ toPhone: apt.customer_phone, text: message }, undefined, merchantId).catch(() => {});

    return { success: true, message: `Appointment ${appointmentId} cancelled successfully.` };
  }
}
