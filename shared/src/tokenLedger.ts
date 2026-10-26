// shared/src/tokenLedger.ts
// Records AI compute consumption per merchant per feature.
// Called after every LLM turn so the token ledger is self-updating.
import { sql } from "@ace/shared/clients";
import { logger } from "@ace/shared/logger.js";
import { getLiveUsdNgnRate, convertTokensToNgn } from "./fxService.js";

/**
 * Records tokens/naira consumed for a feature and deducts from the merchant's token ledger.
 * Safe to call fire-and-forget (errors are logged, never thrown).
 */
export async function recordTokenUsage(
  merchantId: string,
  feature: string,
  tokensUsed: number,
  nairaAmount?: number,
  metadata: Record<string, unknown> = {}
): Promise<void> {
  try {
    // If nairaAmount is not supplied or 0, compute dynamically using live FX market rates
    const resolvedNaira = nairaAmount && nairaAmount > 0 
      ? nairaAmount 
      : await convertTokensToNgn(tokensUsed, 0.79);

    await sql`
      INSERT INTO token_usage_events (merchant_id, feature, tokens_used, naira_amount, metadata)
      VALUES (${merchantId}::uuid, ${feature}, ${tokensUsed}, ${resolvedNaira}, ${JSON.stringify(metadata)}::jsonb)
    `;
    await sql`
      UPDATE token_ledgers
      SET balance_tokens = GREATEST(0, balance_tokens - ${tokensUsed}),
          balance_naira  = GREATEST(0, balance_naira  - ${resolvedNaira}),
          spent_today    = spent_today  + ${resolvedNaira},
          spent_month    = spent_month  + ${resolvedNaira},
          updated_at     = NOW()
      WHERE merchant_id = ${merchantId}::uuid
    `;
  } catch (err) {
    logger.warn("[tokenLedger] Failed to record token usage", { merchantId, feature, err });
  }
}

/** Groq's pricing for LLaMA 3.3 70B: $0.59/M input, $0.79/M output. Using blended $0.79/M. */
export const GROQ_LLAMA_COST_PER_TOKEN_USD = 0.79 / 1_000_000;

/** Converts Groq token count to naira cost synchronously or with live rate */
export function groqTokensToNaira(tokens: number, liveRate?: number): number {
  const rate = liveRate && liveRate > 0 ? liveRate : 1450;
  return Math.max(1, Math.ceil(tokens * GROQ_LLAMA_COST_PER_TOKEN_USD * rate));
}

/** Converts Groq token count to naira cost using real-time live FX market rate */
export async function groqTokensToNairaLive(tokens: number): Promise<number> {
  return convertTokensToNgn(tokens, 0.79);
}
