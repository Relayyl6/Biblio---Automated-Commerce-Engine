// core/ai-negotiator/src/agentLoop.ts
//
// PRODUCTION ADDITIONS IN THIS VERSION:
//
// 1) RESILIENT MODEL CALLS. Anthropic's API can return 429 (rate limit) or
//    529 (overloaded) — both transient. A naive `await anthropic.messages
//    .create(...)` with no retry means a momentary blip kills the entire
//    negotiation turn and the customer gets silence. We wrap the call with
//    a small retry, same backoff-with-jitter pattern as comms-router uses
//    for WhatsApp sends.
//
// 2) PER-TURN TIMEOUT. 8 iterations of tool calls could, in a pathological
//    case, take a very long time. A hard ceiling means a stuck turn fails
//    into escalateToHuman rather than holding the Redis lock (and the
//    customer's attention) indefinitely.
//
// 3) TURN-LEVEL TRY/CATCH WITH GUARANTEED CUSTOMER-FACING FALLBACK. If
//    anything in `_runTurn` throws after retries are exhausted — a DB
//    outage, a malformed tool result, whatever — the customer must not
//    just get silence. We catch at the top level and escalate.
//
// 4) CORRECT, CONFIGURABLE MODEL STRING. Loaded from env so you can roll
//    forward to a new model version without a code deploy.

import Anthropic from "@anthropic-ai/sdk";
import { sql, redis, jsonb } from "@ace/shared/clients";
import { loadNegotiatorEnv } from "@ace/shared/env";
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
import { dataIntelligence } from "@ace/shared/data-intelligence/engine";
import { vendorCommunique } from "../../comms-router/src/vendorCommunique.js";

const env = loadNegotiatorEnv();
const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
const MODEL = env.ANTHROPIC_MODEL;
const MAX_ITERATIONS = 8;
const LOCK_TTL_SECONDS = 300;
const TURN_TIMEOUT_MS = 45_000; // hard ceiling; well above p99 for an 8-iteration turn
const MAX_MODEL_RETRIES = 3;

// ─── Main Entry Point ─────────────────────────────────────────────────────────

export async function runNegotiatorTurn(turn: ConversationTurn): Promise<void> {
  const lockKey = `lock:negotiation:${turn.customerId}`;
  const lockAcquired = await redis.set(lockKey, "1", "EX", LOCK_TTL_SECONDS, "NX");

  if (!lockAcquired) {
    console.warn(`[negotiator] lock contention for customer ${turn.customerId} — dropping duplicate turn`);
    return;
  }

  try {
    await withTimeout(_runTurn(turn), TURN_TIMEOUT_MS);
  } catch (err) {
    console.error(`[negotiator] turn failed for customer ${turn.customerId}:`, err);
    // Guaranteed customer-facing fallback. A silent failure here is worse
    // than an imperfect one — the customer is mid-negotiation and waiting.
    await safeEscalate(turn, `Unhandled error in negotiator turn: ${(err as Error).message}`);
  } finally {
    await redis.del(lockKey);
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`turn exceeded ${ms}ms timeout`)), ms);
    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); },
    );
  });
}

async function safeEscalate(turn: ConversationTurn, reason: string): Promise<void> {
  try {
    // Build a minimal arc if we don't have one — this path can be hit
    // before loadOrCreateArc ever ran.
    const arc = await loadOrCreateArc(turn).catch(() => createFreshArc(turn));
    await escalateToHuman(turn, arc, reason);
  } catch (err) {
    // If even escalation fails (e.g. DB is fully down), this is the last
    // line of defense — log loud, don't crash the worker process.
    console.error(`[negotiator] CRITICAL: escalation itself failed for customer ${turn.customerId}:`, err);
  }
}

async function _runTurn(turn: ConversationTurn): Promise<void> {
  const arc = await loadOrCreateArc(turn);
  const [pricingRules, merchant] = await Promise.all([
    loadMerchantPricingRules(turn.merchantId),
    loadMerchantContext(turn.merchantId),
  ]);

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
    const response = await createMessageWithRetry({
      model: MODEL,
      max_tokens: 1024,
      system: systemPrompt,
      tools: toolDefinitions as unknown as Anthropic.Tool[],
      messages,
    });

    // Observability: token usage drives per-merchant AI cost attribution.
    logTokenUsage(turn.merchantId, response.usage);

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

      let result;
      try {
        result = await executeTool(block.name, block.input, ctx);
      } catch (err) {
        // A single tool failure (e.g. inventory DB hiccup) shouldn't kill
        // the whole turn — feed the error back to the model as a tool
        // result so it can adapt (retry, apologize, or pivot tactics),
        // matching how Claude expects tool-use failures to be reported.
        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: JSON.stringify({ error: `tool_failed: ${(err as Error).message}` }),
          is_error: true,
        });
        continue;
      }

      if (result.rangeUpdate) {
        const { basePrice, tier, productSku } = result.rangeUpdate;

        if (basePrice !== undefined) currentBasePrice = basePrice;
        if (tier !== undefined) currentTier = tier;
        if (productSku !== undefined) {
          currentArc = { ...currentArc, productSku, tier: currentTier };
        }

        if (currentBasePrice > 0) {
          const updatedRules: MerchantPricingRules = {
            ...pricingRules,
            basePrice: currentBasePrice,
          };
          const range = computeAuthorizedRange(updatedRules, currentTier);
          ctx.authorizedRange = range;
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

// ─── Resilient model call ──────────────────────────────────────────────────

async function createMessageWithRetry(
  params: Anthropic.MessageCreateParamsNonStreaming,
  attempt = 1,
): Promise<Anthropic.Message> {
  try {
    return await anthropic.messages.create(params);
  } catch (err: any) {
    const status = err?.status;
    const isRetryable = status === 429 || status === 529 || status >= 500;

    if (isRetryable && attempt < MAX_MODEL_RETRIES) {
      const backoffMs = 500 * 2 ** (attempt - 1) + Math.random() * 250;
      await new Promise((r) => setTimeout(r, backoffMs));
      return createMessageWithRetry(params, attempt + 1);
    }
    throw err;
  }
}

function logTokenUsage(merchantId: string, usage: Anthropic.Usage | undefined) {
  if (!usage) return;
  console.info(
    `[negotiator] merchant=${merchantId} input_tokens=${usage.input_tokens} output_tokens=${usage.output_tokens}`,
  );
  // In a real deployment, push this to your metrics/billing pipeline
  // (e.g. dataIntelligence.logTokenUsage) rather than console.info —
  // per-merchant AI cost attribution matters once you have >1 paying merchant.
}

// ─── System Prompt ────────────────────────────────────────────────────────────

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
    productSku: "TBD",
    anchorPrice: 0,
    floor: 0,
    tier: "new",
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

  await flushNegotiationTrace(finalArc);
  await saveArc(finalArc);

  if (replyText.trim().length > 0) {
    const phoneNumberId = replyPhoneNumberId(turn);
    await sendCustomerMessage(
      { toPhone: turn.customerId, text: replyText },
      phoneNumberId,
      turn.merchantId,
    );
  }
}

function replyPhoneNumberId(turn: ConversationTurn): string | undefined {
  const first = turn.messages[0];
  return first && "toPhoneNumberId" in first ? first.toPhoneNumberId : undefined;
}

// ─── NegotiationTrace Flush ───────────────────────────────────────────────────

async function flushNegotiationTrace(arc: NegotiationArc): Promise<void> {
  const trace = buildNegotiationTrace(arc);
  if (!trace) return;

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

  await dataIntelligence.logNegotiationTrace(trace as any);
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
  const phoneNumberId = replyPhoneNumberId(turn);
  await sendCustomerMessage(
    { toPhone: turn.customerId, text: "Let me check on this and get back to you shortly!" },
    phoneNumberId,
    turn.merchantId,
  );

  const merchantPhone = await loadMerchantNotificationPhone(turn.merchantId);
  await vendorCommunique.dispatchEscalation(
    turn.merchantId,
    merchantPhone,
    turn.customerId,
    reason,
    { turn, arc },
  );
}

async function loadMerchantNotificationPhone(merchantId: string): Promise<string> {
  const rows = await sql<{ notification_phone: string | null }[]>`
    select notification_phone from merchants where id = ${merchantId} limit 1
  `;
  return rows[0]?.notification_phone ?? "";
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
    basePrice: 0,
    absoluteFloor: rows[0].absolute_floor,
    maxDiscountByTier: rows[0].max_discount_by_tier as Record<CustomerTier, number>,
    maxBundleValueAddByTier: rows[0].max_bundle_value_add_by_tier as Record<CustomerTier, number>,
    futureCreditCapByTier: rows[0].future_credit_cap_by_tier as Record<CustomerTier, number>,
  };
}