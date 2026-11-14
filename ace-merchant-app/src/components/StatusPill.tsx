import React from 'react';
import { View, Text } from 'react-native';
import { CheckCircle2, Clock, Eye, Sparkles, XCircle } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { colors } from '../../theme';

export type StatusVariant =
  | 'verified'
  | 'settled'
  | 'success'
  | 'pending'
  | 'review'
  | 'needs_review'
  | 'warning'
  | 'ai_handled'
  | 'signal'
  | 'failed'
  | 'alert'
  | 'danger'
  | 'neutral';

interface StatusPillProps {
  label: string;
  variant?: StatusVariant;
  tone?: StatusVariant; // Backwards compatible alias
  showIcon?: boolean;
}

/**
 * StatusPill
 * Strict implementation of DESIGN.md Section 9.2:
 * Always icon + label + tint.
 */
export function StatusPill({ label, variant, tone = 'neutral', showIcon = true }: StatusPillProps) {
  const { colorScheme } = useColorScheme();
  const c = colorScheme === 'dark' ? colors.dark : colors.light;
  const activeKey = variant || tone;

  let bg = c.surfaceAlt;
  let fg = c.textSecondary;
  let IconComponent = null;

  switch (activeKey) {
    case 'verified':
    case 'settled':
    case 'success':
      bg = c.settledTint;
      fg = c.settled;
      IconComponent = CheckCircle2;
      break;

    case 'pending':
      bg = c.wellBg;
      fg = c.textTertiary;
      IconComponent = Clock;
      break;

    case 'review':
    case 'needs_review':
    case 'warning':
      bg = c.reviewTint;
      fg = c.review;
      IconComponent = Eye;
      break;

    case 'ai_handled':
    case 'signal':
      bg = c.signalTint;
      fg = c.signal;
      IconComponent = Sparkles;
      break;

    case 'failed':
    case 'alert':
    case 'danger':
      bg = c.alertTint;
      fg = c.alert;
      IconComponent = XCircle;
      break;

    case 'neutral':
    default:
      bg = c.surfaceAlt;
      fg = c.textSecondary;
      IconComponent = null;
      break;
  }

  return (
    <View
      style={{ backgroundColor: bg }}
      className="px-2.5 py-1 rounded-full self-start flex-row items-center"
    >
      {showIcon && IconComponent && (
        <IconComponent size={12} color={fg} style={{ marginRight: 4 }} />
      )}
      <Text style={{ color: fg }} className="text-[11px] font-bold">
        {label}
      </Text>
    </View>
  );
}
