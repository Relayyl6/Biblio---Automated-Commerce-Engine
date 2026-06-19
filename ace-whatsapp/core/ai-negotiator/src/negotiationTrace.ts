// core/ai-negotiator/src/negotiationTrace.ts
//
// The NegotiationTrace is BIBLO's dual-purpose asset: the operational record of
// a haggle AND the sellable enterprise signal (price elasticity for FMCGs,
// dialect dialogue for AI labs, abandonment patterns for banks — see the
// ai-negotiator README). The `negotiation_traces` table has existed in
// infra/schema.sql since day one but nothing wrote to it; this module turns a
// terminal NegotiationArc into a row.
//
// This module is PURE — it builds the row object from the arc. agentLoop's
// finalizeTurn() performs the single INSERT. Keeping it pure means a trace can
// be reconstructed deterministically from an archived arc.

import type { NegotiationArc, NegotiationTactic } from "./negotiationArc";

export type NegotiationOutcome =
  | "closed"
  | "bundle_closed"
  | "below_floor_escalated"
  | "abandoned";

/** Shape mirrors the negotiation_traces columns in infra/schema.sql. */
export interface NegotiationTraceRow {
  sessionId: string;
  merchantId: string;
  customerId: string;
  customerTier: string;
  anchorPrice: number;
  authorizedFloor: number;
  outcome: NegotiationOutcome;
  finalPrice: number | null;
  finalMargin: number | null;
  tacticsDeployed: NegotiationTactic[];
  tacticsSucceeded: NegotiationTactic[];
  priceElasticitySignal: number | null;
  turns: NegotiationArc["turns"];
}

/**
 * Map a terminal arc stage to an outcome. Returns null for non-terminal arcs —
 * the caller should not flush a trace mid-negotiation.
 */
export function outcomeForArc(arc: NegotiationArc): NegotiationOutcome | null {
  switch (arc.stage) {
    case "close":
      return arc.bundlePivotAttempted ? "bundle_closed" : "closed";
    case "escalate":
      return "below_floor_escalated";
    case "abandoned":
      return "abandoned";
    default:
      return null;
  }
}

/**
 * Build the trace row from a terminal arc. Returns null if the arc is not in a
 * terminal stage (nothing to record yet).
 */
export function buildNegotiationTrace(arc: NegotiationArc): NegotiationTraceRow | null {
  const outcome = outcomeForArc(arc);
  if (!outcome) return null;

  const closed = outcome === "closed" || outcome === "bundle_closed";
  const finalPrice = closed ? arc.agentLastOffer ?? null : null;

  // Margin is measured against the authorized floor that was in force for this
  // negotiation (projected onto the arc). Null when there was no close.
  const finalMargin =
    finalPrice !== null && arc.floor > 0 ? finalPrice - arc.floor : null;

  // Price elasticity = how far the customer's final ask sat relative to the
  // anchor. Guard against the anchor never having been resolved (anchor 0).
  const priceElasticitySignal =
    arc.customerLastOffer !== undefined && arc.anchorPrice > 0
      ? arc.customerLastOffer / arc.anchorPrice
      : null;

  // On a close, the tactics that were deployed are credited as "succeeded"
  // (the deal closed with them in play). On an escalation none succeeded.
  const tacticsSucceeded = closed ? arc.tacticsDeployed : [];

  return {
    sessionId: arc.sessionId,
    merchantId: arc.merchantId,
    customerId: arc.customerId,
    customerTier: arc.tier,
    anchorPrice: arc.anchorPrice,
    authorizedFloor: arc.floor,
    outcome,
    finalPrice,
    finalMargin,
    tacticsDeployed: arc.tacticsDeployed,
    tacticsSucceeded,
    priceElasticitySignal,
    turns: arc.turns,
  };
}