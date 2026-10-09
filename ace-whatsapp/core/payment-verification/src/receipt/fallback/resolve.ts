import { StructuredReceipt } from '../parse/types.js';
import { ReconciliationResult } from '../reconcile/types.js';
import { ResolvedReceipt } from './types.js';

export async function resolveWithFallback(
  structured: StructuredReceipt,
  reconciliation: ReconciliationResult,
  imageBuffer: Buffer,
  llmClient: any
): Promise<ResolvedReceipt> {
  return {
    receiptId: structured.receiptId,
    structured,
    reconciliation,
    llmAugmentations: [],
    finalStatus: 'needs_human_review'
  };
}
