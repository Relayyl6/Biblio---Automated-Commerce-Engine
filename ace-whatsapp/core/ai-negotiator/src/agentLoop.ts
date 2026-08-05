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

import Groq from "groq-sdk";
import { sql, redis, jsonb } from "@ace/shared/clients";
import { loadNegotiatorEnv } from "@ace/shared/env";
import { sendCustomerMessage, setTypingIndicator } from "../../comms-router/src/outbound";
import { executeTool, toolDefinitions, type ToolContext } from "./tools";
import {
  computeAuthorizedRange,
  type MerchantPricingRules,
  type AuthorizedPriceRange,
  type CustomerTier,
} from "./pricingService";
import {
  advanceArc,
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
const groq = new Groq({ apiKey: env.GROQ_API_KEY || process.env.GROQ_API_KEY || "" });
const MODEL = env.GROQ_MODEL || process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
const MAX_ITERATIONS = 8;
const LOCK_TTL_SECONDS = 300;
const TURN_TIMEOUT_MS = 45_000; // hard ceiling; well above p99 for an 8-iteration turn
const MAX_MODEL_RETRIES = 3;

type Dialect = "pidgin" | "yoruba" | "igbo" | "hausa" | "english";

interface DialectProfile {
  /** Human-readable name, useful for logging/debugging */
  label: string;
  /** Core instruction on tone/style */
  tone: string;
  /** Natural phrases the model can sprinkle in, kept minimal to avoid overuse */
  samplePhrases?: string[];
  /** Explicit anti-patterns to steer away from stereotyping or forced slang */
  avoid?: string[];
}

// Map tool schemas to Groq/OpenAI function format
const groqTools: Groq.Chat.ChatCompletionTool[] = toolDefinitions.map((t) => ({
  type: "function",
  function: {
    name: t.name,
    description: t.description,
    parameters: t.input_schema,
  },
}));

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
  // ── Show typing indicator immediately ──
  await setTypingIndicator(turn.customerId, turn.merchantId).catch(console.warn);

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

  let currentOrderState: OrderState = turn.orderState;
  let currentArc: NegotiationArc = {
    ...arc,
    dialect: merchant.dialect,
  };

  // Extract any customer price offer from inbound messages and record on the arc
  const customerOffer = extractCustomerPriceOffer(turn.messages);
  if (customerOffer !== null && currentArc.stage !== "close") {
    currentArc = advanceArc(currentArc, {
      type: "CUSTOMER_COUNTERED",
      customerOffer,
    });
  }

  const ctx: ToolContext = {
    customerId: turn.customerId,
    merchantId: turn.merchantId,
    orderState: turn.orderState,
    arc: currentArc,
    authorizedRange: sentinelRange,
  };

  const systemPrompt = buildSystemPrompt(turn, currentArc, merchant);
  const userContent = buildUserContent(turn);

  const messages: Groq.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userContent as any },
  ];

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const response = await createMessageWithRetry({
      model: MODEL,
      max_tokens: 1024,
      temperature: 0.3,
      messages,
      tools: groqTools,
      tool_choice: "auto",
    });

    logTokenUsage(turn.merchantId, response.usage);

    const choice = response.choices[0];
    if (!choice) break;

    const assistantMsg = choice.message;
    const toolCalls = assistantMsg.tool_calls;

    if (!toolCalls || toolCalls.length === 0) {
      const replyText = assistantMsg.content || "";
      await finalizeTurn(turn, currentOrderState, currentArc, replyText);
      return;
    }

    messages.push(assistantMsg as any);

    for (const call of toolCalls) {
      ctx.orderState = currentOrderState;
      ctx.arc = currentArc;

      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(call.function.arguments || "{}");
      } catch {
        args = {};
      }

      let result;
      try {
        result = await executeTool(call.function.name, args, ctx);
      } catch (err) {
        messages.push({
          role: "tool",
          tool_call_id: call.id,
          content: JSON.stringify({ error: `tool_failed: ${(err as Error).message}` }),
        } as any);
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

      messages.push({
        role: "tool",
        tool_call_id: call.id,
        content: JSON.stringify(result.output),
      } as any);
    }
  }

  await escalateToHuman(turn, currentArc, "Negotiator exceeded max tool-call iterations");
}

// ─── Customer Price Extraction ──────────────────────────────────────────────

function extractCustomerPriceOffer(messages: ConversationTurn["messages"]): number | null {
  for (const m of messages) {
    let text = "";
    if (m.content.type === "text") {
      text = m.content.text;
    } else if (m.content.type === "audio" && m.content.transcript) {
      text = m.content.transcript;
    } else {
      continue;
    }
    if (!text) continue;

    // First check for 'k' notation: 15k -> 15000, 12.5k -> 12500
    const kMatch = text.match(/(?:₦|N|NGN|\b)?\s*(\d+(?:\.\d+)?)\s*k\b/i);

    if (kMatch && kMatch[1]) {
      const val = parseFloat(kMatch[1]) * 1000;
      if (!isNaN(val) && val > 0) return val;
    }

    // Match currency symbols or explicit numbers: ₦15,000, N15000, NGN 20000
    const priceMatch = text.match(/(?:₦|N|NGN|\$)\s*([\d,]+(?:\.\d+)?)/i);
    if (priceMatch && priceMatch[1]) {
      const cleaned = priceMatch[1].replace(/,/g, "");
      const val = parseFloat(cleaned);
      if (!isNaN(val) && val > 0) return val;
    }

    // Match numbers followed by naira/ngn
    const nairaMatch = text.match(/\b([\d,]+(?:\.\d+)?)\s*(?:naira|ngn)\b/i);
    if (nairaMatch && nairaMatch[1]) {
      const cleaned = nairaMatch[1].replace(/,/g, "");
      const val = parseFloat(cleaned);
      if (!isNaN(val) && val > 0) return val;
    }

    // Match contextual patterns: "offer 15000", "pay 12000", "have 8000"
    const contextMatch = text.match(/(?:pay|offer|take|have|give|give you|last|price for)?\s*[\s:]*([1-9]\d{3,6})(?!\d)/i);
    if (contextMatch && contextMatch[1]) {
      const val = parseFloat(contextMatch[1]);
      if (!isNaN(val) && val > 0) return val;
    }
  }
  return null;
}

// ─── Resilient model call ──────────────────────────────────────────────────

async function createMessageWithRetry(
  params: Parameters<typeof groq.chat.completions.create>[0],
  attempt = 1,
): Promise<any> {
  try {
    return await groq.chat.completions.create(params);
  } catch (err: any) {
    const status = err?.status;
    const isRetryable = status === 429 || status === 503 || status >= 500;

    if (isRetryable && attempt < MAX_MODEL_RETRIES) {
      const backoffMs = 500 * 2 ** (attempt - 1) + Math.random() * 250;
      await new Promise((r) => setTimeout(r, backoffMs));
      return createMessageWithRetry(params, attempt + 1);
    }
    throw err;
  }
}

function logTokenUsage(merchantId: string, usage: { prompt_tokens?: number; completion_tokens?: number } | undefined) {
  if (!usage) return;
  const promptTokens = usage.prompt_tokens ?? 0;
  const completionTokens = usage.completion_tokens ?? 0;

  // Pipeline telemetry to DataIntelligenceEngine for cost attribution and enterprise billing
  dataIntelligence.logTokenUsage({
    service: "ai-negotiator",
    merchantId,
    model: MODEL,
    promptTokens,
    completionTokens,
  }).catch(() => {});
}


// ─── System Prompt ────────────────────────────────────────────────────────────
const DIALECT_PROFILES: Record<Dialect, DialectProfile> = {
  pidgin: {
    label: "Nigerian Pidgin",
    tone:
      "Use crisp, natural Nigerian English with a subtle street-smart flair. Be extremely concise.",
    avoid: ["sharp sharp", "abeg", "forced or stereotypical slang"],
  },
  yoruba: {
    label: "Yoruba-inflected",
    tone: "Use Yoruba-inflected Nigerian English.",
    samplePhrases: ["ẹ kú iṣẹ́", "ó dára"],
  },
  igbo: {
    label: "Igbo-inflected",
    tone: "Use Igbo-inflected Nigerian English.",
    samplePhrases: ["daalụ", "ọ dị mma"],
  },
  hausa: {
    label: "Hausa-inflected",
    tone: "Use Hausa-inflected Nigerian English.",
    samplePhrases: ["sannu", "madalla"],
  },
  english: {
    label: "Standard Nigerian English",
    tone: "Use clear, friendly Nigerian English.",
  },
};

const DEFAULT_DIALECT: Dialect = "english";

function dialectGuidance(d: Dialect): string {
  const profile = DIALECT_PROFILES[d] ?? DIALECT_PROFILES[DEFAULT_DIALECT];

  const parts: string[] = [profile.tone];

  if (profile.samplePhrases?.length) {
    const phrases = profile.samplePhrases.map((p) => `"${p}"`).join(", ");
    parts.push(`Drop light phrases (e.g. ${phrases}) where natural — don't overuse them.`);
  }

  if (profile.avoid?.length) {
    const avoided = profile.avoid
      .filter((a) => !a.includes(" ") || a.split(" ").length <= 3)
      .map((a) => `"${a}"`)
      .join(", ");
    parts.push(`AVOID forced or stereotypical usage (e.g. ${avoided || "clichés"}).`);
  }

  return parts.join(" ");
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
   have failed, or if the customer specifically asks to speak to a human.
8. NEVER describe a product's features or details unless explicitly asked. If asked for a price, provide ONLY the price and availability in one short sentence.
9. Keep replies to 2–4 sentences. This is WhatsApp. Not email.
10. Write in the seller's voice and language defined above. Stay in character as ${merchant.name}.
11. Suggest genuine bundles from the catalog (e.g. a gele with a gown) if appropriate.
11. Only quote delivery, returns, deposits, or hours from the seller policies above.
    Never invent a policy. If asked something not covered, offer to check with the seller.
12. If the customer's message starts with [Replying to: "..."], use the quoted text
    as context for what they are responding to — factor it into your understanding.
13. If a message is labelled [Voice note], treat the transcribed words as the
    customer's exact message. Respond naturally without mentioning voice notes.
14. If the customer asks about prices or specs for items NOT in your catalog,
    call search_web to get real-time market context before answering.

══ ARC PLAYBOOK ══
→ Fresh session: check_inventory → get_customer_profile → anchor with full price
→ Customer counters: acknowledge relationship/context → counter with tactic
→ Below floor: bundle pivot first, then credit offer, then escalate if both fail
→ Customer accepts: close_deal → issue_payment_link

══ ORDER STATE ══
${JSON.stringify(turn.orderState)}`;
}

/**
 * Builds the user content for a Groq API call.
 * Returns either a string (for text/voice/orders) or a content part array
 * (when images are present).
 */
function buildUserContent(turn: ConversationTurn): string | Groq.Chat.ChatCompletionContentPart[] {
  const parts: Groq.Chat.ChatCompletionContentPart[] = [];
  let hasImage = false;

  for (const msg of turn.messages) {
    const c = msg.content;

    // ── Reply-thread context prefix ───────────────────────────────────────
    if (c.type === "text" && c.quotedText) {
      parts.push({
        type: "text",
        text: `[Replying to: "${c.quotedText}"]\n`,
      });
    }

    // ── Plain text ────────────────────────────────────────────────────────
    if (c.type === "text") {
      parts.push({ type: "text", text: c.text });
    }

    // ── Voice note: prefer transcript, gracefully degrade ─────────────────
    else if (c.type === "audio") {
      if (c.transcript) {
        parts.push({ type: "text", text: `[Voice note]: ${c.transcript}` });
      } else {
        parts.push({
          type: "text",
          text: "[Voice note — transcription unavailable. Ask customer to type their message.]",
        });
      }
    }

    // ── Image: use Groq Vision format when base64 available ───────────────
    else if (c.type === "image") {
      if (c.base64 && c.mimeType) {
        hasImage = true;
        if (c.caption) {
          parts.push({ type: "text", text: `[Image caption]: ${c.caption}` });
        }
        parts.push({
          type: "image_url",
          image_url: {
            url: `data:${c.mimeType};base64,${c.base64}`,
          },
        });
      } else {
        // Fallback: media download failed or wasn't resolved
        parts.push({
          type: "text",
          text: `[Image${c.caption ? `: ${c.caption}` : " — no caption"}]`,
        });
      }
    }

    // ── Interactive (WA Business orders, button replies) ───────────────────
    else if (c.type === "interactive") {
      parts.push({
        type: "text",
        text: `[Button reply / order: ${JSON.stringify(c.payload)}]`,
      });
    }
  }

  if (parts.length === 0) {
    return "[empty message]";
  }

  if (!hasImage) {
    return parts.map((p) => (p as { type: "text"; text: string }).text).join("\n");
  }

  return parts;
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
    
    // Split text into chunks by sentence boundaries (periods, exclamation marks, question marks)
    // or by newlines, keeping them as manageable chat bubbles.
    const chunks = replyText
      .split(/\n+/)
      .flatMap(p => p.split(/(?<=[.!?])\s+(?=[A-Z0-9])/))
      .map(c => c.trim())
      .filter(c => c.length > 0);

    for (const chunk of chunks) {
      // Trigger typing indicator
      await setTypingIndicator(turn.customerId, turn.merchantId, "composing");
      
      // Artificial delay to simulate human typing
      // e.g., 40ms per character, min 750ms, max 3 seconds
      const delayMs = Math.min(Math.max(chunk.length * 40, 750), 3000);
      await new Promise(r => setTimeout(r, delayMs));
      
      // Send the chunk
      await sendCustomerMessage(
        { toPhone: turn.customerId, text: chunk },
        phoneNumberId,
        turn.merchantId,
      );
      
      // Pause typing and add a small gap before next chunk
      await setTypingIndicator(turn.customerId, turn.merchantId, "paused");
      await new Promise(r => setTimeout(r, 600));
    }
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
  const vendorRows = await sql<{ personal_number: string | null; business_line_number: string | null }[]>`
    select personal_number, business_line_number from vendors where merchant_id = ${merchantId} limit 1
  `.catch(() => []);
  if (vendorRows[0]?.personal_number || vendorRows[0]?.business_line_number) {
    return vendorRows[0].personal_number || vendorRows[0].business_line_number || "";
  }
  const rows = await sql<{ phone_number_id: string | null }[]>`
    select phone_number_id from merchants where id = ${merchantId} limit 1
  `.catch(() => []);
  return rows[0]?.phone_number_id ?? "";
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