import React from 'react';
import { View, Text } from 'react-native';
import { useColorScheme } from 'nativewind';
import { colors } from '../../theme';

type Tone = 'success' | 'warning' | 'danger' | 'neutral';

/**
 * Generalizes the in-stock/low-stock/out-of-stock pill from CRM so any
 * screen can show a status badge (unread count, reconciliation state,
 * payment status) with consistent tone colors.
 */
export function StatusPill({ label, tone = 'neutral' }: { label: string; tone?: Tone }) {
  const { colorScheme } = useColorScheme();
  const c = colorScheme === 'dark' ? colors.dark : colors.light;

  const map: Record<Tone, { bg: string; fg: string }> = {
    success: { bg: c.successSoft, fg: c.success },
    warning: { bg: c.warningSoft, fg: c.warning },
    danger: { bg: c.dangerSoft, fg: c.danger },
    neutral: { bg: c.surfaceAlt, fg: c.textSecondary },
  };
  const { bg, fg } = map[tone];

  return (
    <View style={{ backgroundColor: bg }} className="px-3 py-1.5 rounded-full self-start">
      <Text style={{ color: fg }} className="text-xs font-bold uppercase tracking-wider">
        {label}
      </Text>
    </View>
  );
}
