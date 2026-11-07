import { Platform } from 'react-native';

let ExpoHaptics: any = null;
try {
  // Gracefully load in Expo native environments
  ExpoHaptics = require('expo-haptics');
} catch (_) {}

/**
 * Normalizes phone numbers to standard E.164 format without leading '+'
 * Default country code is '234' (Nigeria/West Africa).
 *
 * Handles:
 * - 08012345678 (11 digits starting with 0) -> 2348012345678
 * - 8012345678 (10 digits starting with 8/7/9) -> 2348012345678
 * - +2348012345678 -> 2348012345678
 * - 2348012345678 -> 2348012345678
 * - 0092348012345678 -> 2348012345678
 * - Strips all non-digit formatting: spaces, dashes, brackets, pluses
 */
export function normalizePhoneNumber(raw: string | undefined | null, defaultCountryCode = '234'): string {
  if (!raw) return '';
  let digits = String(raw).replace(/\D/g, '');
  if (!digits) return '';

  // Strip international dialing prefix 00
  if (digits.startsWith('00')) {
    digits = digits.slice(2);
  }

  // Domestic Nigerian 11-digit numbers (080..., 081..., 070..., 090..., 091...)
  if (digits.startsWith('0') && digits.length === 11) {
    return `${defaultCountryCode}${digits.slice(1)}`;
  }

  // 10-digit Nigerian numbers entered without the leading 0 (80..., 81..., 70..., 90...)
  if (digits.length === 10 && !digits.startsWith('234')) {
    return `${defaultCountryCode}${digits}`;
  }

  return digits;
}

/**
 * Validates whether a phone number has a realistic length (10 to 15 digits)
 */
export function isValidPhoneNumber(raw: string | undefined | null): boolean {
  const normalized = normalizePhoneNumber(raw);
  return normalized.length >= 10 && normalized.length <= 15;
}

/**
 * Formats phone number for display (e.g. +234 801 234 5678)
 */
export function formatPhoneDisplay(raw: string | undefined | null): string {
  const normalized = normalizePhoneNumber(raw);
  if (!normalized) return '';
  if (normalized.startsWith('234') && normalized.length === 13) {
    return `+234 ${normalized.slice(3, 6)} ${normalized.slice(6, 9)} ${normalized.slice(9)}`;
  }
  if (normalized.length === 11 && normalized.startsWith('0')) {
    return `${normalized.slice(0, 4)} ${normalized.slice(4, 7)} ${normalized.slice(7)}`;
  }
  return `+${normalized}`;
}

/**
 * Sanitizes currency string input by removing symbols (₦, $, €, £), commas, spaces,
 * and parsing as a positive finite number.
 */
export function sanitizeCurrencyInput(raw: string | number | undefined | null, fallback = 0): number {
  if (raw === undefined || raw === null) return fallback;
  if (typeof raw === 'number') {
    return isFinite(raw) && !isNaN(raw) ? Math.max(0, raw) : fallback;
  }
  const str = String(raw).trim();
  if (str.includes('-')) return fallback;
  const clean = str.replace(/[^0-9.]/g, '');
  if (!clean) return fallback;
  const parsed = parseFloat(clean);
  if (isNaN(parsed) || !isFinite(parsed) || parsed < 0) return fallback;
  return parsed;
}

/**
 * Sanitizes numeric integer input (e.g., stock count, day, year).
 */
export function sanitizeIntegerInput(raw: string | number | undefined | null, fallback = 0): number {
  if (raw === undefined || raw === null) return fallback;
  if (typeof raw === 'number') {
    return isFinite(raw) && !isNaN(raw) ? Math.floor(raw) : fallback;
  }
  const clean = String(raw).replace(/\D/g, '');
  if (!clean) return fallback;
  const parsed = parseInt(clean, 10);
  return isNaN(parsed) ? fallback : parsed;
}

/**
 * Safely decodes a route parameter that might be a string, string array, or undefined.
 * Also decodes any URI encoding without throwing URIError.
 */
export function decodeRouteParam(param: string | string[] | undefined | null, fallback = ''): string {
  if (!param) return fallback;
  const raw = Array.isArray(param) ? param[0] : param;
  if (!raw) return fallback;
  try {
    return decodeURIComponent(raw);
  } catch (_) {
    return raw;
  }
}

/**
 * Platform-safe haptics engine that silently succeeds on Web, simulators,
 * or platforms without haptic feedback engines.
 */
export const safeHaptics = {
  impact: (style?: any) => {
    if (Platform.OS !== 'web' && ExpoHaptics) {
      try {
        ExpoHaptics.impactAsync?.(style || ExpoHaptics.ImpactFeedbackStyle?.Light).catch(() => {});
      } catch (_) {}
    }
  },
  notification: (type?: any) => {
    if (Platform.OS !== 'web' && ExpoHaptics) {
      try {
        ExpoHaptics.notificationAsync?.(type || ExpoHaptics.NotificationFeedbackType?.Success).catch(() => {});
      } catch (_) {}
    }
  },
  selection: () => {
    if (Platform.OS !== 'web' && ExpoHaptics) {
      try {
        ExpoHaptics.selectionAsync?.().catch(() => {});
      } catch (_) {}
    }
  },
};
