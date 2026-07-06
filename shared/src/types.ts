// shared/src/types.ts
//
// These types are the "contract" between services. 
// 
// ingestion-service produces InboundMessage, 
// comms-router coalesces them into ConversationTurn,
// ai-negotiator consumes ConversationTurn + OrderState and proposes Events,
// state-machine validates Events and produces new OrderState.
//
// WHY a shared package at all: in a monorepo, the temptation is to redefine
// "Order" slightly differently in three services because each team is moving
// fast. That's how you get a production bug where comms-router thinks
// `status` is a string but state-machine emits an enum. One source of truth
// for these shapes removes an entire category of integration bugs.

/** Raw webhook payload, normalized from WhatsApp's verbose Graph API shape. (Legacy Phase 1) */
export interface InboundMessage {
  /** WhatsApp message ID — used for idempotency dedup */
  waMessageId: string;
  /** Customer's WhatsApp phone number (E.164), e.g. "2348012345678" */
  fromPhone: string;
  /** Your business phone number ID this came in on */
  toPhoneNumberId: string;
  /** Unix ms timestamp from WhatsApp */
  timestamp: number;
  content:
    | { type: "text"; text: string }
    | { type: "audio"; mediaId: string }
    | { type: "image"; mediaId: string; caption?: string }
    | { type: "interactive"; payload: unknown };
}

export type PlatformChannel = "whatsapp" | "instagram" | "facebook" | "telegram" | "tiktok" | "email";

/** Normalized message format spanning all supported channels (Phase 2) */
export interface UnifiedMessage {
  messageId: string;
  channel: PlatformChannel;
  /** The customer's identifier on that platform (Phone, IG Handle, Email, Telegram ID) */
  senderId: string;
  /** The merchant's identifier on that platform */
  recipientId: string;
  timestamp: number;
  content:
    | { type: "text"; text: string }
    | { type: "audio"; mediaUrl?: string; mediaId?: string }
    | { type: "image"; mediaUrl?: string; mediaId?: string; caption?: string }
    | { type: "interactive"; payload: unknown };
}

/**
 * A "turn" is one or more InboundMessages that arrived within the debounce
 * window and are treated as a single semantic unit by the negotiator.
 * This is the unit the ai-negotiator actually reasons over.
 */
export interface ConversationTurn {
  customerId: string; // Phase 1: == fromPhone. Phase 2: Global Buyer ID
  merchantId: string;
  messages: Array<InboundMessage | UnifiedMessage>;
  /** The order state at the moment this turn is being processed */
  orderState: OrderState;
}

/**
 * The order state machine. Each variant carries exactly the data that's
 * valid for that state — you cannot construct a "PaymentVerified" order
 * with no orderId, the type system won't let you. This is the core
 * "make illegal states unrepresentable" pattern.
 */
export type OrderState =
  | { status: "no_order" }
  | {
      status: "draft";
      orderId: string;
      items: OrderItem[];
      quotedTotal: number;
    }
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
      paidAt: number;
    }
  | {
      status: "out_for_delivery";
      orderId: string;
      items: OrderItem[];
      riderTrackingUrl: string;
    }
  | { status: "delivered"; orderId: string }
  | { status: "cancelled"; orderId: string; reason: string };

export interface OrderItem {
  sku: string;
  name: string;
  quantity: number;
  unitPrice: number;
}

/**
 * Events are the ONLY way OrderState changes. The ai-negotiator proposes
 * events; state-machine.transition() is the sole authority on whether
 * the proposed event is legal from the current state.
 */
export type OrderEvent =
  | { type: "QUOTE_CREATED"; orderId: string; items: OrderItem[]; total: number }
  | { type: "PAYMENT_LINK_ISSUED"; virtualAccountNumber: string; expiresAt: number }
  | { type: "PAYMENT_CONFIRMED"; paidAt: number; amount: number }
  | { type: "PAYMENT_TIMEOUT" }
  | { type: "RIDER_ASSIGNED"; trackingUrl: string }
  | { type: "DELIVERY_CONFIRMED" }
  | { type: "ORDER_CANCELLED"; reason: string };

/** A message the agent wants to send back to the customer. */
export interface OutboundMessage {
  toPhone?: string; // Legacy Phase 1
  toSenderId?: string; // Phase 2: Global Buyer ID or Platform ID
  channel?: PlatformChannel;
  text: string;
  /** Optional buttons/links for interactive messages */
  buttons?: OutboundButton[];
}

export interface OutboundButton {
  id: string;
  label: string;
}

export type OrderStatus = OrderState["status"];
export type OrderEventType = OrderEvent["type"];

export type Dialect = "pidgin" | "yoruba" | "igbo" | "hausa" | "english";

export interface Product {
  sku: string;
  name: string;
  stock: number;
  price: number;
  description: string | null;
  category: string | null;
  tags: string[];
  attributes: Record<string, unknown>;
  image_url: string | null;
  currency: string;
  active: boolean;
  source: string;
}

export interface MerchantContext {
  id: string;
  name: string;
  toneGuide: string | null;
  businessPolicies: string | null;
  deliveryInfo: string | null;
  dialect: Dialect;
}