// core/ai-negotiator/src/negotiationArc.ts
//
// ─── THE NEGOTIATION ARC STATE ────────────────────────────────────────────────
//
// This is one of the trickier design problems in the whole system. The README
// says: "manages position across the full arc within a single conversation
// thread, even across multiple messages over hours."
//
// That "even across multiple messages over hours" is the key constraint. It
// means this state CANNOT live in memory. A BullMQ job that fires at 2pm
// has no idea what the customer and AI were discussing at 10am. The arc state
// must be persisted, loaded at the start of each turn, and written back at the
// end.
//
// WHY NOT JUST GIVE THE LLM THE FULL CONVERSATION HISTORY?
// You could. And you should — but the arc state is DIFFERENT from the
// conversation transcript. The transcript tells the LLM *what was said*;
// the arc tells it *where we are strategically*:
//   - "We're in COUNTER, the customer's last offer was ₦13,000"
//   - "We already tried the Bundle Pivot and it was rejected"
//   - "The scarcity signal was deployed at 10:42am"
//
// Without this, the model would re-read the transcript on every turn and
// re-derive the tactical position — possible, but expensive and error-prone
// (it might conclude "I haven't tried bundle pivot" when it actually has).
// The arc is the agent's working memory of the *strategy*, separate from
// the *conversation*.
//
// ─── ARC STATE MACHINE ───────────────────────────────────────────────────────
//
// Note that this is a DIFFERENT state machine from the OrderStateMachine.
// The order machine tracks "what has happened to this order" (draft →
// awaiting_payment → etc.). The arc machine tracks "where are we in the
// negotiation" (anchor → counter → close). They run in parallel:
//   - Arc machine: CLOSE fires → Order machine: QUOTE_CREATED
//   - Arc machine: ESCALATE fires → Order machine: stays in no_order,
//                                   merchant notification sent

import type { CustomerTier, AuthorizedPriceRange } from "./pricingService";
import type { Dialect } from "@ace/shared/types";


export type ArcStage =
  | "anchor"      // Opening — AI has stated the full price, waiting for customer response
  | "acknowledge" // Customer has countered — AI is about to acknowledge before countering
  | "counter"     // AI has made a counter-offer, customer hasn't responded yet
  | "close"       // Deal terms agreed — moving to checkout
  | "pivot"       // Customer below floor — attempting bundle or credit
  | "escalate"    // All tactics exhausted — escalated to merchant
  | "abandoned"   // Customer stopped responding
  | "awaiting_source"; // Waiting for a supplier/source to reply with a price

export type NegotiationTactic =
  | "relationship_anchor"
  | "bundle_pivot"
  | "scarcity_signal"
  | "future_credit"
  | "urgency_window"
  | "soft_close";

export interface NegotiationTurn {
  role: "customer" | "agent";
  message?: string;
  offer?: number;
  offeredPrice?: number;
  tactic?: NegotiationTactic;
  tacticUsed?: NegotiationTactic;
  at?: number;
  timestamp: number;
}

export interface NegotiationArc {
  sessionId: string;
  merchantId: string;
  customerId: string;
  productSku: string;

  // Authorized range — loaded from pricingService at session start,
  // stored here so we don't re-query merchant rules on every turn.
  anchorPrice: number;
  floor: number;
  tier: CustomerTier;
  dialect?: Dialect;

  // Position tracking
  stage: ArcStage;
  customerLastOffer?: number;   // Most recent explicit price customer named
  agentLastOffer?: number;      // Most recent price agent proposed
  tacticsDeployed: NegotiationTactic[];

  // Tactic availability guards — tracked here so model can't "un-deploy" a tactic
  bundlePivotAttempted: boolean;
  futureCreditAttempted: boolean;
  scarcitySignalDeployed: boolean;
  urgencyWindowExpiresAt?: number; // Unix ms — for the countdown to be real

  // Full message transcript — carried alongside the arc for context assembly
  turns: NegotiationTurn[];

  // Outcome tracking (set on terminal stages)
  outcome?: "closed" | "below_floor_escalated" | "bundle_closed" | "abandoned";
  finalPrice?: number;

  // ── Supplier Sourcing ──────────────────────────────────────────────────────
  // Populated when stage = "awaiting_source". Cleared when source replies.
  sourceQuoteRequest?: {
    productQuery: string;        // What the customer asked about
    sourcesContacted: string[];  // source IDs already messaged (to avoid re-sending)
    quoteIds: string[];          // source_quotes row IDs to track replies
    sentAt: number;              // Unix ms — to enforce reply timeout
    timeoutAt: number;           // Unix ms — when to escalate if no reply
  };

  createdAt: number;
  updatedAt: number;
}

// ─── Arc Transitions ──────────────────────────────────────────────────────────
//
// Like the order state machine, arc transitions are pure functions. The
// agent loop calls these AFTER the model produces its reply, using the
// model's declared intent (via a tool call) to drive the transition.

export class ArcTransitionError extends Error {
  constructor(public readonly from: ArcStage, public readonly event: string, reason: string) {
    super(`Illegal arc transition: ${event} from stage '${from}' — ${reason}`);
    this.name = "ArcTransitionError";
  }
}

export type ArcEvent =
  | { type: "AGENT_ANCHORED"; agentPrice: number }
  | { type: "CUSTOMER_COUNTERED"; customerOffer: number }
  | { type: "AGENT_COUNTERED"; agentOffer: number; tactic?: NegotiationTactic }
  | { type: "DEAL_ACCEPTED"; finalPrice: number }
  | { type: "BUNDLE_PIVOTED"; agentOffer: number }
  | { type: "CREDIT_OFFERED"; creditAmount: number }
  | { type: "ESCALATED_TO_MERCHANT" }
  | { type: "CUSTOMER_ABANDONED" }
  | { type: "SOURCE_QUERIED"; productQuery: string; quoteIds: string[]; timeoutAt: number }
  | { type: "SOURCE_REPLIED"; customerPrice: number; sourceName: string };

export function advanceArc(arc: NegotiationArc, event: ArcEvent): NegotiationArc {
  const now = Date.now();

  switch (event.type) {
    case "AGENT_ANCHORED": {
      if (arc.stage !== "anchor") {
        throw new ArcTransitionError(arc.stage, event.type, "can only anchor from initial stage");
      }
      return {
        ...arc,
        stage: "acknowledge",
        agentLastOffer: event.agentPrice,
        updatedAt: now,
      };
    }

    case "CUSTOMER_COUNTERED": {
      return {
        ...arc,
        stage: "counter",
        customerLastOffer: event.customerOffer,
        turns: [
          ...arc.turns,
          {
            role: "customer",
            offer: event.customerOffer,
            offeredPrice: event.customerOffer,
            at: now,
            timestamp: now,
          },
        ],
        updatedAt: now,
      };
    }

    case "AGENT_COUNTERED": {
      const nextTactics = event.tactic ? addTactic(arc.tacticsDeployed, event.tactic) : arc.tacticsDeployed;
      const isScarcity = event.tactic === "scarcity_signal";

      return {
        ...arc,
        stage: "counter",
        agentLastOffer: event.agentOffer,
        tacticsDeployed: nextTactics,
        scarcitySignalDeployed: arc.scarcitySignalDeployed || isScarcity,
        turns: [
          ...arc.turns,
          {
            role: "agent",
            offer: event.agentOffer,
            offeredPrice: event.agentOffer,
            tactic: event.tactic,
            tacticUsed: event.tactic,
            at: now,
            timestamp: now,
          },
        ],
        updatedAt: now,
      };
    }

    case "BUNDLE_PIVOTED": {
      return {
        ...arc,
        stage: "pivot",
        bundlePivotAttempted: true,
        agentLastOffer: event.agentOffer,
        tacticsDeployed: addTactic(arc.tacticsDeployed, "bundle_pivot"),
        turns: [
          ...arc.turns,
          {
            role: "agent",
            offer: event.agentOffer,
            offeredPrice: event.agentOffer,
            tactic: "bundle_pivot",
            tacticUsed: "bundle_pivot",
            at: now,
            timestamp: now,
          },
        ],
        updatedAt: now,
      };
    }

    case "CREDIT_OFFERED": {
      return {
        ...arc,
        stage: "pivot",
        futureCreditAttempted: true,
        tacticsDeployed: addTactic(arc.tacticsDeployed, "future_credit"),
        turns: [
          ...arc.turns,
          {
            role: "agent",
            tactic: "future_credit",
            tacticUsed: "future_credit",
            at: now,
            timestamp: now,
          },
        ],
        updatedAt: now,
      };
    }

    case "SOURCE_QUERIED": {
      return {
        ...arc,
        stage: "awaiting_source",
        sourceQuoteRequest: {
          productQuery: event.productQuery,
          sourcesContacted: [], // Will populate via tool
          quoteIds: event.quoteIds,
          sentAt: now,
          timeoutAt: event.timeoutAt,
        },
        updatedAt: now,
      };
    }

    case "SOURCE_REPLIED": {
      if (arc.stage !== "awaiting_source") {
        throw new ArcTransitionError(arc.stage, event.type, "can only receive source reply when awaiting source");
      }
      return {
        ...arc,
        stage: "anchor", // Or "counter" depending on where we were, default to anchor for new flow
        agentLastOffer: event.customerPrice,
        sourceQuoteRequest: undefined, // Clear the hold
        updatedAt: now,
      };
    }

    case "DEAL_ACCEPTED": {
      return {
        ...arc,
        stage: "close",
        outcome: "closed",
        finalPrice: event.finalPrice,
        agentLastOffer: event.finalPrice,
        turns: [
          ...arc.turns,
          {
            role: "agent",
            offer: event.finalPrice,
            offeredPrice: event.finalPrice,
            at: now,
            timestamp: now,
          },
        ],
        updatedAt: now,
      };
    }

    case "ESCALATED_TO_MERCHANT": {
      return {
        ...arc,
        stage: "escalate",
        outcome: "below_floor_escalated",
        updatedAt: now,
      };
    }

    case "CUSTOMER_ABANDONED": {
      return {
        ...arc,
        stage: "abandoned",
        outcome: "abandoned",
        updatedAt: now,
      };
    }
  }
}

function addTactic(
  deployed: NegotiationTactic[],
  tactic: NegotiationTactic,
): NegotiationTactic[] {
  return deployed.includes(tactic) ? deployed : [...deployed, tactic];
}

// ─── Tactic Guards ────────────────────────────────────────────────────────────

const LOW_STOCK_THRESHOLD = 5;

export interface TacticGuardContext {
  arc: NegotiationArc;
  currentStockLevel: number;
}

export function availableTactics(ctx: TacticGuardContext): NegotiationTactic[] {
  const { arc, currentStockLevel } = ctx;
  const deployed = new Set(arc.tacticsDeployed);
  const out: NegotiationTactic[] = [];

  // Relationship anchor only means something for a customer with history.
  if (!deployed.has("relationship_anchor") && arc.tier !== "new") {
    out.push("relationship_anchor");
  }

  // Bundle pivot and future credit are one-shot escalation steps.
  if (!arc.bundlePivotAttempted) {
    out.push("bundle_pivot");
  }

  // Inventory-VERIFIED scarcity: only honest when stock is genuinely low (>0
  // but scarce <= 5). Never claim scarcity we can't back with real inventory.
  if (
    !arc.scarcitySignalDeployed &&
    currentStockLevel > 0 &&
    currentStockLevel <= LOW_STOCK_THRESHOLD
  ) {
    out.push("scarcity_signal");
  }

  if (!arc.futureCreditAttempted && arc.tier !== "new") {
    out.push("future_credit");
  }

  // Urgency window: only if one isn't already running.
  const windowActive =
    arc.urgencyWindowExpiresAt !== undefined && arc.urgencyWindowExpiresAt > Date.now();
  if (!deployed.has("urgency_window") && !windowActive) {
    out.push("urgency_window");
  }

  // Soft close is sentiment-driven and always available as a closer.
  out.push("soft_close");

  return out;
}

export const TERMINAL_STAGES = new Set<ArcStage>(["close", "escalate", "abandoned"]);

// ─── Discount Rate Limiting (BIBLO Flaw 3: anti-haggling) ────────────────────
//
// "After 3 negotiation attempts in one conversation: lock pricing at current
// offer, no further negotiation." An attempt is a price the AGENT has put on
// the table — every AGENT_COUNTERED/BUNDLE_PIVOTED/DEAL_ACCEPTED turn that
// named an offer. Customer counters don't count against the limit; the agent's
// own concessions do.
export const MAX_NEGOTIATION_ATTEMPTS = 3;

export function negotiationAttempts(arc: NegotiationArc): number {
  return arc.turns.filter((t) => t.role === "agent" && (t.offer !== undefined || t.offeredPrice !== undefined)).length;
}

/**
 * True once the agent has made MAX_NEGOTIATION_ATTEMPTS priced offers. While
 * locked, the negotiator may still hold or close at its current best offer, but
 * propose_price refuses any FURTHER concession (a price below agentLastOffer).
 */
export function discountLocked(arc: NegotiationArc): boolean {
  return negotiationAttempts(arc) >= MAX_NEGOTIATION_ATTEMPTS;
}

// ─── Range Projection (single source of truth for price) ─────────────────────
//
// The arc carries anchorPrice/floor/tier so the system prompt, the tactic
// guards, and the bundle validator all read ONE consistent set of numbers.
// Those numbers originate in pricingService.computeAuthorizedRange(); this pure
// function copies them onto the arc once the agent loop has resolved the real
// product price (check_inventory) and customer tier (get_customer_profile).
export function projectRangeOntoArc(
  arc: NegotiationArc,
  range: AuthorizedPriceRange,
  productSku?: string,
): NegotiationArc {
  return {
    ...arc,
    anchorPrice: range.anchor,
    floor: range.floor,
    tier: range.tier,
    productSku: productSku ?? arc.productSku,
    updatedAt: Date.now(),
  };
}
