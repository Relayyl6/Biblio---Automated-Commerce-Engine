/**
 * theme.ts
 * Single source of truth design system tokens for Biblio ACE Mobile App
 * Strictly conforms to DESIGN.md v1.0
 */

import { TextStyle } from 'react-native';

export const colors = {
  light: {
    bg: '#FAF8F4',          // paper-50 (warm off-white, Airbnb-inspired warmth)
    surface: '#FFFFFF',     // paper-0 (card surface)
    surfaceAlt: '#F2EEE7',  // paper-100 (wells, grouped sections)
    wellBg: '#F2EEE7',
    border: 'rgba(15,17,21,0.08)',
    textPrimary: '#0F1115', // ink-950 (primary text, high-contrast UI)
    textSecondary: '#3B404A', // ink-700
    textTertiary: '#8A909C',  // ink-400

    // Brand Accent (Ember)
    accent: '#E8552D',      // ember-500 (primary action, brand accent)
    accentPressed: '#C94420', // ember-600
    accentTint: '#FDEEE9',  // ember-50
    accentSoft: '#FDEEE9',

    // Semantic Colours (Never used decoratively)
    settled: '#14865B',     // settled-600 (payment verified, order complete, healthy)
    settledTint: '#E7F5EE', // settled-50
    success: '#14865B',
    successSoft: '#E7F5EE',

    review: '#B7791F',      // review-600 (needs human decision, amber)
    reviewTint: '#FBF3E4',  // review-50
    warning: '#B7791F',
    warningSoft: '#FBF3E4',

    alert: '#C8322B',       // alert-600 (failed, rejected, overdue, danger)
    alertTint: '#FBE9E8',   // alert-50
    danger: '#C8322B',
    dangerSoft: '#FBE9E8',

    signal: '#2F6FDB',      // signal-600 (information, AI-generated suggestion, link)
    signalTint: '#E9F0FD',  // signal-50
  },
  dark: {
    bg: '#0B0C0F',          // Base dark (deep near-black, OLED battery saver)
    surface: '#15171C',     // Elevated card surface
    surfaceAlt: '#1C1F26',  // Well background
    wellBg: '#1C1F26',
    border: 'rgba(255,255,255,0.08)',
    textPrimary: '#F4F5F7',
    textSecondary: '#B5BAC4',
    textTertiary: '#7C828E',

    // Brand Accent (Lifted Ember for dark-background contrast)
    accent: '#F26A45',
    accentPressed: '#E8552D',
    accentTint: 'rgba(242,106,69,0.16)',
    accentSoft: 'rgba(242,106,69,0.16)',

    // Semantics
    settled: '#3DC58A',
    settledTint: 'rgba(61,197,138,0.14)',
    success: '#3DC58A',
    successSoft: 'rgba(61,197,138,0.14)',

    review: '#F0B45A',
    reviewTint: 'rgba(240,180,90,0.14)',
    warning: '#F0B45A',
    warningSoft: 'rgba(240,180,90,0.14)',

    alert: '#F0746C',
    alertTint: 'rgba(240,116,108,0.14)',
    danger: '#F0746C',
    dangerSoft: 'rgba(240,116,108,0.14)',

    signal: '#6A9DFF',
    signalTint: 'rgba(106,157,255,0.14)',
  },
};

export type ThemeColors = typeof colors.light;

export const radii = {
  xs: 6,
  sm: 10,
  md: 16,
  lg: 24,
  pill: 999,
};

export const radius = radii;

export const spacing = (n: number) => n * 4;

export const space = { 0: 0, 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40, 12: 48, 16: 64 };

export const glass = {
  blur: 24,
  blurLite: 0,
  tintLight: 'rgba(255,255,255,0.62)',
  tintDark: 'rgba(28,31,38,0.56)',
  borderLight: 'rgba(255,255,255,0.55)',
  borderDark: 'rgba(255,255,255,0.10)',
  saturate: 1.6,
};

export const shadows = {
  none: {},
  sm: {
    shadowColor: '#0F1115',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#0F1115',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.10,
    shadowRadius: 24,
    elevation: 3,
  },
  lg: {
    shadowColor: '#0F1115',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.16,
    shadowRadius: 48,
    elevation: 6,
  },
};

export const typography = {
  tabularNums: {
    fontVariant: ['tabular-nums'],
  } as TextStyle,
};

