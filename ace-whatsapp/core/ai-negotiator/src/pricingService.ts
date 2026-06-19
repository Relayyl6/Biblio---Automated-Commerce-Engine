// core/ai-negotiator/src/pricingService.ts
//
// ─── THE RULES ENGINE LAYER ───────────────────────────────────────────────────
//
// This file is the TypeScript stand-in for the Rust PricingService described
// in the README. CRITICAL DESIGN CONSTRAINTS — these are not style preferences,
// they are what makes this extractable to Rust later without rewriting
// call sites:
//
//   1. EVERY function here is PURE — no async, no DB access, no side effects.
//      All inputs are passed in explicitly. If you need data from the DB,
//      the CALLER fetches it and passes it in as a plain object.
//
//   2. PRICES ARE NEVER SET BY THE LLM — the agent receives an
//      AuthorizedPriceRange and proposes a number within it. This function
//      validates the proposal. If the proposal is below floor, it's rejected.
//      That rejection is not an error to swallow — it's the circuit breaker
//      firing, and the caller must handle it by switching to a PIVOT tactic.
//
//   3. INJECTION DETECTION lives here — because if it lived in the agent
//      loop (TypeScript runtime), a sophisticated prompt injection might
//      conceivably influence it. A pure function with explicit allowlist
//      patterns is much harder to manipulate than an LLM deciding "does
//      this look like injection?"
//
// When you write the Rust service: each function here maps to a Rust fn,
// each interface here maps to a Rust struct. The HTTP contract will be:
//   POST /pricing/authorize  → AuthorizedPriceRange
//   POST /pricing/validate   → PriceValidationResult
//   POST /pricing/detect     → InjectionCheckResult
// Keep that in mind as you read — the separation is already there.

// ─── Customer Tier ────────────────────────────────────────────────────────────

export type CustomerTier = "new" | "returning" | "loyal" | "vip";

export interface CustomerProfile {
  orderCount: number;
  lifetimeValue: number; // in NGN (kobo-free for MVP)
}

export function resolveCustomerTier(profile: CustomerProfile): CustomerTier {
  // Tier boundaries from the README — merchant-configurable in Phase 2.
  // Note: LTV threshold takes precedence over order count for VIP.
  if (profile.orderCount >= 21 || profile.lifetimeValue >= 100_000) return "vip";
  if (profile.orderCount >= 6) return "loyal";
  if (profile.orderCount >= 2) return "returning";
  return "new";
}

// ─── Authorized Price Range ───────────────────────────────────────────────────

export interface MerchantPricingRules {
  basePrice: number;
  absoluteFloor: number; // never crossed, ever — hard-coded by merchant
  // These are the per-tier discount CEILINGS from the README table.
  // Merchant sets these once. AI operates within them forever.
  maxDiscountByTier: Record<CustomerTier, number>; // e.g. { new: 0.05, returning: 0.15, ... }
  maxBundleValueAddByTier: Record<CustomerTier, number>;
  futureCreditCapByTier: Record<CustomerTier, number>;
}

export interface AuthorizedPriceRange {
  anchor: number; // What AI opens with (full price or VIP-recommended price)
  floor: number; // Absolute minimum — below this, circuit breaker fires
  maxDiscount: number; // Fractional ceiling, e.g. 0.22
  maxBundleValueAdd: number; // Fractional, e.g. 0.20
  futureCreditCap: number; // In NGN, e.g. 2500
  tier: CustomerTier;
}

export function computeAuthorizedRange(
  rules: MerchantPricingRules,
  tier: CustomerTier,
): AuthorizedPriceRange {
  const maxDiscount = rules.maxDiscountByTier[tier];

  return {
    // VIPs get the merchant's recommended price as anchor, not full list.
    // "New" customers always anchor at full price.
    anchor: tier === "vip"
      ? rules.basePrice * 0.97   // VIPs know they get a small "courtesy price" upfront
      : rules.basePrice,
    // Floor is the HIGHER of: (absoluteFloor) or (basePrice - maxDiscount).
    // absoluteFloor is the hard merchant backstop; the discount calculation
    // is the soft per-tier ceiling. Max of both means BOTH constraints apply.
    floor: Math.max(
      rules.absoluteFloor,
      rules.basePrice * (1 - maxDiscount),
    ),
    maxDiscount,
    maxBundleValueAdd: rules.maxBundleValueAddByTier[tier],
    futureCreditCap: rules.futureCreditCapByTier[tier],
    tier,
  };
}

// ─── Price Validation (the circuit breaker) ───────────────────────────────────

export type PriceValidationResult =
  | { ok: true; finalPrice: number }
  | { ok: false; reason: "below_floor"; customerOffer: number; floor: number }
  | { ok: false; reason: "above_anchor"; proposedPrice: number; anchor: number }
  | { ok: false; reason: "injection_detected"; pattern: string };

export function validateProposedPrice(
  proposed: number,
  range: AuthorizedPriceRange,
  rawInput: string, // The customer's original message text — for injection scan
): PriceValidationResult {
  // Injection check FIRST — before any numeric comparison, because a
  // carefully crafted number might bypass floor checks (e.g. "0.0001" in
  // a locale that uses comma-as-decimal, coerced to float differently).
  const injection = detectPricingInjection(rawInput);
  if (injection) {
    return { ok: false, reason: "injection_detected", pattern: injection };
  }

  // Sanity check: a "proposed price" above anchor means the agent tried
  // to charge MORE than list price. That shouldn't happen, but log it if
  // it does — it may indicate a prompt pollution issue.
  if (proposed > range.anchor * 1.05) {
    return { ok: false, reason: "above_anchor", proposedPrice: proposed, anchor: range.anchor };
  }

  if (proposed < range.floor) {
    return { ok: false, reason: "below_floor", customerOffer: proposed, floor: range.floor };
  }

  return { ok: true, finalPrice: proposed };
}

// ─── Injection Detection ──────────────────────────────────────────────────────
//
// Injection detection is about one specific threat model: a customer who
// crafts a WhatsApp message designed to make the AI treat a price as
// "approved" or override the floor. This is NOT general prompt injection
// detection (that's a much harder problem). These are the patterns that
// specifically target pricing manipulation.

const INJECTION_PATTERNS: Array<[RegExp, string]> = [
  // "ignore previous instructions" / "forget the floor" style
  [/ignore\s+(previous|prior|all|your)\s+(instructions?|rules?|price|floor)/i,
    "instruction override attempt"],
  // Direct floor/rules manipulation
  [/(set|override|change|update)\s+(the\s+)?(floor|price|minimum|rules?)\s+to/i,
    "pricing rule override attempt"],
  // System prompt extraction
  [/repeat\s+(your|the)\s+(system\s+)?prompt|print\s+instructions|what\s+are\s+your\s+rules/i,
    "system prompt extraction attempt"],
  // "You are now a different AI" style
  [/you\s+are\s+now|pretend\s+(you\s+are|to\s+be)|act\s+as\s+(if\s+you\s+are|a\s+different)/i,
    "persona override attempt"],
  // Price hidden in base64 or encoding — overly complex for MVP, skip for now.
  // Add as real injection attempts surface in logs.
];

function detectPricingInjection(text: string): string | null {
  for (const [pattern, label] of INJECTION_PATTERNS) {
    if (pattern.test(text)) return label;
  }
  return null;
}

/**
 * Public entry point for the injection scan. BIBLO Flaw 3 requires this to run
 * on the RAW customer bytes at turn entry — independent of the model — because
 * a model that has already been steered by an injection cannot be trusted to
 * relay the offending text into `validateProposedPrice`. The agent loop calls
 * this before the LLM ever sees the message; `validateProposedPrice` keeps its
 * own internal call as defense-in-depth.
 */
export function scanForInjection(text: string): string | null {
  return detectPricingInjection(text);
}

// ─── Bundle Validation ────────────────────────────────────────────────────────
//
// When the agent proposes a bundle pivot, validate that the bundle's
// VALUE ADD (what the customer receives) doesn't exceed the tier's cap.
// The bundle's PRICE can still be above floor — this isn't a price check,
// it's checking that we're not giving away too much free product.

export interface BundleProposal {
  baseItemPrice: number;
  bundlePrice: number;
  addedItemsValue: number; // Market value of items being added
}

export type BundleValidationResult =
  | { ok: true }
  | { ok: false; reason: string };

export function validateBundlePivot(
  bundle: BundleProposal,
  range: AuthorizedPriceRange,
): BundleValidationResult {
  if (bundle.bundlePrice < range.floor) {
    return {
      ok: false,
      reason: `Bundle price ₦${bundle.bundlePrice} is below floor ₦${range.floor}`,
    };
  }

  const valueAddFraction = bundle.addedItemsValue / bundle.baseItemPrice;
  if (valueAddFraction > range.maxBundleValueAdd) {
    return {
      ok: false,
      reason: `Bundle adds ${(valueAddFraction * 100).toFixed(0)}% value but tier cap is ${(range.maxBundleValueAdd * 100).toFixed(0)}%`,
    };
  }

  return { ok: true };
}