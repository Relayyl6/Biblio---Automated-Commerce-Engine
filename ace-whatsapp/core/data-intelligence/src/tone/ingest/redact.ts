/**
 * Deterministically redacts PII from transcript text.
 * Replaces matches with stable tokens: <EMAIL>, <PHONE>, <CARD>, etc.
 */

const PII_PATTERNS = [
  // Email: basic RFC 5322 approximation
  { regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, token: '<EMAIL>' },
  // Phone: common Nigerian/International formats
  { regex: /(?:\+?234|0)[789][01]\d{8}\b/g, token: '<PHONE>' },
  // Card Number: 16-19 digits, possibly space/dash separated
  { regex: /\b(?:\d[ -]*?){13,16}\b/g, token: '<CARD>' },
  // Simple Bank Account approximation (10 digits in Nigeria)
  { regex: /\b\d{10}\b/g, token: '<ACCOUNT>' },
];

export function redact(text: string): string {
  if (!text) return text;
  let redacted = text;
  
  for (const pattern of PII_PATTERNS) {
    redacted = redacted.replace(pattern.regex, pattern.token);
  }
  
  return redacted;
}
