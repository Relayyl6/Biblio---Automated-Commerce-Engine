// shared/src/tokenLedger.ts
// Records AI compute consumption per merchant per feature.
// Called after every LLM turn so the token ledger is self-updating.
import { sql } from "@ace/shared/clients";
import { logger } from "@ace/shared/logger.js";

/**
 * Records tokens/naira consumed for a feature and deducts from the merchant's token ledger.
 * Safe to call fire-and-forget (errors are logged, never thrown).
 */
export async function recordTokenUsage(
  merchantId: string,
  feature: string,
  tokensUsed: number,
  nairaAmount: number,
  metadata: Record<string, unknown> = {}
): Promise<void> {
  try {
    await sql`
      INSERT INTO token_usage_events (merchant_id, feature, tokens_used, naira_amount, metadata)
      VALUES (${merchantId}::uuid, ${feature}, ${tokensUsed}, ${nairaAmount}, ${JSON.stringify(metadata)}::jsonb)
    `;
    await sql`
      UPDATE token_ledgers
      SET balance_tokens = GREATEST(0, balance_tokens - ${tokensUsed}),
          balance_naira  = GREATEST(0, balance_naira  - ${nairaAmount}),
          spent_today    = spent_today  + ${nairaAmount},
          spent_month    = spent_month  + ${nairaAmount},
          updated_at     = NOW()
      WHERE merchant_id = ${merchantId}::uuid
    `;
  } catch (err) {
    logger.warn("[tokenLedger] Failed to record token usage", { merchantId, feature, err });
  }
}

/** Groq's pricing for LLaMA 3.3 70B: $0.59/M input, $0.79/M output. Using blended $0.79/M. */
export const GROQ_LLAMA_COST_PER_TOKEN_USD = 0.79 / 1_000_000;
/** USD/NGN rate fallback — should match `app_config.usd_ngn_rate` in the DB. */
export const USD_NGN_FALLBACK = 1650;

/** Converts Groq token count to naira cost. */
export function groqTokensToNaira(tokens: number, usdNgn = USD_NGN_FALLBACK): number {
  return Math.ceil(tokens * GROQ_LLAMA_COST_PER_TOKEN_USD * usdNgn);
}
