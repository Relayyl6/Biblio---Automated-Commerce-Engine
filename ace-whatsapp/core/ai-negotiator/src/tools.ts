import { logger } from "@ace/shared/logger.js";
// core/ai-negotiator/src/tools.ts  (v2 — negotiation-aware)
//
// ─── HOW THIS FILE CHANGED FROM V1 ───────────────────────────────────────────
//
// V1 had 4 tools: check_inventory, get_customer_history, create_quote,
// issue_payment_link.
//
// V2 adds:
//   - `propose_price`        → runs pricingService.validateProposedPrice()
//                              BEFORE touching state. Below-floor returns a
//                              circuit-breaker signal, not an error.
//
//   - `deploy_tactic`        → model MUST call this to formally deploy a
//                              tactic. Writes to NegotiationArc so guards
//                              work correctly hours later on the next turn.
//
//   - `close_deal`           → commits the agreed price. Proposal ≠ commit.
//                              Model must see explicit customer acceptance first.
//
//   - `escalate_to_merchant` → Vendor Communiqué. Hard-gated: bundle AND
//                              credit must both have been tried, enforced in
//                              code, not just the prompt.

import { sql, jsonb } from "@ace/shared/clients";
import { dataIntelligence } from "@ace/shared/data-intelligence/engine";
import { transition, TransitionError } from "../../state-machine/src/orderStateMachine";
import { vendorCommunique } from "../../comms-router/src/vendorCommunique.js";
import { sendCustomerMessage } from "../../comms-router/src/outbound.js";
import Groq from "groq-sdk";


import {
  validateProposedPrice,
  validateBundlePivot,
  resolveCustomerTier,
  type AuthorizedPriceRange,
} from "./pricingService";
import {
  advanceArc,
  availableTactics,
  discountLocked,
  negotiationAttempts,
  MAX_NEGOTIATION_ATTEMPTS,
  type NegotiationArc,
  type NegotiationTactic,
} from "./negotiationArc";
import type { OrderState, OrderItem, Product, Source } from "@ace/shared/types";


// ─── Tool Schema Definitions ──────────────────────────────────────────────────

export const toolDefinitions = [
  {
    name: "check_services",
    description:
      "Look up services offered by the merchant. Call this when a customer asks to book a service or appointment.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Service name or description" },
      },
      required: ["query"],
    },
  },
  {
    name: "check_availability",
    description:
      "Check available appointment slots for a specific date and service duration. Call this before booking.",
    input_schema: {
      type: "object",
      properties: {
        date: { type: "string", description: "YYYY-MM-DD" },
        durationMinutes: { type: "number", description: "Duration of the service in minutes" },
      },
      required: ["date", "durationMinutes"],
    },
  },
  {
    name: "book_appointment",
    description:
      "Book an appointment for a specific service and time slot.",
    input_schema: {
      type: "object",
      properties: {
        serviceId: { type: "string", description: "The ID of the service to book" },
        startTime: { type: "string", description: "ISO 8601 start time (e.g. 2026-08-26T10:00:00Z)" },
        title: { type: "string", description: "Brief title for the appointment (e.g. 'Massage for John')" },
      },
      required: ["serviceId", "startTime", "title"],
    },
  },

  {
    name: "check_inventory",
    description:
      "Look up products by name, description, or SKU. Returns full product context: " +
      "price, stock, description, category, tags, and attributes (sizes, colour, " +
      "material, etc.). Call this FIRST before any price discussion. Use the rich " +
      "context to describe and sell on value, and to find genuine bundle items. " +
      "Stock level also determines whether scarcity_signal is available.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Product name, description, or SKU" },
      },
      required: ["query"],
    },
  },
  {
    name: "get_customer_profile",
    description:
      "Load this customer's order history, lifetime value, and tier. " +
      "Call once per session to understand who you're negotiating with and what " +
      "discount levels and tactics are available to you.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "propose_price",
    description:
      "Propose a price to the customer. Validated against the authorized floor. " +
      "If below floor, you receive a circuit_breaker signal with available tactics. " +
      "Do NOT call close_deal until customer explicitly accepts.",
    input_schema: {
      type: "object",
      properties: {
        price: { type: "number", description: "Price in NGN you are proposing" },
        customerMessageContext: {
          type: "string",
          description: "The customer message that prompted this proposal",
        },
      },
      required: ["price", "customerMessageContext"],
    },
  },
  {
    name: "deploy_tactic",
    description:
      "Deploy a negotiation tactic. MUST call this when using a tactic so it " +
      "is recorded and won't be available again this session. " +
      "Options: relationship_anchor, bundle_pivot, scarcity_signal, " +
      "future_credit, urgency_window, soft_close.",
    input_schema: {
      type: "object",
      properties: {
        tactic: {
          type: "string",
          enum: [
            "relationship_anchor", "bundle_pivot", "scarcity_signal",
            "future_credit", "urgency_window", "soft_close",
          ],
        },
        productSku: {
          type: "string",
          description: "SKU of the product being negotiated — from check_inventory result",
        },
        bundleDetails: {
          type: "object",
          description: "Required if tactic is bundle_pivot",
          properties: {
            addedItemNames: { type: "array", items: { type: "string" } },
            addedItemsValue: { type: "number" },
            bundlePrice: { type: "number" },
          },
        },
        creditAmount: {
          type: "number",
          description: "NGN credit amount. Required if tactic is future_credit.",
        },
        urgencyHours: {
          type: "number",
          description: "Hours the price hold is valid. Required if tactic is urgency_window.",
        },
      },
      required: ["tactic", "productSku"],
    },
  },
  {
    name: "close_deal",
    description:
      "Customer has explicitly accepted the price — commit the deal and create the order. " +
      "Only call when customer has unambiguously agreed. This is irreversible.",
    input_schema: {
      type: "object",
      properties: {
        finalPrice: { type: "number" },
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              sku: { type: "string" },
              name: { type: "string" },
              quantity: { type: "integer" },
              unitPrice: { type: "number" },
            },
            required: ["sku", "name", "quantity", "unitPrice"],
          },
        },
      },
      required: ["finalPrice", "items"],
    },
  },
  {
    name: "escalate_to_merchant",
    description:
      "All tactics exhausted, customer still below floor. Send merchant a Vendor Communique " +
      "for a manual exception decision. Only available after bundle_pivot AND future_credit " +
      "have both been attempted.",
    input_schema: {
      type: "object",
      properties: {
        customerFinalOffer: { type: "number" },
        summary: {
          type: "string",
          description: "One-line summary of the negotiation for the merchant",
        },
      },
      required: ["customerFinalOffer", "summary"],
    },
  },
  {
    name: "issue_payment_link",
    description:
      "After close_deal, generate a payment link (virtual account number). " +
      "Only valid once order is in draft status.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "search_web",
    description:
      "Search the internet for current market prices, product specs, or competitor pricing. " +
      "Use when a customer asks about price ranges, comparisons, or specs for products " +
      "you don't have in your catalog (e.g. 'i5 6th gen price range'). " +
      "Returns top 3 search result snippets you can cite in your reply.",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Specific search query. Include 'Nigeria' and current year for price queries.",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "search_visual_catalog",
    description:
      "Search the merchant's catalog using semantic text or a visual query (image). " +
      "Use this when the customer provides an image or gives a visual description " +
      "(e.g., 'that blue dress', 'the red shoes in your post') and check_inventory fails.",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The visual description of the item, or the base64 image data.",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "source_price",
    description:
      "Contact the merchant's B2B suppliers to get a live wholesale price for a product. " +
      "Use this ONLY if check_inventory fails to find the product in the catalog, OR if " +
      "the catalog item has no price and must be sourced. " +
      "This tool pauses the negotiation while we wait for the supplier to reply.",
    input_schema: {
      type: "object",
      properties: {
        productQuery: {
          type: "string",
          description: "What the customer is asking for (e.g. 'iPhone 11 64GB').",
        },
      },
      required: ["productQuery"],
    },
  },
] as const;

// ─── Execution Context ────────────────────────────────────────────────────────

export interface ToolContext {
  customerId: string;
  merchantId: string;
  orderState: OrderState;
  arc: NegotiationArc;
  authorizedRange?: AuthorizedPriceRange;
}

export interface ToolResult {
  output: unknown;
  newOrderState?: OrderState;
  newArc?: NegotiationArc;
  // Returned by check_inventory and get_customer_profile when they produce
  // data that lets the agent loop recompute the authorized price range.
  // Carrying it here (rather than having the loop re-query) means there's
  // exactly one place where range computation happens: pricingService.ts.
  rangeUpdate?: {
    basePrice?: number;       // from check_inventory
    tier?: import("./pricingService").CustomerTier; // from get_customer_profile
    productSku?: string;      // from check_inventory — fixes the "TBD" arc bug
  };
}

// ─── Dispatcher ───────────────────────────────────────────────────────────────

export async function executeTool(
  name: string,
  input: any,
  ctx: ToolContext,
): Promise<ToolResult> {
  switch (name) {
    case "check_services": {
      const rows = await checkServices(ctx.merchantId, input.query);
      return { output: rows };
    }
    case "check_availability": {
      const slots = await checkAvailability(ctx.merchantId, input.date, input.durationMinutes);
      return { output: slots };
    }
    case "book_appointment": {
      const result = await bookAppointment(ctx.merchantId, ctx.customerId, input.serviceId, input.startTime, input.title);
      return { output: result };
    }

    case "check_inventory": {
      const rows = await checkInventory(ctx.merchantId, input.query);
      const topResult = rows[0];
      return {
        output: rows,
        rangeUpdate: topResult
          ? { basePrice: topResult.price ?? undefined, productSku: topResult.sku }
          : undefined,
      };
    }
    case "search_visual_catalog": {
      const rows = await searchVisualCatalog(ctx.merchantId, input.query);
      const topResult = rows[0];
      return {
        output: rows,
        rangeUpdate: topResult
          ? { basePrice: topResult.price ?? undefined, productSku: topResult.sku }
          : undefined,
      };
    }
    case "get_customer_profile": {
      const profile = await getCustomerProfile(ctx.customerId, ctx.merchantId);
      return {
        output: profile,
        rangeUpdate: { tier: profile.tier },
      };
    }
    case "propose_price":
      return proposePrice(input.price, input.customerMessageContext, ctx);
    case "deploy_tactic":
      return await deployTactic(input, ctx);
    case "close_deal":
      return closeDeal(input.finalPrice, input.items, ctx);
    case "escalate_to_merchant":
      return await escalateToMerchant(input.customerFinalOffer, input.summary, ctx);
    case "issue_payment_link":
      return await issuePaymentLink(ctx);
    case "search_web": {
      const { query } = input as { query: string };
      const results = await executeSearchWeb(query);
      return { output: results };
    }
    case "source_price": {
      const { productQuery } = input as { productQuery: string };
      return await sourcePrice(productQuery, ctx);
    }
    default:
      return { output: { error: `Unknown tool: ${name}` } };
  }
}

// ─── Tool Implementations ─────────────────────────────────────────────────────

async function checkInventory(merchantId: string, query: string): Promise<Product[]> {
  // NOTE: products has no per-product floor column in the Phase-1 schema — the
  // authorized floor is derived from merchant_pricing_rules (absolute_floor) and
  // the tier discount ceiling in pricingService.computeAuthorizedRange().
  //
  // We return the FULL product context (description/category/tags/attributes) so
  // the agent can sell on value, not just quote a number. Matching widens to the
  // description and category too, so "the flowy blue one" resolves to a SKU.
  const like = "%" + query + "%";
  const rows = await sql<{
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
  }[]>`
    select sku, name, stock, price, description, category, tags, attributes,
           image_url, currency
    from products
    where merchant_id = ${merchantId}
      and active = true
      and (
        name ilike ${like}
        or sku ilike ${like}
        or description ilike ${like}
        or category ilike ${like}
      )
    order by greatest(
      similarity(name, ${query}),
      similarity(coalesce(description, ''), ${query})
    ) desc
    limit 5
  `;
  return rows.map((r) => ({
    sku: r.sku,
    name: r.name,
    stock: r.stock,
    price: r.price,
    description: r.description,
    category: r.category,
    tags: r.tags ?? [],
    attributes: r.attributes ?? {},
    image_url: r.image_url,
    currency: r.currency,
    active: true,
    source: "db",
  }));
}

async function searchVisualCatalog(merchantId: string, query: string) {
  let embeddingStr = "[]";
  try {
    const { generateEmbedding } = await import("@ace/shared/data-intelligence/embeddings");
    const vector = await generateEmbedding(query);
    embeddingStr = `[${vector.join(",")}]`;
  } catch (err) {
    logger.error("[searchVisualCatalog] Failed to generate embedding", err);
    return [];
  }

  // Use <=> for cosine distance search
  const rows = await sql<{
    sku: string;
    name: string;
    stock: number | null;
    price: number | null;
    description: string | null;
    category: string | null;
    tags: string[] | null;
    attributes: Record<string, string> | null;
    image_url: string | null;
    currency: string;
    distance: number;
  }[]>`
    SELECT sku, name, stock, price, description, category, tags, attributes,
           image_url, currency,
           (image_embedding <=> ${embeddingStr}::vector) as distance
    FROM products
    WHERE merchant_id = ${merchantId}
      AND active = true
      AND image_embedding IS NOT NULL
    ORDER BY distance ASC
    LIMIT 3
  `;

  return rows.map((r) => ({
    sku: r.sku,
    name: r.name,
    stock: r.stock,
    price: r.price,
    description: r.description,
    category: r.category,
    tags: r.tags ?? [],
    attributes: r.attributes ?? {},
    image_url: r.image_url,
    currency: r.currency,
    active: true,
    source: "db_visual",
    similarity_score: 1 - r.distance // Output a human-readable similarity score
  }));
}

async function getCustomerProfile(customerId: string, merchantId: string) {
  // Lifetime value = sum of delivered-order totals. `total` lives inside the
  // OrderState JSONB (orders.state), not a top-level column, so read it via the
  // ->> accessor and cast. The per-tier discount ceilings are NOT needed here —
  // computeAuthorizedRange() loads them from merchant_pricing_rules separately;
  // this function only resolves the customer's tier from their history.
  const rows = await sql<{
    total_spent: number;
    order_count: number;
  }[]>`
    select
      coalesce(sum((o.state->>'total')::numeric), 0) as total_spent,
      count(o.id) as order_count
    from merchants m
    left join orders o
      on o.merchant_id = m.id
      and o.customer_id = ${customerId}
      and o.state->>'status' = 'delivered'
    where m.id = ${merchantId}
    group by m.id
  `;
  const row = rows[0];
  if (!row) throw new Error(`Merchant ${merchantId} not found`);

  const profile = {
    orderCount: Number(row.order_count),
    lifetimeValue: Number(row.total_spent),
  };
  return { ...profile, tier: resolveCustomerTier(profile) };
}

function proposePrice(
  proposedPrice: number,
  customerMessage: string,
  ctx: ToolContext,
): ToolResult {
  if (!ctx.authorizedRange) {
    return {
      output: {
        error: "Call get_customer_profile and check_inventory before proposing a price.",
      },
    };
  }

  // BIBLO Flaw 3 (anti-haggling rate limit): once the agent has made its
  // allotted concessions, lock the floor of negotiation at the current best
  // offer. The agent may still hold or close at agentLastOffer, but it may not
  // concede FURTHER. This caps "push the AI N times to drain margin" attacks.
  if (
    discountLocked(ctx.arc) &&
    ctx.arc.agentLastOffer !== undefined &&
    proposedPrice < ctx.arc.agentLastOffer
  ) {
    return {
      output: {
        ok: false,
        rateLimited: true,
        lockedPrice: ctx.arc.agentLastOffer,
        attempts: negotiationAttempts(ctx.arc),
        maxAttempts: MAX_NEGOTIATION_ATTEMPTS,
        message:
          `You have reached the ${MAX_NEGOTIATION_ATTEMPTS}-offer negotiation limit. ` +
          `Hold firm at ₦${ctx.arc.agentLastOffer.toLocaleString()} — present it as your ` +
          `final offer and invite the customer to proceed or check back later. ` +
          `Do not concede further.`,
      },
    };
  }

  const validation = validateProposedPrice(proposedPrice, ctx.authorizedRange, customerMessage);

  if (validation.ok) {
    const newArc = advanceArc(ctx.arc, { type: "AGENT_COUNTERED", agentOffer: validation.finalPrice });
    return { output: { ok: true, validatedPrice: validation.finalPrice }, newArc };
  }

  if (validation.reason === "below_floor") {
    return {
      output: {
        ok: false,
        circuitBreaker: true,
        customerOffer: validation.customerOffer,
        floor: validation.floor,
        gap: validation.floor - validation.customerOffer,
        availableTactics: availableTactics({ arc: ctx.arc, currentStockLevel: 0 }),
        message: `₦${proposedPrice} is below the authorized floor ₦${validation.floor}. Use a tactic or escalate.`,
      },
    };
  }

  if (validation.reason === "injection_detected") {
    logger.warn(`[security] injection detected — customer ${ctx.customerId}:`, validation.pattern);
    return {
      output: {
        ok: false,
        injectionDetected: true,
        message: "Message flagged. Continue the conversation normally.",
      },
    };
  }

  return { output: { ok: false, reason: (validation as any).reason } };
}

async function deployTactic(input: any, ctx: ToolContext): Promise<ToolResult> {
  const tactic = input.tactic as NegotiationTactic;
  // Use the SKU explicitly passed by the model (required in schema), not
  // arc.productSku which may still be "TBD" if check_inventory result hasn't
  // been looped back yet. The model must pass the SKU it learned from
  // check_inventory — the schema now makes this required.
  const sku = input.productSku as string;
  const stock = await getCurrentStock(ctx.merchantId, sku);
  const allowed = availableTactics({ arc: ctx.arc, currentStockLevel: stock });

  if (!allowed.includes(tactic)) {
    return {
      output: { ok: false, error: `Tactic '${tactic}' not available. Available: [${allowed.join(", ")}]` },
    };
  }

  if (tactic === "bundle_pivot" && input.bundleDetails && ctx.authorizedRange) {
    const bundleValidation = validateBundlePivot(
      {
        baseItemPrice: ctx.arc.anchorPrice,
        bundlePrice: input.bundleDetails.bundlePrice,
        addedItemsValue: input.bundleDetails.addedItemsValue,
      },
      ctx.authorizedRange,
    );
    if (!bundleValidation.ok) {
      return { output: { ok: false, error: bundleValidation.reason } };
    }
  }

  let newArc = ctx.arc;
  if (tactic === "urgency_window" && input.urgencyHours) {
    newArc = { ...newArc, urgencyWindowExpiresAt: Date.now() + input.urgencyHours * 3600_000 };
  }

  if (tactic === "bundle_pivot") {
    newArc = advanceArc(newArc, {
      type: "BUNDLE_PIVOTED",
      agentOffer: input.bundleDetails?.bundlePrice ?? ctx.arc.agentLastOffer ?? ctx.arc.anchorPrice,
    });
  } else if (tactic === "future_credit") {
    newArc = advanceArc(newArc, { type: "CREDIT_OFFERED", creditAmount: input.creditAmount ?? 0 });
  } else {
    newArc = advanceArc(newArc, {
      type: "AGENT_COUNTERED",
      agentOffer: ctx.arc.agentLastOffer ?? ctx.arc.anchorPrice,
      tactic,
    });
  }

  return { output: { ok: true, tacticDeployed: tactic }, newArc };
}

function closeDeal(finalPrice: number, items: OrderItem[], ctx: ToolContext): ToolResult {
  if (!ctx.authorizedRange) {
    return { output: { ok: false, error: "No authorized range loaded." } };
  }
  if (finalPrice < ctx.authorizedRange.floor) {
    return {
      output: { ok: false, error: `₦${finalPrice} is below floor ₦${ctx.authorizedRange.floor}.` },
    };
  }

  const orderId = crypto.randomUUID();
  try {
    const newOrderState = transition(ctx.orderState, { type: "QUOTE_CREATED", orderId, items, total: finalPrice });
    const newArc = advanceArc(ctx.arc, { type: "DEAL_ACCEPTED", finalPrice });

    // Telemetry: Capture state transition for TrustScore signals
    dataIntelligence.captureOrderStateChange({
      merchantId: ctx.merchantId,
      customerId: ctx.customerId,
      orderId,
      fromState: ctx.orderState.status,
      toState: newOrderState.status,
      timestamp: Date.now(),
    }).catch(() => {});

    return { output: { ok: true, orderId, finalPrice }, newOrderState, newArc };
  } catch (err) {
    if (err instanceof TransitionError) return { output: { ok: false, error: err.message } };
    throw err;
  }
}

async function escalateToMerchant(
  customerFinalOffer: number,
  summary: string,
  ctx: ToolContext,
): Promise<ToolResult> {
  if (!ctx.arc.bundlePivotAttempted || !ctx.arc.futureCreditAttempted) {
    const missing = [
      !ctx.arc.bundlePivotAttempted && "bundle_pivot",
      !ctx.arc.futureCreditAttempted && "future_credit",
    ].filter(Boolean);
    return {
      output: {
        ok: false,
        error: `Must attempt these tactics first: [${missing.join(", ")}]`,
      },
    };
  }

  await sql`
    insert into escalations (merchant_id, customer_id, reason, context, created_at)
    values (
      ${ctx.merchantId}, ${ctx.customerId},
      ${"Below-floor negotiation — manual exception required"},
      ${jsonb({ customerFinalOffer, floor: ctx.authorizedRange?.floor, summary, arc: ctx.arc })},
      now()
    )
  `;

  const newArc = advanceArc(ctx.arc, { type: "ESCALATED_TO_MERCHANT" });
  
  try {
    const merchantRows = await sql<{contact_phone: string}[]>`select contact_phone from merchants where id = ${ctx.merchantId} limit 1`;
    const merchantPhone = merchantRows[0]?.contact_phone;
    if (!merchantPhone) {
       throw new Error("Merchant has no contact_phone configured.");
    }
    await vendorCommunique.dispatchEscalation(
      ctx.merchantId,
      merchantPhone,
      ctx.customerId,
      "Below-floor negotiation — manual exception required",
      { turn: ctx.arc as any, arc: ctx.arc } // Passing arc twice to satisfy the context for now
    );
  } catch (err) {
    logger.error("[tools] Failed to dispatch vendor communique:", err);
    return {
      output: {
        ok: false,
        error: "CRITICAL: The vendor is unreachable via all channels (WhatsApp/SMS). Inform the customer that the vendor cannot be reached right now, and ask them to try again later."
      }
    };
  }

  return {
    output: {
      ok: true,
      escalated: true,
      message: "Merchant successfully notified via SMS. Tell the customer you are checking with the vendor.",
    },
    newArc,
  };
}

async function issuePaymentLink(ctx: ToolContext): Promise<ToolResult> {
  if (ctx.orderState.status !== "draft") {
    return { output: { ok: false, error: "Call close_deal first." } };
  }

  const dealPrice = ctx.orderState.quotedTotal;

  // ── Platform fee markup (5%) ───────────────────────────────────────────────
  // Customer pays 5% above the agreed deal price.
  // Paystack takes ~1.5% + ₦100, Biblio retains the rest (~3.5%).
  // e.g. ₦100,000 deal → customer transfers ₦105,000
  const PLATFORM_FEE_RATE = 0.05;
  const customerPayableAmount = Math.ceil(dealPrice * (1 + PLATFORM_FEE_RATE));

  // ── Paystack: create a charge with bank_transfer channel ──────────────────
  const paystackSecretKey = process.env.PAYSTACK_SECRET_KEY;
  let virtualAccountNumber: string;
  let bankName = "Providus Bank";
  let accountName = "ACE Commerce Collections";

  if (paystackSecretKey) {
    try {
      const chargeRes = await fetch("https://api.paystack.co/charge", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${paystackSecretKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          // Paystack amounts are in kobo (1 NGN = 100 kobo)
          amount: customerPayableAmount * 100,
          email: `${ctx.customerId.replace(/[^a-zA-Z0-9]/g, "")}@ace-commerce.app`,
          currency: "NGN",
          channels: ["bank_transfer"],
          metadata: {
            orderId: ctx.orderState.orderId,
            merchantId: ctx.merchantId,
            customerId: ctx.customerId,
            dealPrice,
            platformFee: customerPayableAmount - dealPrice,
          },
        }),
      });
      const chargeData = await chargeRes.json() as any;
      if (!chargeRes.ok) {
        throw new Error(`Paystack API returned ${chargeRes.status}: ${JSON.stringify(chargeData)}`);
      }

      // Paystack bank_transfer returns account details under authorization
      virtualAccountNumber =
        chargeData.data?.authorization?.receiver_bank_account_number ??
        chargeData.data?.bank_transfer?.account_number ??
        chargeData.data?.account_number;
      
      if (!virtualAccountNumber) {
        throw new Error("Paystack did not return a virtual account number");
      }

      bankName =
        chargeData.data?.authorization?.receiver_bank ??
        chargeData.data?.bank_transfer?.bank_name ??
        bankName;
    } catch (err) {
      logger.error("[tools] Paystack charge failed:", err);
      return { output: { ok: false, error: "Payment provider unavailable. Tell the customer to try again in a few minutes." } };
    }
  } else {
    // No Paystack key configured — this is a production error!
    logger.error("[tools] CRITICAL: PAYSTACK_SECRET_KEY is not configured.");
    return { output: { ok: false, error: "Payment system misconfigured. Please escalate." } };
  }

  const expiresAt = Date.now() + 30 * 60 * 1000; // 30-minute payment window
  try {
    const newOrderState = transition(ctx.orderState, {
      type: "PAYMENT_LINK_ISSUED",
      virtualAccountNumber,
      expiresAt,
    });

    dataIntelligence.captureOrderStateChange({
      merchantId: ctx.merchantId,
      customerId: ctx.customerId,
      orderId: ctx.orderState.orderId,
      fromState: ctx.orderState.status,
      toState: newOrderState.status,
      timestamp: Date.now(),
    }).catch(() => {});

    return {
      output: {
        ok: true,
        virtualAccountNumber,
        bankName,
        accountName,
        dealPrice,
        customerPayableAmount,
        platformFeeNgn: customerPayableAmount - dealPrice,
        expiresInMinutes: 30,
        instructions:
          `Transfer exactly ₦${customerPayableAmount.toLocaleString("en-NG")} to:\n` +
          `Bank: ${bankName}\n` +
          `Account Number: ${virtualAccountNumber}\n` +
          `Account Name: ${accountName}\n` +
          `(This includes a ₦${(customerPayableAmount - dealPrice).toLocaleString("en-NG")} processing fee)`,
      },
      newOrderState,
    };
  } catch (err) {
    if (err instanceof TransitionError) return { output: { ok: false, error: err.message } };
    throw err;
  }
}




async function getCurrentStock(merchantId: string, sku: string): Promise<number> {
  const rows = await sql<{ stock: number }[]>`
    select stock from products where merchant_id = ${merchantId} and sku = ${sku}
  `;
  return rows[0]?.stock ?? 0;
}

async function executeSearchWeb(query: string): Promise<{ snippets: string[]; query: string }> {
  const apiKey = process.env.BRAVE_SEARCH_API_KEY;
  if (!apiKey) return { snippets: ["Web search not configured. Tell the customer you cannot check market prices right now."], query };

  const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=5`;
  const res = await fetch(url, {
    headers: {
      "Accept": "application/json",
      "X-Subscription-Token": apiKey,
    },
  });

  if (!res.ok) return { snippets: [`Search failed: ${res.status}`], query };

  const data = await res.json() as any;
  const snippets: string[] = (data.web?.results ?? [])
    .slice(0, 3)
    .map((r: any) => `• ${r.title}: ${r.description}`);

  return { snippets, query };
}

async function sourcePrice(productQuery: string, ctx: ToolContext): Promise<ToolResult> {
  const sources = await sql<Source[]>`
    SELECT * FROM sources WHERE merchant_id = ${ctx.merchantId} AND active = true
  `;
  
  if (sources.length === 0) {
    return { output: { ok: false, error: "No sources configured for this merchant. Cannot source price." } };
  }

  // ── Semantic Routing via LLM ────────────────────────────────────────────────
  // In a full production system at massive scale, we might use pgvector + CLIP
  // embeddings here. But for routing between a few suppliers, an LLM provides
  // superior semantic matching (e.g. understanding "macbook" goes to "laptops")
  // with no infra overhead.
  let matchedSources: Source[] = [];
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || "" });
  
  try {
    const sourceList = sources.map(s => `- ID: ${s.id}\n  Name: ${s.name}\n  Category/Description: ${s.description || "General items"}`).join("\n\n");
    
    const prompt = `You are a B2B supplier routing engine. A customer wants: "${productQuery}".
Below are the available suppliers for this merchant:

${sourceList}

Select the suppliers that are most likely to carry this product based on their description.
Return a JSON array of the supplier IDs that match. If none match, return [].
Output ONLY valid JSON in the format: { "matches": ["id1", "id2"] }`;

    const completion = await groq.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
      response_format: { type: "json_object" },
      temperature: 0,
    });

    const resultText = completion.choices[0]?.message?.content || '{"matches":[]}';
    const parsed = JSON.parse(resultText) as { matches: string[] };
    
    if (parsed.matches && Array.isArray(parsed.matches)) {
      matchedSources = sources.filter(s => parsed.matches.includes(s.id));
    }
  } catch (err) {
    logger.error("[sourcePrice] Semantic routing failed, falling back to default sources.", err);
  }
  // ────────────────────────────────────────────────────────────────────────────

  if (matchedSources.length === 0) {
    matchedSources = sources.filter(s => s.is_default);
  }
  if (matchedSources.length === 0) {
    matchedSources = sources; // Broadcast to all if no default
  }

  const quoteIds: string[] = [];
  const contactedIds: string[] = [];
  const timeoutAt = Date.now() + ((matchedSources[0]?.reply_timeout_minutes ?? 10) * 60 * 1000);
  const orderId = ctx.orderState.status !== "no_order" ? (ctx.orderState as any).orderId : null;

  // Send message to each matched source
  for (const source of matchedSources) {
    if (!source.contact && source.type !== "self") continue;
    
    let querySent = "";
    if (source.type === "whatsapp_individual" || source.type === "whatsapp_group") {
      querySent = `Customer is asking for: *${productQuery}*\n\nHow much is the current wholesale price? (Reply with price to update customer)`;
      await sendCustomerMessage({ toPhone: source.contact!, text: querySent }, undefined, ctx.merchantId);
    } else if (source.type === "self") {
       // Escalation route
       querySent = `A customer is asking for *${productQuery}* but we don't have a catalog price. What should we quote them?`;
       // Send to the merchant's personal number
       const merchantRows = await sql<{contact_phone: string}[]>`select contact_phone from merchants where id = ${ctx.merchantId} limit 1`;
       const merchantPhone = merchantRows[0]?.contact_phone;
       if (merchantPhone) {
         await sendCustomerMessage({ toPhone: merchantPhone, text: querySent }, undefined, ctx.merchantId);
       }
    } else {
       // API not implemented in MVP script
       continue;
    }

    const rows = await sql<{id: string}[]>`
      INSERT INTO source_quotes (order_id, source_id, merchant_id, customer_id, product_query, query_sent)
      VALUES (
        ${orderId}, 
        ${source.id}, ${ctx.merchantId}, ${ctx.customerId}, ${productQuery}, ${querySent}
      )
      RETURNING id
    `;
    
    quoteIds.push(rows[0].id);
    contactedIds.push(source.id);
  }

  const newArc = advanceArc(ctx.arc, { 
    type: "SOURCE_QUERIED", 
    productQuery, 
    quoteIds, 
    timeoutAt 
  });

  return {
    output: {
      ok: true,
      message: `Message sent to ${contactedIds.length} sources. Tell the customer you are confirming the warehouse price and they should hold on a minute.`,
    },
    newArc
  };
}

async function checkServices(merchantId: string, query: string) {
  const like = "%" + query + "%";
  const rows = await sql`
    SELECT id, name, description, duration_minutes, price
    FROM services
    WHERE merchant_id = ${merchantId} AND active = true
      AND (name ILIKE ${like} OR description ILIKE ${like})
    LIMIT 5
  `;
  return rows;
}

async function checkAvailability(merchantId: string, dateStr: string, durationMinutes: number) {
  // Real implementation would look at merchant's store_hours and existing appointments.
  // For Phase 1, we just mock 3 available slots between 9am and 5pm.
  return [
    { start: `${dateStr}T09:00:00Z`, end: `${dateStr}T09:${String(durationMinutes).padStart(2,'0')}:00Z` },
    { start: `${dateStr}T13:00:00Z`, end: `${dateStr}T13:${String(durationMinutes).padStart(2,'0')}:00Z` },
    { start: `${dateStr}T15:00:00Z`, end: `${dateStr}T15:${String(durationMinutes).padStart(2,'0')}:00Z` },
  ];
}

async function bookAppointment(merchantId: string, customerId: string, serviceId: string, startTime: string, title: string) {
  // get service details
  const srv = await sql`SELECT duration_minutes FROM services WHERE id = ${serviceId} LIMIT 1`;
  if (!srv.length) return { ok: false, error: "Service not found." };
  
  const endTime = new Date(new Date(startTime).getTime() + srv[0].duration_minutes * 60000).toISOString();
  
  await sql`
    INSERT INTO appointments (merchant_id, customer_id, service_id, title, start_time, end_time, status)
    VALUES (${merchantId}, ${customerId}, ${serviceId}, ${title}, ${startTime}, ${endTime}, 'confirmed')
  `;
  
  return { ok: true, message: "Appointment confirmed.", startTime, endTime };
}
