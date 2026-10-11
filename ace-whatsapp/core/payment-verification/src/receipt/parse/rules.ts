import { OcrToken } from '../ocr/types.js';

export const PATTERNS = {
  // Currency symbols or codes commonly found in Nigeria (NGN, Naira)
  CURRENCY: /(?:NGN|Naira|#)\s*/i,
  // Match amounts like 1,500.00 or 1500 or 1,500
  AMOUNT: /((?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{2})?)/,
  // Dates like 12/Oct/2023, 2023-10-12, 12-10-2023, Oct 12, 2023
  DATE: /(?:\d{1,4}[-/\\.]\d{1,2}[-/\\.]\d{1,4}|\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{1,2},? \d{4}\b)/i,
  // Times like 14:30, 2:30 PM, 14:30:45
  TIME: /\b((?:[01]?\d|2[0-3]):[0-5]\d(?:|\:[0-5]\d)\s*(?:AM|PM|am|pm)?)\b/,
  // Transaction References (typically long alphanumerics)
  REF_MARKER: /(?:ref(?:erence)?|txn|transaction|rrn|trace)\s*(?:no|id|#|:)?\s*/i,
  REF_VALUE: /([A-Z0-9]{8,30})/i,
  // Names
  SENDER_MARKER: /(?:from|sender|payer)\s*:/i,
  RECEIVER_MARKER: /(?:to|receiver|beneficiary|payee)\s*:/i,
  NAME_VALUE: /([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})/, // 2-4 capitalized words
  // Bank Names
  BANK_MARKER: /(?:bank|institution)\s*:/i,
  BANK_VALUE: /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s*(?:Bank|Plc)?)/i,
  // Account Last 4
  ACCT_MARKER: /(?:acct|account)\s*(?:no|num)?\s*:/i,
  ACCT_LAST4_VALUE: /(?:\*+|x+)(\d{4})\b/i,
};

/**
 * Extracts a numeric amount from a raw string if it matches currency patterns.
 */
export function extractAmount(text: string): { value: number; currency: string } | null {
  const match = text.match(new RegExp(PATTERNS.CURRENCY.source + PATTERNS.AMOUNT.source, 'i'));
  if (match) {
    const valStr = match[1].replace(/,/g, '');
    const num = parseFloat(valStr);
    if (!isNaN(num)) return { value: num, currency: 'NGN' }; // Defaults to NGN for Nigerian platform
  }
  return null;
}

/**
 * Extracts a reference string.
 */
export function extractReference(text: string): string | null {
  const match = text.match(new RegExp(PATTERNS.REF_MARKER.source + PATTERNS.REF_VALUE.source, 'i'));
  if (match) {
    return match[1].trim();
  }
  // Fallback: look for isolated long alphanumerics
  const isolated = text.match(PATTERNS.REF_VALUE);
  if (isolated) return isolated[1].trim();
  return null;
}
