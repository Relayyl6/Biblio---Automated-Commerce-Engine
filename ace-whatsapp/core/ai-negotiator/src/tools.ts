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
import { transition, TransitionError } from "../../state-machine/src/orderStateMachine";
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
import type { OrderState, OrderItem, Product } from "@ace/shared/types";

// ─── Tool Schema Definitions ──────────────────────────────────────────────────

export const toolDefinitions = [
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
    case "check_inventory": {
      const rows = await checkInventory(ctx.merchantId, input.query);
      // If results came back, signal the agent loop to recompute the
      // authorized range with the real product price. The loop picks the
      // top result's price as the new basePrice — the model can still
      // choose a different SKU but the range will be recalculated on the
      // next propose_price call once it does.
      const topResult = rows[0];
      return {
        output: rows,
        rangeUpdate: topResult
          ? { basePrice: topResult.price, productSku: topResult.sku }
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
      return issuePaymentLink(ctx);
    case "search_web": {
      const { query } = input as { query: string };
      const results = await executeSearchWeb(query);
      return { output: results };
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
    console.warn(`[security] injection detected — customer ${ctx.customerId}:`, validation.pattern);
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
  return {
    output: {
      ok: true,
      escalated: true,
      message: "Merchant notified. Tell the customer you are checking with the vendor.",
    },
    newArc,
  };
}

function issuePaymentLink(ctx: ToolContext): ToolResult {
  if (ctx.orderState.status !== "draft") {
    return { output: { ok: false, error: "Call close_deal first." } };
  }
  const virtualAccountNumber = `9${Math.floor(100000000 + Math.random() * 900000000)}`;
  const expiresAt = Date.now() + 15 * 60 * 1000;
  try {
    const newOrderState = transition(ctx.orderState, {
      type: "PAYMENT_LINK_ISSUED",
      virtualAccountNumber,
      expiresAt,
    });
    return { output: { ok: true, virtualAccountNumber, expiresInMinutes: 15 }, newOrderState };
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