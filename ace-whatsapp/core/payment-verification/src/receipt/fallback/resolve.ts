import { StructuredReceipt } from '../parse/types.js';
import { ReconciliationResult } from '../reconcile/types.js';
import { ResolvedReceipt, LLMClient } from './types.js';

export async function resolveWithFallback(
  structured: StructuredReceipt,
  reconciliation: ReconciliationResult,
  imageBuffer: Buffer,
  llmClient?: LLMClient | any
): Promise<ResolvedReceipt> {
  const llmAugmentations: ResolvedReceipt['llmAugmentations'] = [];

  // 1. Attempt Vision LLM extraction on missing or ambiguous critical fields
  if (llmClient && imageBuffer && imageBuffer.length > 0) {
    try {
      if (!structured.fields.reference && typeof llmClient.ask === 'function') {
        const prompt = 'Extract the transaction reference or session ID from this Nigerian banking receipt. Return ONLY the reference code, or NONE.';
        const extracted = (await llmClient.ask(prompt, imageBuffer))?.trim();
        if (extracted && extracted !== 'NONE' && extracted.length >= 6) {
          llmAugmentations.push({
            field: 'reference',
            llmValue: extracted,
            llmConfidence: 'high',
            promptVersion: 'v2-prod',
            model: 'vision-llm',
            createdAt: new Date().toISOString(),
          });
          structured.fields.reference = {
            value: extracted,
            confidence: 0.95,
          };
        }
      }
    } catch {
      // Vision model call failed — proceed to reconciliation verification
    }
  }

  // 2. Check if augmented data matches any candidate ledger records
  const matchedCandidate = reconciliation.candidates.find(
    (c) => structured.fields.reference && c.reference && c.reference.toLowerCase() === structured.fields.reference.value.toLowerCase()
  );

  // 3. Absolute last resort: only if all algorithmic and vision matching fail does it escalate to human review
  const finalStatus: ResolvedReceipt['finalStatus'] = matchedCandidate
    ? 'matched'
    : reconciliation.status === 'matched'
    ? 'matched'
    : 'needs_human_review';

  return {
    receiptId: structured.receiptId,
    structured,
    reconciliation: matchedCandidate
      ? { ...reconciliation, status: 'matched', matchedEntry: matchedCandidate }
      : reconciliation,
    llmAugmentations,
    finalStatus,
  };
}
