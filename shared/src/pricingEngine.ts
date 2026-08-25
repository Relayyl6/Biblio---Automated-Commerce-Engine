// shared/src/pricingEngine.ts
//
// Pure function — no DB calls, fully testable.
// Takes the JSONB pricing_rules array from a source (or merchant default)
// and a wholesale cost price, returns either a final customer price or
// an "ask_merchant" signal.
//
// Rules are evaluated top-to-bottom; the FIRST rule where costPrice >= if_cost_gte wins.
// This means you sort rules from highest threshold to lowest when configuring them:
//   [{ if_cost_gte: 500000, ...30k }, { if_cost_gte: 0, ...22.5k }]

import type { PricingExpression, PricingResult } from "./types.js";

export function evaluatePricingRules(
  rules: PricingExpression[],
  costPrice: number
): PricingResult {
  for (const rule of rules) {
    if (costPrice < rule.if_cost_gte) continue;

    if (rule.markup_type === "flat") {
      const markup = rule.markup;
      return { action: "quote", customerPrice: costPrice + markup, markup };
    }

    if (rule.markup_type === "percent") {
      const markup = Math.round((rule.markup / 100) * costPrice);
      return { action: "quote", customerPrice: costPrice + markup, markup };
    }

    if (rule.markup_type === "ask_merchant") {
      return { action: "ask_merchant", costPrice };
    }
  }

  // No rule matched at all — escalate to merchant rather than guessing
  return { action: "ask_merchant", costPrice };
}

/**
 * Format a Naira amount with the ₦ symbol and comma separators.
 * e.g. 302500 → "₦302,500"
 */
export function formatNaira(amount: number): string {
  return `₦${amount.toLocaleString("en-NG")}`;
}

/**
 * Extract the first numeric price mention from a WhatsApp reply.
 * Handles common formats: "280k", "280,000", "280000", "₦280k", "it's 280"
 * Returns null if no price found.
 */
export function extractPriceFromText(text: string): number | null {
  // Normalise: remove ₦, commas, spaces
  const cleaned = text.replace(/₦/g, "").replace(/,/g, "").trim();

  // Match patterns like "280k", "280K", "2.8m", "280000", "280 000"
  const patterns = [
    /(\d+(?:\.\d+)?)\s*[kK]/,   // 280k → 280000
    /(\d+(?:\.\d+)?)\s*[mM]/,   // 2.8m → 2800000
    /(\d{4,})/,                  // raw 5+ digit number
    /(\d{1,3})\s+(\d{3})/,      // "280 000" spaced format
  ];

  for (const pattern of patterns) {
    const match = cleaned.match(pattern);
    if (match) {
      if (pattern.source.includes("[kK]")) {
        return Math.round(parseFloat(match[1]) * 1000);
      }
      if (pattern.source.includes("[mM]")) {
        return Math.round(parseFloat(match[1]) * 1_000_000);
      }
      if (match[2]) {
        // Spaced format: "280 000"
        return parseInt(match[1] + match[2], 10);
      }
      return parseInt(match[1], 10);
    }
  }

  return null;
}
