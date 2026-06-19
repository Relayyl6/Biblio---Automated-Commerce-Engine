// core/ai-negotiator/src/negotiationArc.ts
//
// The NegotiationArc is the per-customer strategic state of a live haggle.
// It is hot state (read/written every turn) and lives in Redis — see the long
// note at the top of agentLoop.ts for why Redis and not Postgres.
//
// This module is PURE: the arc reducer (`advanceArc`) and the tactic-guard
// function (`availableTactics`) have no I/O. tools.ts calls them and persists
// the result. Keeping them pure means the arc can be rebuilt deterministically
// from a transcript if Redis ever loses it.
//
// The arc interface matches what agentLoop.ts.createFreshArc() constructs and
// reads; the ArcEvent names match the advanceArc() calls in tools.ts.

import type { AuthorizedPriceRange, CustomerTier } from "./pricingService";

// ─── Stages & Tactics ───────────────────────────────────────────────────────

// The arc: ANCHOR → ACKNOWLEDGE → COUNTER → CLOSE / PIVOT / ESCALATE.
// Terminal stages are close | escalate | abandoned — agentLoop checks this set
// to decide whether to start a fresh arc on the next message.
export type ArcStage =
  | "anchor"
  | "acknowledge"
  | "counter"
  | "pivot"
  | "close"
  | "escalate"
  | "abandoned";

export const TERMINAL_STAGES: ReadonlySet<ArcStage> = new Set<ArcStage>([
  "close",
  "escalate",
  "abandoned",
]);

// The 6 merchant-approved tactics from the README.
export type NegotiationTactic =
  | "relationship_anchor"
  | "bundle_pivot"
  | "scarcity_signal"
  | "future_credit"
  | "urgency_window"
  | "soft_close";

// ─── The Arc ────────────────────────────────────────────────────────────────

export interface ArcTurn {
  role: "agent" | "customer";
  /** The price named on this turn, if any. */
  offer?: number;
  /** The tactic deployed on this turn, if any. */
  tactic?: NegotiationTactic;
  at: number;
}

export interface NegotiationArc {
  sessionId: string;
  merchantId: string;
  customerId: string;
  /** "TBD" until check_inventory resolves the real SKU. */
  productSku: string;
  anchorPrice: number;
  floor: number;
  tier: CustomerTier;
  stage: ArcStage;

  tacticsDeployed: NegotiationTactic[];
  bundlePivotAttempted: boolean;
  futureCreditAttempted: boolean;
  scarcitySignalDeployed: boolean;

  agentLastOffer?: number;
  customerLastOffer?: number;
  /** Epoch millis when an active urgency window expires. */
  urgencyWindowExpiresAt?: number;

  turns: ArcTurn[];
  createdAt: number;
  updatedAt: number;
}

// ─── Arc Events (input to the reducer) ──────────────────────────────────────
//
// These names + fields match the advanceArc() call sites in tools.ts.

export type ArcEvent =
  | { type: "AGENT_COUNTERED"; agentOffer: number; tactic?: NegotiationTactic }
  | { type: "BUNDLE_PIVOTED"; agentOffer: number }
  | { type: "CREDIT_OFFERED"; creditAmount: number }
  | { type: "DEAL_ACCEPTED"; finalPrice: number }
  | { type: "ESCALATED_TO_MERCHANT" };

// ─── Tactic Guards ──────────────────────────────────────────────────────────
//
// Returns the tactics that are LEGAL to deploy right now. The agent is told
// which are available in its system prompt; deploy_tactic re-checks here so the
// model can't deploy an exhausted/illegal tactic even if it tries.

const LOW_STOCK_THRESHOLD = 5;

export function availableTactics(args: {
  arc: NegotiationArc;
  currentStockLevel: number;
}): NegotiationTactic[] {
  const { arc, currentStockLevel } = args;
  const deployed = new Set(arc.tacticsDeployed);
  const out: NegotiationTactic[] = [];

  // Relationship anchor only means something for a customer with history.
  if (!deployed.has("relationship_anchor") && arc.tier !== "new") {
    out.push("relationship_anchor");
  }

  // Bundle pivot and future credit are one-shot escalation steps.
  if (!arc.bundlePivotAttempted) out.push("bundle_pivot");
  if (!arc.futureCreditAttempted) out.push("future_credit");

  // Inventory-VERIFIED scarcity: only honest when stock is genuinely low (>0
  // but scarce). Never claim scarcity we can't back with real inventory.
  if (
    !arc.scarcitySignalDeployed &&
    currentStockLevel > 0 &&
    currentStockLevel <= LOW_STOCK_THRESHOLD
  ) {
    out.push("scarcity_signal");
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

// ─── Reducer ────────────────────────────────────────────────────────────────

export function advanceArc(arc: NegotiationArc, event: ArcEvent): NegotiationArc {
  const next: NegotiationArc = { ...arc, updatedAt: Date.now() };

  switch (event.type) {
    case "AGENT_COUNTERED": {
      next.agentLastOffer = event.agentOffer;
      if (event.tactic) {
        next.tacticsDeployed = addTactic(arc.tacticsDeployed, event.tactic);
        if (event.tactic === "scarcity_signal") next.scarcitySignalDeployed = true;
      }
      if (arc.stage === "anchor" || arc.stage === "acknowledge") next.stage = "counter";
      next.turns = [
        ...arc.turns,
        { role: "agent", offer: event.agentOffer, tactic: event.tactic, at: next.updatedAt },
      ];
      return next;
    }

    case "BUNDLE_PIVOTED":
      next.agentLastOffer = event.agentOffer;
      next.bundlePivotAttempted = true;
      next.tacticsDeployed = addTactic(arc.tacticsDeployed, "bundle_pivot");
      next.stage = "pivot";
      next.turns = [
        ...arc.turns,
        { role: "agent", offer: event.agentOffer, tactic: "bundle_pivot", at: next.updatedAt },
      ];
      return next;

    case "CREDIT_OFFERED":
      next.futureCreditAttempted = true;
      next.tacticsDeployed = addTactic(arc.tacticsDeployed, "future_credit");
      next.stage = "pivot";
      next.turns = [
        ...arc.turns,
        { role: "agent", tactic: "future_credit", at: next.updatedAt },
      ];
      return next;

    case "DEAL_ACCEPTED":
      next.stage = "close";
      next.agentLastOffer = event.finalPrice;
      next.turns = [
        ...arc.turns,
        { role: "agent", offer: event.finalPrice, at: next.updatedAt },
      ];
      return next;

    case "ESCALATED_TO_MERCHANT":
      next.stage = "escalate";
      return next;

    default:
      return assertNeverArc(event);
  }
}

function addTactic(
  deployed: NegotiationTactic[],
  tactic: NegotiationTactic,
): NegotiationTactic[] {
  return deployed.includes(tactic) ? deployed : [...deployed, tactic];
}

// ─── Range Projection (single source of truth for price) ─────────────────────
//
// The arc carries anchorPrice/floor/tier so the system prompt, the tactic
// guards, and the bundle validator all read ONE consistent set of numbers.
// Those numbers originate in pricingService.computeAuthorizedRange(); this pure
// function copies them onto the arc once the agent loop has resolved the real
// product price (check_inventory) and customer tier (get_customer_profile).
//
// Before this existed, the arc kept its createFreshArc() zeros forever while
// validation used a separately-computed range — two disagreeing sources of
// truth. Projecting the range onto the arc collapses them into one.
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

// ─── Discount Rate Limiting (BIBLO Flaw 3: anti-haggling) ────────────────────
//
// "After 3 negotiation attempts in one conversation: lock pricing at current
// offer, no further negotiation." An attempt is a price the AGENT has put on
// the table — every AGENT_COUNTERED/BUNDLE_PIVOTED/DEAL_ACCEPTED turn that
// named an offer. Customer counters don't count against the limit; the agent's
// own concessions do.
export const MAX_NEGOTIATION_ATTEMPTS = 3;

export function negotiationAttempts(arc: NegotiationArc): number {
  return arc.turns.filter((t) => t.role === "agent" && t.offer !== undefined).length;
}

/**
 * True once the agent has made MAX_NEGOTIATION_ATTEMPTS priced offers. While
 * locked, the negotiator may still hold or close at its current best offer, but
 * propose_price refuses any FURTHER concession (a price below agentLastOffer).
 */
export function discountLocked(arc: NegotiationArc): boolean {
  return negotiationAttempts(arc) >= MAX_NEGOTIATION_ATTEMPTS;
}

function assertNeverArc(event: never): never {
  throw new Error(`Unhandled ArcEvent: ${JSON.stringify(event)}`);
}
