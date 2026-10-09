import { RawOcrResult } from '../ocr/types.js';
import { StructuredReceipt } from './types.js';
import { extractAmount, extractReference, PATTERNS } from './rules.js';

export function parseReceipt(raw: RawOcrResult): StructuredReceipt {
  const result: StructuredReceipt = {
    receiptId: raw.imageId,
    fields: {
      amount: null,
      timestamp: null,
      reference: null,
      senderName: null,
      receiverName: null,
      bankName: null,
      accountLast4: null,
    },
    ambiguities: [],
    parsedAt: new Date().toISOString(),
    parserVersion: '1.0.0',
  };

  const textBlocks = raw.fullText.split('\n').map(l => l.trim()).filter(Boolean);
  
  // 1. Amount Extraction
  const amountCandidates: { value: number; currency: string; confidence: number; token: string }[] = [];
  for (const block of textBlocks) {
    const extracted = extractAmount(block);
    if (extracted) {
      // Find the corresponding OCR token to gauge confidence
      const token = raw.tokens.find(t => block.includes(t.text));
      const ocrConf = token ? token.confidence : 0.5;
      
      // Boost confidence if it's near "Total" or "Amount"
      let ruleConf = 0.5;
      if (/total|amount|paid/i.test(block)) ruleConf = 0.9;
      
      amountCandidates.push({
        value: extracted.value,
        currency: extracted.currency,
        confidence: (ocrConf + ruleConf) / 2,
        token: block
      });
    }
  }

  if (amountCandidates.length === 1 && amountCandidates[0].confidence >= 0.7) {
    result.fields.amount = {
      value: amountCandidates[0].value,
      currency: amountCandidates[0].currency,
      confidence: amountCandidates[0].confidence
    };
  } else if (amountCandidates.length > 1) {
    // Sort by confidence descending
    amountCandidates.sort((a, b) => b.confidence - a.confidence);
    if (amountCandidates[0].confidence >= 0.8 && (amountCandidates[0].confidence - amountCandidates[1].confidence) > 0.2) {
      // Clear winner
      result.fields.amount = {
        value: amountCandidates[0].value,
        currency: amountCandidates[0].currency,
        confidence: amountCandidates[0].confidence
      };
    } else {
      result.ambiguities.push({
        field: 'amount',
        reason: 'Multiple conflicting amounts found without a clear high-confidence winner.',
        candidates: amountCandidates.map(c => c.value.toString())
      });
    }
  } else if (amountCandidates.length === 1) {
    result.ambiguities.push({
      field: 'amount',
      reason: 'Low confidence amount match.',
      candidates: [amountCandidates[0].value.toString()]
    });
  }

  // 2. Reference Extraction
  const refCandidates: { value: string; confidence: number }[] = [];
  for (const block of textBlocks) {
    const ref = extractReference(block);
    if (ref) {
      const token = raw.tokens.find(t => block.includes(t.text));
      const ocrConf = token ? token.confidence : 0.5;
      let ruleConf = PATTERNS.REF_MARKER.test(block) ? 0.9 : 0.6;
      refCandidates.push({ value: ref, confidence: (ocrConf + ruleConf) / 2 });
    }
  }
  
  if (refCandidates.length > 0) {
    refCandidates.sort((a, b) => b.confidence - a.confidence);
    if (refCandidates[0].confidence >= 0.7) {
      result.fields.reference = refCandidates[0];
    } else {
      result.ambiguities.push({
        field: 'reference',
        reason: 'Low confidence reference match.',
        candidates: refCandidates.map(c => c.value)
      });
    }
  }

  // Similar robust logic would follow for timestamp, names, etc.
  // For brevity and focus on safety:
  return result;
}
