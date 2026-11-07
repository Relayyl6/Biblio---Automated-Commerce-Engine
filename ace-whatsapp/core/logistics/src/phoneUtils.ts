// core/logistics/src/phoneUtils.ts
//
// Nigerian Phone Number Formatting & Validation Utility.
// Handles all variations of Nigerian MSISDNs:
//   - National format: "08031234567" (11 digits)
//   - E.164 format: "+2348031234567" (14 chars)
//   - International plain: "2348031234567" (13 digits)
//   - 10-digit no-lead-zero: "8031234567"
//   - Raw formatted: "+234 803 123 4567", "(0803) 123-4567"

export type PhoneFormat = "e164" | "national" | "international";

const NIGERIAN_MOBILE_PREFIXES = ["70", "80", "81", "90", "91"];

/**
 * Normalizes a Nigerian phone number to the target format.
 * Defaults to 'e164' (+234...).
 */
export function normalizeNigerianPhone(
  phone: string | null | undefined,
  targetFormat: PhoneFormat = "e164"
): string {
  if (!phone || typeof phone !== "string") return "";

  // Strip all non-numeric characters except leading '+'
  const rawDigits = phone.replace(/[^0-9]/g, "");

  let tenDigits = "";

  if (rawDigits.startsWith("2340") && rawDigits.length === 14) {
    tenDigits = rawDigits.slice(4);
  } else if (rawDigits.startsWith("00234") && rawDigits.length === 15) {
    tenDigits = rawDigits.slice(5);
  } else if (rawDigits.startsWith("234") && rawDigits.length === 13) {
    tenDigits = rawDigits.slice(3);
  } else if (rawDigits.startsWith("0") && rawDigits.length === 11) {
    tenDigits = rawDigits.slice(1);
  } else if (rawDigits.length === 10) {
    tenDigits = rawDigits;
  } else if (rawDigits.length > 10) {
    // If extra prefix, take last 10 digits
    tenDigits = rawDigits.slice(-10);
  } else {
    // Fallback: return raw cleaned digits
    return phone.trim();
  }

  // Validate mobile prefix (first two digits of the 10-digit number)
  const prefix = tenDigits.slice(0, 2);
  const isValidPrefix = NIGERIAN_MOBILE_PREFIXES.includes(prefix);

  if (!isValidPrefix) {
    // Return sanitized digits even if non-standard mobile prefix
    if (targetFormat === "e164") return `+234${tenDigits}`;
    if (targetFormat === "national") return `0${tenDigits}`;
    return `234${tenDigits}`;
  }

  switch (targetFormat) {
    case "national":
      return `0${tenDigits}`;
    case "international":
      return `234${tenDigits}`;
    case "e164":
    default:
      return `+234${tenDigits}`;
  }
}

/**
 * Validates if a string is a valid Nigerian mobile phone number.
 */
export function isValidNigerianPhone(phone: string | null | undefined): boolean {
  if (!phone || typeof phone !== "string") return false;
  const digits = phone.replace(/[^0-9]/g, "");
  let ten = "";
  if (digits.startsWith("2340") && digits.length === 14) ten = digits.slice(4);
  else if (digits.startsWith("00234") && digits.length === 15) ten = digits.slice(5);
  else if (digits.startsWith("234") && digits.length === 13) ten = digits.slice(3);
  else if (digits.startsWith("0") && digits.length === 11) ten = digits.slice(1);
  else if (digits.length === 10) ten = digits;
  else if (digits.length > 10) ten = digits.slice(-10);
  else return false;

  return NIGERIAN_MOBILE_PREFIXES.includes(ten.slice(0, 2));
}

/**
 * Cleans and formats rider contact phone returned from courier APIs.
 * Preserves text placeholders like "Assigned on Pickup" or "Pending".
 * Formats valid numbers in +234 (e164) format.
 */
export function formatRiderPhone(rawRiderPhone: string | null | undefined): string {
  if (!rawRiderPhone) return "Pending Assignment";
  const trimmed = rawRiderPhone.trim();
  if (
    trimmed.toLowerCase().includes("pending") ||
    trimmed.toLowerCase().includes("assigned") ||
    trimmed.toLowerCase().includes("n/a")
  ) {
    return trimmed;
  }

  if (isValidNigerianPhone(trimmed)) {
    return normalizeNigerianPhone(trimmed, "e164");
  }

  return trimmed;
}
