// Tests for the negotiation arc — the pure strategic-state reducer for a live
// haggle. Covers the stage machine, tactic legality guards (so the model can't
// deploy an exhausted/dishonest tactic), range projection, and the BIBLO Flaw-3
// anti-haggling rate limit (max 3 agent offers).

import { describe, it, expect } from "vitest";
import {
  advanceArc,
  availableTactics,
  projectRangeOntoArc,
  discountLocked,
  negotiationAttempts,
  MAX_NEGOTIATION_ATTEMPTS,
  TERMINAL_STAGES,
  type NegotiationArc,
} from "./negotiationArc";
import type { AuthorizedPriceRange } from "./pricingService";

function freshArc(over: Partial<NegotiationArc> = {}): NegotiationArc {
  return {
    sessionId: "s1",
    merchantId: "m1",
    customerId: "c1",
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
    createdAt: 1,
    updatedAt: 1,
    ...over,
  };
}

describe("advanceArc — stage transitions", () => {
  it("AGENT_COUNTERED moves anchor → counter and records the offer", () => {
    const next = advanceArc(freshArc(), { type: "AGENT_COUNTERED", agentOffer: 9000 });
    expect(next.stage).toBe("counter");
    expect(next.agentLastOffer).toBe(9000);
    expect(next.turns.at(-1)).toMatchObject({ role: "agent", offer: 9000 });
  });

  it("BUNDLE_PIVOTED sets pivot stage and marks the one-shot flag", () => {
    const next = advanceArc(freshArc(), { type: "BUNDLE_PIVOTED", agentOffer: 12000 });
    expect(next.stage).toBe("pivot");
    expect(next.bundlePivotAttempted).toBe(true);
    expect(next.tacticsDeployed).toContain("bundle_pivot");
  });

  it("CREDIT_OFFERED sets pivot stage and marks future-credit attempted", () => {
    const next = advanceArc(freshArc(), { type: "CREDIT_OFFERED", creditAmount: 2000 });
    expect(next.stage).toBe("pivot");
    expect(next.futureCreditAttempted).toBe(true);
    expect(next.tacticsDeployed).toContain("future_credit");
  });

  it("DEAL_ACCEPTED closes the arc at the final price", () => {
    const next = advanceArc(freshArc(), { type: "DEAL_ACCEPTED", finalPrice: 8800 });
    expect(next.stage).toBe("close");
    expect(TERMINAL_STAGES.has(next.stage)).toBe(true);
  });

  it("ESCALATED_TO_MERCHANT moves to the terminal escalate stage", () => {
    const next = advanceArc(freshArc(), { type: "ESCALATED_TO_MERCHANT" });
    expect(next.stage).toBe("escalate");
    expect(TERMINAL_STAGES.has(next.stage)).toBe(true);
  });

  it("does not mutate the input arc (pure reducer)", () => {
    const arc = freshArc();
    advanceArc(arc, { type: "AGENT_COUNTERED", agentOffer: 9000 });
    expect(arc.stage).toBe("anchor");
    expect(arc.turns).toHaveLength(0);
  });

  it("deduplicates a repeated tactic in tacticsDeployed", () => {
    let arc = advanceArc(freshArc({ tier: "loyal" }), {
      type: "AGENT_COUNTERED",
      agentOffer: 9000,
      tactic: "relationship_anchor",
    });
    arc = advanceArc(arc, { type: "AGENT_COUNTERED", agentOffer: 8800, tactic: "relationship_anchor" });
    expect(arc.tacticsDeployed.filter((t) => t === "relationship_anchor")).toHaveLength(1);
  });
});

describe("availableTactics — legality guards", () => {
  it("offers relationship_anchor only for customers with history", () => {
    expect(availableTactics({ arc: freshArc({ tier: "new" }), currentStockLevel: 50 })).not.toContain(
      "relationship_anchor",
    );
    expect(availableTactics({ arc: freshArc({ tier: "loyal" }), currentStockLevel: 50 })).toContain(
      "relationship_anchor",
    );
  });

  it("offers scarcity_signal only when stock is genuinely low (>0, ≤5)", () => {
    expect(availableTactics({ arc: freshArc(), currentStockLevel: 3 })).toContain("scarcity_signal");
    expect(availableTactics({ arc: freshArc(), currentStockLevel: 50 })).not.toContain(
      "scarcity_signal",
    );
    expect(availableTactics({ arc: freshArc(), currentStockLevel: 0 })).not.toContain(
      "scarcity_signal",
    );
  });

  it("withholds one-shot tactics once attempted", () => {
    const arc = freshArc({ bundlePivotAttempted: true, futureCreditAttempted: true });
    const tactics = availableTactics({ arc, currentStockLevel: 50 });
    expect(tactics).not.toContain("bundle_pivot");
    expect(tactics).not.toContain("future_credit");
  });

  it("always offers soft_close as a closer", () => {
    expect(availableTactics({ arc: freshArc(), currentStockLevel: 50 })).toContain("soft_close");
  });

  it("withholds urgency_window while one is still active", () => {
    const arc = freshArc({ urgencyWindowExpiresAt: Date.now() + 60_000 });
    expect(availableTactics({ arc, currentStockLevel: 50 })).not.toContain("urgency_window");
  });
});

describe("projectRangeOntoArc", () => {
  it("copies the authorized range onto the arc as the single source of truth", () => {
    const range: AuthorizedPriceRange = {
      anchor: 10000,
      floor: 8500,
      maxDiscount: 0.15,
      maxBundleValueAdd: 0.1,
      futureCreditCap: 1000,
      tier: "returning",
    };
    const arc = projectRangeOntoArc(freshArc(), range, "BLK-001");
    expect(arc.anchorPrice).toBe(10000);
    expect(arc.floor).toBe(8500);
    expect(arc.tier).toBe("returning");
    expect(arc.productSku).toBe("BLK-001");
  });

  it("keeps the prior sku when none is supplied", () => {
    const arc = projectRangeOntoArc(freshArc({ productSku: "OLD" }), {
      anchor: 1,
      floor: 1,
      maxDiscount: 0,
      maxBundleValueAdd: 0,
      futureCreditCap: 0,
      tier: "new",
    });
    expect(arc.productSku).toBe("OLD");
  });
});

describe("discount rate limiting (BIBLO Flaw 3)", () => {
  it("counts only priced AGENT turns as attempts", () => {
    let arc = freshArc();
    arc = advanceArc(arc, { type: "AGENT_COUNTERED", agentOffer: 9500 });
    arc = advanceArc(arc, { type: "CREDIT_OFFERED", creditAmount: 1000 }); // no offer → not an attempt
    expect(negotiationAttempts(arc)).toBe(1);
  });

  it("locks after MAX_NEGOTIATION_ATTEMPTS agent offers", () => {
    let arc = freshArc();
    for (let i = 0; i < MAX_NEGOTIATION_ATTEMPTS; i++) {
      arc = advanceArc(arc, { type: "AGENT_COUNTERED", agentOffer: 9000 - i * 100 });
    }
    expect(negotiationAttempts(arc)).toBe(MAX_NEGOTIATION_ATTEMPTS);
    expect(discountLocked(arc)).toBe(true);
  });

  it("is not locked before the limit", () => {
    let arc = freshArc();
    arc = advanceArc(arc, { type: "AGENT_COUNTERED", agentOffer: 9000 });
    expect(discountLocked(arc)).toBe(false);
  });
});