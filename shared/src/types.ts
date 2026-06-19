// shared/src/types.ts
//
// The shared domain vocabulary for the whole MVP. Almost every other file
// imports from here, so the rule is: this module has ZERO runtime imports and
// ZERO side effects — it's types only. That keeps it safe to import from
// pure code (pricingService, state machine) and from infra code alike.
//
// Shapes here are derived from the existing consumers — ingestion-service
// (InboundMessage construction), ai-negotiator/agentLoop + tools (OrderState,
// OrderEvent, OrderItem), and comms-router/whatsapp (OutboundMessage). When in
// doubt, the consumer is the spec.
//
//   - OrderState is a DISCRIMINATED UNION on `status`, stored as a single JSONB
//     column (infra/schema.sql). Narrow on `status` and the compiler tells you
//     which fields are present.
//   - InboundMessage.content is also a discriminated union (text/audio/image/
//     interactive); the agent loop switches on `content.type` exhaustively.

// ─── Seller context (merchant → the AI's voice & catalog) ───────────────────

/** Regional register the negotiator writes in. Mirrors merchants.dialect. */
export type Dialect = "pidgin" | "yoruba" | "igbo" | "hausa" | "english";

/**
 * The seller context the negotiator speaks FROM. Loaded once per turn and
 * injected into the system prompt so each merchant's agent sounds like them.
 * Mirrors the prompt-relevant columns of the `merchants` table.
 */
export interface MerchantContext {
  id: string;
  name: string;
  toneGuide: string | null;
  businessPolicies: string | null;
  deliveryInfo: string | null;
  dialect: Dialect;
}

/**
 * A catalog product with the deep context the agent sells on (not just price).
 * Mirrors the `products` table; returned by the check_inventory tool.
 */
export interface Product {
  sku: string;
  name: string;
  stock: number;
  price: number;
  description: string | null;
  category: string | null;
  tags: string[];
  attributes: Record<string, unknown>;
  imageUrl: string | null;
  currency: string;
}

// ─── Inbound (customer → us) ────────────────────────────────────────────────

export type MessageContent =
  | { type: "text"; text: string }
  | { type: "audio"; mediaId: string; mimeType?: string }
  | { type: "image"; mediaId: string; caption?: string }
  | { type: "interactive"; payload: Record<string, unknown> };

/**
 * One normalised WhatsApp message. ingestion-service builds these from the raw
 * Meta webhook payload; they are JSON-serialised onto the per-customer Redis
 * scratch buffer by comms-router/debounce, so every field must be plain data.
 */
export interface InboundMessage {
  /** WhatsApp's `wamid` — used as the idempotency key for dedup. */
  waMessageId: string;
  /** Customer phone in E.164 — the Phase-1 identity key. */
  fromPhone: string;
  /** The merchant's WhatsApp Business `phone_number_id` the message arrived on. */
  toPhoneNumberId: string;
  /** Unix epoch millis. */
  timestamp: number;
  content: MessageContent;
}

/**
 * A debounced batch of inbound messages from one customer, plus the order
 * state they were sent against. This is the unit handed to the negotiator.
 */
export interface ConversationTurn {
  customerId: string;
  merchantId: string;
  messages: InboundMessage[];
  orderState: OrderState;
}

// ─── Outbound (us → customer) ───────────────────────────────────────────────

export interface OutboundButton {
  id: string;
  title: string;
}

export interface OutboundMessage {
  toPhone: string;
  text?: string;
  /** When present, sent as a WhatsApp interactive button message. */
  buttons?: OutboundButton[];
}

// ─── Orders ─────────────────────────────────────────────────────────────────

export interface OrderItem {
  sku: string;
  name: string;
  quantity: number;
  unitPrice: number;
}

/**
 * The order lifecycle as a discriminated union. `no_order` is the empty state;
 * every other state carries an `orderId`. Terminal: `delivered`, `cancelled`.
 * Field shapes follow what tools.ts / agentLoop.ts read off each state.
 */
export type OrderState =
  | { status: "no_order" }
  | { status: "draft"; orderId: string; items: OrderItem[]; total: number }
  | {
      status: "awaiting_payment";
      orderId: string;
      items: OrderItem[];
      total: number;
      virtualAccountNumber: string;
      expiresAt: number;
    }
  | {
      status: "payment_verified";
      orderId: string;
      items: OrderItem[];
      total: number;
      paidAmount: number;
    }
  | {
      status: "out_for_delivery";
      orderId: string;
      items: OrderItem[];
      total: number;
      riderId?: string;
    }
  | {
      status: "delivered";
      orderId: string;
      items: OrderItem[];
      total: number;
      deliveredAt: number;
    }
  | { status: "cancelled"; orderId: string; reason?: string };

export type OrderStatus = OrderState["status"];

/**
 * Events that drive the order state machine. Names/fields match the calls in
 * core/ai-negotiator/src/tools.ts (`QUOTE_CREATED`, `PAYMENT_LINK_ISSUED`).
 * The state machine validates each against the current state.
 */
export type OrderEvent =
  | { type: "QUOTE_CREATED"; orderId: string; items: OrderItem[]; total: number }
  | { type: "PAYMENT_LINK_ISSUED"; virtualAccountNumber: string; expiresAt: number }
  | { type: "PAYMENT_CONFIRMED"; paidAmount: number }
  | { type: "DISPATCHED"; riderId?: string }
  | { type: "DELIVERED"; deliveredAt: number }
  | { type: "CANCELLED"; reason?: string };

export type OrderEventType = OrderEvent["type"];
