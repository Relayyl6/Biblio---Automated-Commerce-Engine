// core/ai-negotiator/src/agentLoop.ts
//
// The negotiation agent's per-turn entry point. One debounced ConversationTurn
// comes in; the loop drives a tool-using Claude call until the model stops
// requesting tools, then finalizes (persist order, flush trace, send reply).
//
// Invariants worth keeping in mind while reading:
//
//   - PRICES ARE NEVER TRUSTED FROM THE MODEL. The authorized range starts as a
//     sentinel with floor=Infinity (blocks every propose_price) and is only
//     widened reactively, after check_inventory returns a real price and
//     get_customer_profile returns the real tier. By the time the model can
//     legally propose, ctx.authorizedRange reflects real data — enforced in
//     tools.ts, not just the prompt.
//
//   - ONE TURN PER CUSTOMER AT A TIME. A Redis SETNX lock guards against two
//     concurrent debounce jobs racing into conflicting state writes.
//
//   - OUTBOUND GOES THROUGH ONE DOOR. finalizeTurn sends via comms-router's
//     sendCustomerMessage (service-window classification lives there), never the
//     raw Graph sender.
//
//   - TERMINAL ARCS BECOME TRACES. negotiationTrace.buildNegotiationTrace turns a
//     terminal arc into the negotiation_traces row (the enterprise data asset);
//     it returns null mid-negotiation, so finalizeTurn can call it unconditionally.

import Anthropic from "@anthropic-ai/sdk";
import { sql, redis, jsonb } from "@ace/shared/clients";
import { sendCustomerMessage } from "../../comms-router/src/outbound";
import { executeTool, toolDefinitions, type ToolContext } from "./tools";
import {
  computeAuthorizedRange,
  type MerchantPricingRules,
  type AuthorizedPriceRange,
  type CustomerTier,
} from "./pricingService";
import {
  availableTactics,
  projectRangeOntoArc,
  type NegotiationArc,
} from "./negotiationArc";
import { buildNegotiationTrace } from "./negotiationTrace";
import type {
  ConversationTurn,
  OrderState,
  MerchantContext,
  Dialect,
} from "@ace/shared/types";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = "claude-sonnet-4-6";
const MAX_ITERATIONS = 8;
const LOCK_TTL_SECONDS = 300; // 5 minutes — generous ceiling for an 8-iteration turn

// ─── Main Entry Point ─────────────────────────────────────────────────────────

export async function runNegotiatorTurn(turn: ConversationTurn): Promise<void> {
  // Distributed lock — prevents two concurrent turns for the same customer from
  // producing conflicting state writes (debounce reset can race with job pickup).
  const lockKey = `lock:negotiation:${turn.customerId}`;
  const lockAcquired = await redis.set(lockKey, "1", "EX", LOCK_TTL_SECONDS, "NX");

  if (!lockAcquired) {
    console.warn(
      `[negotiator] lock contention for customer ${turn.customerId} — dropping duplicate turn`,
    );
    return;
  }

  try {
    await _runTurn(turn);
  } finally {
    // Always release the lock, even if the turn throws.
    await redis.del(lockKey);
  }
}

async function _runTurn(turn: ConversationTurn): Promise<void> {
  const arc = await loadOrCreateArc(turn);
  const [pricingRules, merchant] = await Promise.all([
    loadMerchantPricingRules(turn.merchantId),
    loadMerchantContext(turn.merchantId),
  ]);

  // Sentinel range — floor=Infinity means NO price can pass until real product
  // data arrives via check_inventory. Safer to block a proposal than to approve
  // one against a floor of 0. Widened reactively in the tool loop below.
  let currentBasePrice = 0;
  let currentTier: CustomerTier = arc.tier;

  const sentinelRange: AuthorizedPriceRange = {
    anchor: 0,
    floor: Infinity,
    maxDiscount: 0,
    maxBundleValueAdd: 0,
    futureCreditCap: 0,
    tier: currentTier,
  };

  const ctx: ToolContext = {
    customerId: turn.customerId,
    merchantId: turn.merchantId,
    orderState: turn.orderState,
    arc,
    authorizedRange: sentinelRange,
  };

  const systemPrompt = buildSystemPrompt(turn, arc, merchant);
  const userMessage = buildUserMessage(turn);

  const messages: Anthropic.MessageParam[] = [{ role: "user", content: userMessage }];
  let currentOrderState: OrderState = turn.orderState;
  let currentArc: NegotiationArc = arc;

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: systemPrompt,
      tools: toolDefinitions as unknown as Anthropic.Tool[],
      messages,
    });

    const toolUseBlocks = response.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
    );

    if (toolUseBlocks.length === 0) {
      const replyText = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n");

      await finalizeTurn(turn, currentOrderState, currentArc, replyText);
      return;
    }

    messages.push({ role: "assistant", content: response.content });

    const toolResults: Anthropic.ToolResultBlockParam[] = [];

    for (const block of toolUseBlocks) {
      ctx.orderState = currentOrderState;
      ctx.arc = currentArc;

      const result = await executeTool(block.name, block.input, ctx);

      // Reactive range recomputation + arc bootstrap. When check_inventory
      // returns a real price (and get_customer_profile the real tier), recompute
      // the authorized range and project it onto the arc. The range is only ever
      // as stale as one tool call — never the whole turn.
      if (result.rangeUpdate) {
        const { basePrice, tier, productSku } = result.rangeUpdate;

        if (basePrice !== undefined) currentBasePrice = basePrice;
        if (tier !== undefined) currentTier = tier;
        if (productSku !== undefined) {
          // Carry the real SKU + tier forward so deploy_tactic sees them.
          currentArc = { ...currentArc, productSku, tier: currentTier };
        }

        if (currentBasePrice > 0) {
          const updatedRules: MerchantPricingRules = {
            ...pricingRules,
            basePrice: currentBasePrice,
          };
          const range = computeAuthorizedRange(updatedRules, currentTier);
          ctx.authorizedRange = range;
          // Single source of truth: project anchor/floor/tier/sku onto the arc
          // so the next turn's system prompt and the tactic guards all agree.
          currentArc = projectRangeOntoArc(currentArc, range, productSku);
        }
      }

      if (result.newOrderState) currentOrderState = result.newOrderState;
      if (result.newArc) currentArc = result.newArc;

      toolResults.push({
        type: "tool_result",
        tool_use_id: block.id,
        content: JSON.stringify(result.output),
      });
    }

    messages.push({ role: "user", content: toolResults });
  }

  await escalateToHuman(turn, currentArc, "Negotiator exceeded max tool-call iterations");
}

// ─── System Prompt ────────────────────────────────────────────────────────────
//
// The floor shown here is arc.floor, which is 0 on a fresh arc until the loop's
// first check_inventory call updates it. That's intentional: the model is told
// to call check_inventory first, and tools.ts enforces the real floor regardless
// of what the prompt shows. Belt + suspenders.

function dialectGuidance(d: Dialect): string {
  switch (d) {
    case "pidgin":
      return 'Reply in warm Nigerian Pidgin English where it reads naturally ("abeg", "o", "sharp sharp", "no wahala"). Stay easy to understand.';
    case "yoruba":
      return 'Use Yoruba-inflected Nigerian English; drop light Yoruba phrases ("ẹ kú iṣẹ́", "ó dára") where natural.';
    case "igbo":
      return 'Use Igbo-inflected Nigerian English; drop light Igbo phrases ("daalụ", "ọ dị mma") where natural.';
    case "hausa":
      return 'Use Hausa-inflected Nigerian English; drop light Hausa phrases ("sannu", "madalla") where natural.';
    case "english":
      return "Use clear, friendly Nigerian English.";
  }
}

function buildSystemPrompt(
  turn: ConversationTurn,
  arc: NegotiationArc,
  merchant: MerchantContext,
): string {
  const tactics = availableTactics({ arc, currentStockLevel: 0 });

  const policiesBlock = merchant.businessPolicies
    ? `Business policies (honour these; quote them naturally when relevant):\n${merchant.businessPolicies}`
    : "";
  const deliveryBlock = merchant.deliveryInfo
    ? `Delivery options you may quote:\n${merchant.deliveryInfo}`
    : "";

  return `You are the autonomous sales & negotiation agent for ${merchant.name}, a WhatsApp business.
You are a skilled, relationship-aware market trader acting on behalf of ${merchant.name}.
Your goal: close the deal at the highest price the customer will accept — within authorized bounds.

══ WHO YOU ARE (THE SELLER'S VOICE) ══
${merchant.toneGuide ?? "Warm, professional Nigerian market seller — friendly, never pushy."}
Language: ${dialectGuidance(merchant.dialect)}
${policiesBlock}
${deliveryBlock}

══ CURRENT NEGOTIATION STATE ══
Stage: ${arc.stage}
Customer tier: ${arc.tier}
Anchor price: ${arc.anchorPrice > 0 ? `₦${arc.anchorPrice.toLocaleString()}` : "unknown — call check_inventory first"}
Authorized floor: ${arc.floor > 0 ? `₦${arc.floor.toLocaleString()}` : "unknown — call check_inventory first"}
Agent's last offer: ${arc.agentLastOffer ? `₦${arc.agentLastOffer.toLocaleString()}` : "none yet"}
Customer's last offer: ${arc.customerLastOffer ? `₦${arc.customerLastOffer.toLocaleString()}` : "none yet"}

Tactics already deployed: [${arc.tacticsDeployed.join(", ") || "none"}]
Tactics still available: [${tactics.join(", ")}]
${arc.urgencyWindowExpiresAt ? `Urgency window active — expires: ${new Date(arc.urgencyWindowExpiresAt).toLocaleTimeString()}` : ""}

══ NEGOTIATION RULES ══
1. ALWAYS call check_inventory and get_customer_profile before quoting any price.
   You cannot propose a price until the authorized range is known.
2. NEVER open below anchor price. Always anchor high first.
3. NEVER propose a price below the floor — propose_price enforces this and will
   block you with a circuit_breaker signal telling you which tactics to use instead.
4. You MUST call propose_price when naming a price — never say a price in plain text.
5. Call deploy_tactic BEFORE using any tactic in your message. Pass the productSku.
6. Only call close_deal when the customer has unambiguously said yes.
7. escalate_to_merchant is only available after both bundle_pivot AND future_credit
   have been attempted — the tool will reject premature escalation.
8. Keep replies to 2–4 sentences. This is WhatsApp. Not email.
9. Write in the seller's voice and language defined above. Stay in character as ${merchant.name}.
10. Sell on VALUE using real product context — describe the fabric, fit, sizes, and
    occasion from check_inventory (description/category/attributes) before you ever
    discount. Suggest genuine bundles from the catalog (e.g. a gele with a gown).
11. Only quote delivery, returns, deposits, or hours from the seller policies above.
    Never invent a policy. If asked something not covered, offer to check with the seller.

══ ARC PLAYBOOK ══
→ Fresh session: check_inventory → get_customer_profile → anchor with full price
→ Customer counters: acknowledge relationship/context → counter with tactic
→ Below floor: bundle pivot first, then credit offer, then escalate if both fail
→ Customer accepts: close_deal → issue_payment_link

══ ORDER STATE ══
${JSON.stringify(turn.orderState)}`;
}

function buildUserMessage(turn: ConversationTurn): string {
  return turn.messages
    .map((m) => {
      switch (m.content.type) {
        case "text": return m.content.text;
        case "audio": return "[voice note — ask customer to type if unclear]";
        case "image": return `[image${m.content.caption ? `: ${m.content.caption}` : ""}]`;
        case "interactive": return `[button reply: ${JSON.stringify(m.content.payload)}]`;
      }
    })
    .join("\n");
}

// ─── Arc Persistence ──────────────────────────────────────────────────────────

function arcKey(customerId: string, merchantId: string) {
  return `arc:${merchantId}:${customerId}`;
}

async function loadOrCreateArc(turn: ConversationTurn): Promise<NegotiationArc> {
  const key = arcKey(turn.customerId, turn.merchantId);
  const raw = await redis.get(key);

  if (raw) {
    const existing = JSON.parse(raw) as NegotiationArc;
    // A terminal arc from a previous deal shouldn't bleed into a new one.
    if (["close", "escalate", "abandoned"].includes(existing.stage)) {
      return createFreshArc(turn);
    }
    return existing;
  }

  return createFreshArc(turn);
}

function createFreshArc(turn: ConversationTurn): NegotiationArc {
  const now = Date.now();
  return {
    sessionId: crypto.randomUUID(),
    merchantId: turn.merchantId,
    customerId: turn.customerId,
    productSku: "TBD", // Replaced by rangeUpdate from check_inventory
    anchorPrice: 0,    // Replaced after check_inventory + recompute
    floor: 0,          // Replaced after check_inventory + recompute
    tier: "new",       // Replaced by rangeUpdate from get_customer_profile
    stage: "anchor",
    tacticsDeployed: [],
    bundlePivotAttempted: false,
    futureCreditAttempted: false,
    scarcitySignalDeployed: false,
    turns: [],
    createdAt: now,
    updatedAt: now,
  };
}

async function saveArc(arc: NegotiationArc): Promise<void> {
  const key = arcKey(arc.customerId, arc.merchantId);
  await redis.setex(key, 60 * 60 * 24, JSON.stringify(arc));
}

// ─── Finalization ─────────────────────────────────────────────────────────────

async function finalizeTurn(
  turn: ConversationTurn,
  finalOrderState: OrderState,
  finalArc: NegotiationArc,
  replyText: string,
): Promise<void> {
  // Persist the order if it changed and actually exists.
  if (finalOrderState !== turn.orderState && finalOrderState.status !== "no_order") {
    await sql`
      insert into orders (id, merchant_id, customer_id, state, updated_at)
      values (
        ${finalOrderState.orderId},
        ${turn.merchantId},
        ${turn.customerId},
        ${jsonb(finalOrderState)},
        now()
      )
      on conflict (id) do update set state = excluded.state, updated_at = now()
    `;
  }

  // Flush the enterprise data asset on terminal arcs. buildNegotiationTrace
  // returns null mid-negotiation, so this is a no-op until the arc is terminal.
  await flushNegotiationTrace(finalArc);

  await saveArc(finalArc);

  // Send via the single outbound chokepoint, which classifies the service window
  // (free session vs. billable) and will swap in template fallback in Phase 2.
  if (replyText.trim().length > 0) {
    const phoneNumberId = turn.messages[0].toPhoneNumberId;
    await sendCustomerMessage({ toPhone: turn.customerId, text: replyText }, phoneNumberId);
  }
}

// ─── NegotiationTrace Flush ───────────────────────────────────────────────────

async function flushNegotiationTrace(arc: NegotiationArc): Promise<void> {
  const trace = buildNegotiationTrace(arc);
  if (!trace) return; // Non-terminal arc — nothing to record yet.

  await sql`
    insert into negotiation_traces (
      session_id, merchant_id, customer_id, customer_tier,
      anchor_price, authorized_floor,
      outcome, final_price, final_margin,
      tactics_deployed, tactics_succeeded,
      price_elasticity_signal, turns, created_at
    ) values (
      ${trace.sessionId},
      ${trace.merchantId},
      ${trace.customerId},
      ${trace.customerTier},
      ${trace.anchorPrice},
      ${trace.authorizedFloor},
      ${trace.outcome},
      ${trace.finalPrice},
      ${trace.finalMargin},
      ${jsonb(trace.tacticsDeployed)},
      ${jsonb(trace.tacticsSucceeded)},
      ${trace.priceElasticitySignal},
      ${jsonb(trace.turns)},
      now()
    )
    on conflict (session_id) do nothing
  `;
}

// ─── Human Escalation ─────────────────────────────────────────────────────────

async function escalateToHuman(
  turn: ConversationTurn,
  arc: NegotiationArc,
  reason: string,
): Promise<void> {
  await sql`
    insert into escalations (merchant_id, customer_id, reason, context, created_at)
    values (
      ${turn.merchantId}, ${turn.customerId}, ${reason},
      ${jsonb({ turn, arc })},
      now()
    )
  `;
  const phoneNumberId = turn.messages[0].toPhoneNumberId;
  await sendCustomerMessage(
    { toPhone: turn.customerId, text: "Let me check on this and get back to you shortly!" },
    phoneNumberId,
  );
}

// ─── Merchant Context (the seller's voice) ─────────────────────────────────────

async function loadMerchantContext(merchantId: string): Promise<MerchantContext> {
  const rows = await sql<{
    id: string;
    name: string;
    tone_guide: string | null;
    business_policies: string | null;
    delivery_info: string | null;
    dialect: string;
  }[]>`
    select id, name, tone_guide, business_policies, delivery_info, dialect
    from merchants
    where id = ${merchantId}
    limit 1
  `;
  const row = rows[0];
  if (!row) {
    // Don't fail a live customer turn over missing seller copy — fall back to a
    // neutral persona. The agent still negotiates correctly within the rules.
    return {
      id: merchantId,
      name: "our shop",
      toneGuide: null,
      businessPolicies: null,
      deliveryInfo: null,
      dialect: "pidgin",
    };
  }
  return {
    id: row.id,
    name: row.name,
    toneGuide: row.tone_guide,
    businessPolicies: row.business_policies,
    deliveryInfo: row.delivery_info,
    dialect: normalizeDialect(row.dialect),
  };
}

function normalizeDialect(value: string): Dialect {
  const allowed: Dialect[] = ["pidgin", "yoruba", "igbo", "hausa", "english"];
  return (allowed as string[]).includes(value) ? (value as Dialect) : "pidgin";
}

// ─── Merchant Pricing Rules ───────────────────────────────────────────────────

async function loadMerchantPricingRules(merchantId: string): Promise<MerchantPricingRules> {
  const rows = await sql<{
    absolute_floor: number;
    max_discount_by_tier: Record<string, number>;
    max_bundle_value_add_by_tier: Record<string, number>;
    future_credit_cap_by_tier: Record<string, number>;
  }[]>`
    select
      absolute_floor,
      max_discount_by_tier,
      max_bundle_value_add_by_tier,
      future_credit_cap_by_tier
    from merchant_pricing_rules
    where merchant_id = ${merchantId}
    limit 1
  `;

  // base_price is NOT loaded here — it's per-product, set reactively from
  // check_inventory via rangeUpdate. The rules object starts with basePrice=0.
  if (!rows[0]) {
    return {
      basePrice: 0,
      absoluteFloor: 0,
      maxDiscountByTier: { new: 0.05, returning: 0.15, loyal: 0.22, vip: 0.30 },
      maxBundleValueAddByTier: { new: 0, returning: 0.10, loyal: 0.20, vip: 0.30 },
      futureCreditCapByTier: { new: 0, returning: 1000, loyal: 2500, vip: 5000 },
    };
  }

  return {
    basePrice: 0, // Set by check_inventory via rangeUpdate
    absoluteFloor: rows[0].absolute_floor,
    maxDiscountByTier: rows[0].max_discount_by_tier as Record<CustomerTier, number>,
    maxBundleValueAddByTier: rows[0].max_bundle_value_add_by_tier as Record<CustomerTier, number>,
    futureCreditCapByTier: rows[0].future_credit_cap_by_tier as Record<CustomerTier, number>,
  };
}
