import { StructuredReceipt } from '../parse/types.js';
import { LedgerEntry, ReconciliationResult } from './types.js';

export function reconcile(
  receipt: StructuredReceipt,
  ledgerCandidates: LedgerEntry[]
): ReconciliationResult {
  const result: ReconciliationResult = {
    receiptId: receipt.receiptId,
    status: 'not_found',
    matchedEntry: null,
    candidates: [],
    reasons: [],
    reconciledAt: new Date().toISOString()
  };

  // 1. Guard against low confidence fields
  if (!receipt.fields.amount) {
    result.status = 'rejected_low_confidence';
    result.reasons.push('Receipt amount is missing or parsed with low confidence.');
    return result;
  }
  
  if (receipt.ambiguities.some(a => a.field === 'amount' || a.field === 'reference')) {
    result.status = 'rejected_low_confidence';
    result.reasons.push('Receipt contains ambiguities in critical fields (amount or reference).');
    return result;
  }

  const rAmount = receipt.fields.amount.value;
  const rCurrency = receipt.fields.amount.currency;
  
  // 2. Strict Cents Matching Filter
  const amountMatches = ledgerCandidates.filter(entry => {
    // Exact match down to the cent. No fuzzy logic.
    return entry.currency === rCurrency && Math.abs(entry.amount - rAmount) < 0.0001;
  });

  if (amountMatches.length === 0) {
    result.status = 'not_found';
    result.reasons.push(`No ledger entry found with exact amount ${rAmount} ${rCurrency}.`);
    return result;
  }

  // 3. Score the remaining candidates
  const scoredCandidates = amountMatches.map(entry => {
    let score = 0;
    
    // Exact reference match is a very strong signal
    if (receipt.fields.reference && entry.reference) {
      if (receipt.fields.reference.value.toLowerCase() === entry.reference.toLowerCase()) {
        score += 100;
      }
    }
    
    // Account Last 4 match
    if (receipt.fields.accountLast4 && entry.accountLast4) {
      if (receipt.fields.accountLast4.value === entry.accountLast4) {
        score += 50;
      }
    }

    return { entry, score };
  });

  // Sort descending by score
  scoredCandidates.sort((a, b) => b.score - a.score);
  result.candidates = scoredCandidates.map(c => c.entry);

  const bestScore = scoredCandidates[0].score;

  // 4. Decision logic
  if (scoredCandidates.length === 1) {
    // Only one entry with this exact amount. If no reference is present to confirm, it's risky but acceptable if score >= 0.
    result.status = 'matched';
    result.matchedEntry = scoredCandidates[0].entry;
    result.reasons.push(`Exact amount match found. Scored ${bestScore}.`);
  } else if (bestScore >= 100 && (scoredCandidates[1].score < bestScore)) {
    // Multiple amount matches, but one has an exact reference match winner
    result.status = 'matched';
    result.matchedEntry = scoredCandidates[0].entry;
    result.reasons.push(`Multiple amount matches, but found distinct winner via exact reference match.`);
  } else {
    // Multiple amount matches, and we can't definitively pick one (e.g., both score 0)
    result.status = 'ambiguous';
    result.reasons.push('Multiple ledger entries have the exact same amount and no definitive tie-breaker (like Reference ID) matched.');
  }

  return result;
}
