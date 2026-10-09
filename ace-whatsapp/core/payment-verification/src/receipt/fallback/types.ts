import { StructuredReceipt } from '../parse/types.js';
import { ReconciliationResult } from '../reconcile/types.js';

export interface ResolvedReceipt {
  receiptId: string;
  structured: StructuredReceipt;
  reconciliation: ReconciliationResult;
  llmAugmentations: Array<{
    field: string;
    llmValue: string;
    llmConfidence: 'low' | 'medium' | 'high';
    promptVersion: string;
    model: string;
    createdAt: string;
  }>;
  finalStatus: 'matched' | 'needs_human_review' | 'rejected';
}

export interface LLMClient {
  ask(prompt: string, imageBuffer: Buffer): Promise<string>;
}
