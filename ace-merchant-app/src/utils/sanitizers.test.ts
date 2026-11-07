import { describe, it, expect } from 'vitest';
import {
  normalizePhoneNumber,
  isValidPhoneNumber,
  formatPhoneDisplay,
  sanitizeCurrencyInput,
  sanitizeIntegerInput,
  decodeRouteParam,
  safeHaptics,
} from './sanitizers';

describe('sanitizers utility suite', () => {
  describe('normalizePhoneNumber', () => {
    it('normalizes 11-digit Nigerian domestic numbers starting with 0', () => {
      expect(normalizePhoneNumber('08012345678')).toBe('2348012345678');
      expect(normalizePhoneNumber('07039876543')).toBe('2347039876543');
      expect(normalizePhoneNumber('09011223344')).toBe('2349011223344');
    });

    it('normalizes 10-digit Nigerian numbers entered without leading 0', () => {
      expect(normalizePhoneNumber('8012345678')).toBe('2348012345678');
      expect(normalizePhoneNumber('9022334455')).toBe('2349022334455');
    });

    it('preserves existing 234 international numbers and strips symbols', () => {
      expect(normalizePhoneNumber('+234 801 234 5678')).toBe('2348012345678');
      expect(normalizePhoneNumber('234-801-234-5678')).toBe('2348012345678');
      expect(normalizePhoneNumber('002348012345678')).toBe('2348012345678');
    });

    it('returns empty string for null, undefined, or empty inputs', () => {
      expect(normalizePhoneNumber('')).toBe('');
      expect(normalizePhoneNumber(null)).toBe('');
      expect(normalizePhoneNumber(undefined)).toBe('');
    });
  });

  describe('isValidPhoneNumber', () => {
    it('validates correct numbers', () => {
      expect(isValidPhoneNumber('08012345678')).toBe(true);
      expect(isValidPhoneNumber('+2348012345678')).toBe(true);
      expect(isValidPhoneNumber('8012345678')).toBe(true);
    });

    it('rejects short or empty inputs', () => {
      expect(isValidPhoneNumber('1234')).toBe(false);
      expect(isValidPhoneNumber('')).toBe(false);
      expect(isValidPhoneNumber('abc')).toBe(false);
    });
  });

  describe('formatPhoneDisplay', () => {
    it('formats 234 numbers nicely with country code', () => {
      expect(formatPhoneDisplay('08012345678')).toBe('+234 801 234 5678');
      expect(formatPhoneDisplay('2348012345678')).toBe('+234 801 234 5678');
    });
  });

  describe('sanitizeCurrencyInput', () => {
    it('strips Naira symbols and commas', () => {
      expect(sanitizeCurrencyInput('₦50,000')).toBe(50000);
      expect(sanitizeCurrencyInput('5,000.50')).toBe(5000.5);
      expect(sanitizeCurrencyInput(' ₦ 100,000 ')).toBe(100000);
    });

    it('handles negative or invalid inputs with fallback', () => {
      expect(sanitizeCurrencyInput('-500', 0)).toBe(0);
      expect(sanitizeCurrencyInput('invalid', 0)).toBe(0);
      expect(sanitizeCurrencyInput(undefined, 100)).toBe(100);
    });

    it('handles direct number inputs', () => {
      expect(sanitizeCurrencyInput(15000)).toBe(15000);
      expect(sanitizeCurrencyInput(-10, 0)).toBe(0);
    });
  });

  describe('sanitizeIntegerInput', () => {
    it('extracts integer from text or formatted string', () => {
      expect(sanitizeIntegerInput('15 units')).toBe(15);
      expect(sanitizeIntegerInput('2024')).toBe(2024);
      expect(sanitizeIntegerInput('0')).toBe(0);
    });
  });

  describe('decodeRouteParam', () => {
    it('handles string, array, or undefined', () => {
      expect(decodeRouteParam('2348012345678')).toBe('2348012345678');
      expect(decodeRouteParam(['firstParam', 'secondParam'])).toBe('firstParam');
      expect(decodeRouteParam(undefined, 'default')).toBe('default');
    });

    it('decodes encoded WhatsApp JIDs correctly', () => {
      expect(decodeRouteParam('2348012345678%40s.whatsapp.net')).toBe('2348012345678@s.whatsapp.net');
      expect(decodeRouteParam('%2B2348012345678')).toBe('+2348012345678');
    });
  });

  describe('safeHaptics platform fallback', () => {
    it('safely invokes without throwing when haptics unavailable', () => {
      expect(() => safeHaptics.impact()).not.toThrow();
      expect(() => safeHaptics.notification()).not.toThrow();
      expect(() => safeHaptics.selection()).not.toThrow();
    });
  });
});
