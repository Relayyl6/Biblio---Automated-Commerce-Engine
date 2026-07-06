// shared/src/schemas.ts
//
// Role: Zod schemas for hard payload boundaries across services.
// Enforces runtime validation of DTOs entering the system.

import { z } from 'zod';

// --- Shared Core Primitives ---

export const DialectSchema = z.enum(['pidgin', 'yoruba', 'igbo', 'hausa', 'english']);

export const OrderItemSchema = z.object({
  sku: z.string(),
  name: z.string(),
  quantity: z.number().int().positive(),
  unitPrice: z.number().int().nonnegative(),
});

// --- Ingestion Boundary ---

export const InboundMessageContentSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("text"), text: z.string() }),
  z.object({ type: z.literal("audio"), mediaId: z.string() }),
  z.object({ type: z.literal("image"), mediaId: z.string(), caption: z.string().optional() }),
  z.object({ type: z.literal("interactive"), payload: z.unknown() })
]);

export const InboundMessageSchema = z.object({
  waMessageId: z.string(),
  fromPhone: z.string().regex(/^\+?[1-9]\d{1,14}$/, "Must be a valid E.164 phone number"),
  toPhoneNumberId: z.string(),
  timestamp: z.number().int(),
  content: InboundMessageContentSchema,
});

// --- State Machine Events Boundary ---

export const OrderEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("QUOTE_CREATED"), orderId: z.string(), items: z.array(OrderItemSchema), total: z.number().int() }),
  z.object({ type: z.literal("PAYMENT_LINK_ISSUED"), virtualAccountNumber: z.string(), expiresAt: z.number().int() }),
  z.object({ type: z.literal("PAYMENT_CONFIRMED"), paidAt: z.number().int(), amount: z.number().int() }),
  z.object({ type: z.literal("PAYMENT_TIMEOUT") }),
  z.object({ type: z.literal("RIDER_ASSIGNED"), trackingUrl: z.string().url() }),
  z.object({ type: z.literal("DELIVERY_CONFIRMED") }),
  z.object({ type: z.literal("ORDER_CANCELLED"), reason: z.string() })
]);

// --- API Payloads Boundary ---

export const MerchantSettingsUpdateSchema = z.object({
  toneGuide: z.string().optional(),
  businessPolicies: z.string().optional(),
  deliveryInfo: z.string().optional(),
  dialect: DialectSchema.optional()
});
