import { sql } from "../clients.js";
import { logger } from "../logger.js";

export type MerchantTier = "starter" | "growth" | "enterprise";

export type PlatformFeature =
  | "store_pickup"               // In-person pickup fulfillment
  | "basic_catalog"              // Up to 50 products
  | "managed_ai_negotiation"     // Biblio Managed Pool Llama 3
  | "basic_escrow"               // Virtual account dynamic escrow
  | "status_automation"         // WhatsApp Status auto-broadcasting
  | "advanced_tone_calibration" // Deep Pidgin / honorific calibrator
  | "export_ledger"             // CSV audit export
  | "dispute_management"        // In-app refund dispute workflows
  | "custom_api_keys"           // BYOK (Kwik, Gokada, MAX, Paystack, Groq, Twilio, Africa's Talking)
  | "cross_channel_instagram"   // Instagram & web embed
  | "unlimited_catalog"         // Unlimited inventory items
  | "custom_fee_padding";       // Custom negotiable platform fee percentage

export interface FeatureDefinition {
  id: PlatformFeature;
  name: string;
  description: string;
  requiredTier: MerchantTier;
  category: "core" | "growth" | "enterprise";
}

export const TIER_RANK: Record<MerchantTier, number> = {
  starter: 1,
  growth: 2,
  enterprise: 3,
};

export const FEATURE_CATALOG: Record<PlatformFeature, FeatureDefinition> = {
  store_pickup: {
    id: "store_pickup",
    name: "In-Person Store Pickup",
    description: "Allow buyers to pick up orders at your physical store with ₦0 delivery fee and verification codes.",
    requiredTier: "starter",
    category: "core",
  },
  basic_catalog: {
    id: "basic_catalog",
    name: "Standard Catalog",
    description: "Publish up to 50 active products.",
    requiredTier: "starter",
    category: "core",
  },
  managed_ai_negotiation: {
    id: "managed_ai_negotiation",
    name: "Autonomous AI Negotiator",
    description: "Biblio-powered Llama 3 autonomous negotiator for WhatsApp sales.",
    requiredTier: "starter",
    category: "core",
  },
  basic_escrow: {
    id: "basic_escrow",
    name: "Automated Virtual Accounts",
    description: "Dynamic payment accounts for instant customer bank transfers.",
    requiredTier: "starter",
    category: "core",
  },
  status_automation: {
    id: "status_automation",
    name: "WhatsApp Status Smart Promotion",
    description: "Automated margin-ranked WhatsApp Status broadcasting cron.",
    requiredTier: "growth",
    category: "growth",
  },
  advanced_tone_calibration: {
    id: "advanced_tone_calibration",
    name: "Dialect & Demeanor Calibration",
    description: "Deep tuning of Pidgin ratio and politeness markers.",
    requiredTier: "growth",
    category: "growth",
  },
  export_ledger: {
    id: "export_ledger",
    name: "Financial Audit Export",
    description: "Export full bank ledger and transaction history to CSV.",
    requiredTier: "growth",
    category: "growth",
  },
  dispute_management: {
    id: "dispute_management",
    name: "Refund & Dispute Resolution",
    description: "Automated customer dispute intake and refund controls.",
    requiredTier: "growth",
    category: "growth",
  },
  custom_api_keys: {
    id: "custom_api_keys",
    name: "Bring Your Own Keys (BYOK)",
    description: "Override platform defaults with your private Kwik, Gokada, MAX, Paystack, Groq, Twilio, and Africa's Talking accounts.",
    requiredTier: "enterprise",
    category: "enterprise",
  },
  cross_channel_instagram: {
    id: "cross_channel_instagram",
    name: "Cross-Channel Omnichannel",
    description: "Sync Biblio Agent memory across WhatsApp, Instagram, and web embed.",
    requiredTier: "enterprise",
    category: "enterprise",
  },
  unlimited_catalog: {
    id: "unlimited_catalog",
    name: "Unlimited Catalog & Multi-Warehouse",
    description: "No product limits with multi-location stock synchronization.",
    requiredTier: "enterprise",
    category: "enterprise",
  },
  custom_fee_padding: {
    id: "custom_fee_padding",
    name: "Custom Platform Fee Structure",
    description: "Negotiated platform fee rates and custom fee padding rules.",
    requiredTier: "enterprise",
    category: "enterprise",
  },
};

export const FEATURE_TIER_REQUIREMENTS: Record<PlatformFeature, MerchantTier> = Object.fromEntries(
  Object.entries(FEATURE_CATALOG).map(([k, v]) => [k as PlatformFeature, v.requiredTier])
) as Record<PlatformFeature, MerchantTier>;

/**
 * Checks whether a given tier is permitted to access a specific feature.
 */
export function isFeatureAllowed(
  tier: MerchantTier | string | undefined | null,
  feature: PlatformFeature
): boolean {
  const normalizedTier: MerchantTier =
    tier === "growth" || tier === "enterprise" ? tier : "starter";
  const requiredTier = FEATURE_TIER_REQUIREMENTS[feature] || "enterprise";
  return TIER_RANK[normalizedTier] >= TIER_RANK[requiredTier];
}

export class TierRestrictedError extends Error {
  public readonly code = "TIER_RESTRICTED";
  public readonly requiredTier: MerchantTier;
  public readonly currentTier: MerchantTier;

  constructor(feature: PlatformFeature, currentTier: MerchantTier) {
    const required = FEATURE_TIER_REQUIREMENTS[feature] || "enterprise";
    super(
      `Feature '${feature}' requires the ${required.toUpperCase()} tier. Current tier is ${currentTier.toUpperCase()}.`
    );
    this.requiredTier = required;
    this.currentTier = currentTier;
    this.name = "TierRestrictedError";
  }
}

/**
 * Throws a TierRestrictedError if the tier cannot access the feature.
 */
export function assertFeatureAllowed(
  tier: MerchantTier | string | undefined | null,
  feature: PlatformFeature
): void {
  const normalizedTier: MerchantTier =
    tier === "growth" || tier === "enterprise" ? tier : "starter";
  if (!isFeatureAllowed(normalizedTier, feature)) {
    throw new TierRestrictedError(feature, normalizedTier);
  }
}

/**
 * Resolves the merchant's current tier and verifies access against the database.
 */
export async function checkMerchantFeature(
  merchantId: string,
  feature: PlatformFeature
): Promise<{
  allowed: boolean;
  currentTier: MerchantTier;
  requiredTier: MerchantTier;
}> {
  try {
    const rows = await sql<{ subscription_tier: string }[]>`
      SELECT subscription_tier
      FROM merchants
      WHERE id = ${merchantId}::uuid
      LIMIT 1
    `;
    const currentTier: MerchantTier =
      rows[0]?.subscription_tier === "growth" || rows[0]?.subscription_tier === "enterprise"
        ? (rows[0].subscription_tier as MerchantTier)
        : "starter";
    const requiredTier = FEATURE_TIER_REQUIREMENTS[feature] || "enterprise";
    const allowed = isFeatureAllowed(currentTier, feature);

    return { allowed, currentTier, requiredTier };
  } catch (err) {
    logger.error(`[checkMerchantFeature] Failed to check feature ${feature} for ${merchantId}:`, err);
    return {
      allowed: feature === "store_pickup" || feature === "basic_catalog",
      currentTier: "starter",
      requiredTier: FEATURE_TIER_REQUIREMENTS[feature] || "enterprise",
    };
  }
}

/**
 * Returns complete feature entitlement matrix for a merchant.
 */
export async function getMerchantFeatureEntitlements(merchantId: string) {
  const rows = await sql<{ subscription_tier: string }[]>`
    SELECT subscription_tier FROM merchants WHERE id = ${merchantId}::uuid LIMIT 1
  `;
  const currentTier: MerchantTier =
    rows[0]?.subscription_tier === "growth" || rows[0]?.subscription_tier === "enterprise"
      ? (rows[0].subscription_tier as MerchantTier)
      : "starter";

  const entitlements = Object.values(FEATURE_CATALOG).map((feat) => ({
    id: feat.id,
    name: feat.name,
    description: feat.description,
    category: feat.category,
    requiredTier: feat.requiredTier,
    isAllowed: isFeatureAllowed(currentTier, feat.id),
  }));

  return {
    merchantId,
    currentTier,
    entitlements,
  };
}
