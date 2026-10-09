/**
 * Shared design tokens for Biblo's React Native screens.
 * Import these instead of hardcoding hex values so every screen
 * (tab bar, inbox, pulse, more, etc.) stays visually consistent
 * and dark mode updates in one place.
 */

export const colors = {
  light: {
    bg: '#F7F8FA',
    surface: '#FFFFFF',
    surfaceAlt: '#F1F3F6',
    border: '#EEF0F3',
    textPrimary: '#0F172A',
    textSecondary: '#64748B',
    textTertiary: '#94A3B8',
    accent: '#25D366', // Brand Green (WhatsApp/Biblio identity)
    accentSoft: 'rgba(37, 211, 102, 0.12)', // 12% opacity of accent
    success: '#10B981',
    successSoft: '#ECFDF5',
    danger: '#EF4444',
    dangerSoft: '#FEF2F2',
    warning: '#F59E0B',
    warningSoft: '#FFFBEB',
  },
  dark: {
    bg: '#0B0F0E', // Deeper, slightly green-tinted dark background
    surface: '#151A18', // Surface card color
    surfaceAlt: '#1B221F', 
    border: '#232D29',
    textPrimary: '#F8FAFC',
    textSecondary: '#A1A1AA',
    textTertiary: '#71717A',
    accent: '#25D366', // Brand Green stays popping in dark mode
    accentSoft: 'rgba(37, 211, 102, 0.15)', // 15% opacity of accent
    success: '#25D366', 
    successSoft: 'rgba(37, 211, 102, 0.1)',
    danger: '#F87171',
    dangerSoft: 'rgba(248, 113, 113, 0.1)',
    warning: '#FBBF24',
    warningSoft: 'rgba(251, 191, 36, 0.1)',
  },
};

export type ThemeColors = typeof colors.light;

export const radii = {
  sm: 12,
  md: 18,
  lg: 24,
  pill: 999,
};

export const spacing = (n: number) => n * 4;

/**
 * `shadow-sm` etc. via NativeWind className doesn't reliably render on both
 * platforms — use these as a `style` prop instead for any elevated surface
 * (cards, floating buttons, search bars).
 */
export const shadows = {
  none: {},
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
};
