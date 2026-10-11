import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useColorScheme } from 'nativewind';
import { LucideIcon } from 'lucide-react-native';
import { colors } from '../../theme';

type Props = {
  icon: LucideIcon;
  iconColor?: string;
  label: string;
  value: string;
  caption?: string;
  onPress?: () => void;
};

/**
 * One metric tile (used for AOCR, Active Chats, etc. on the Pulse
 * screen, and reusable anywhere else a KPI card is needed). Pulls
 * repeated markup out of the screen so new metrics are a 6-line add.
 */
export function StatTile({ icon: Icon, iconColor, label, value, caption, onPress }: Props) {
  const { colorScheme } = useColorScheme();
  const c = colorScheme === 'dark' ? colors.dark : colors.light;
  const resolvedIconColor = iconColor ?? c.accent;

  return (
    <Pressable
      onPress={onPress}
      style={{ backgroundColor: c.surface, borderColor: c.border }}
      className="flex-1 p-5 rounded-3xl border items-start justify-between active:opacity-70"
    >
      <View
        style={{ backgroundColor: resolvedIconColor + '1A' }}
        className="w-9 h-9 rounded-full items-center justify-center mb-3"
      >
        <Icon size={18} color={resolvedIconColor} />
      </View>
      <Text style={{ color: c.textSecondary }} className="text-xs font-bold uppercase tracking-wider mb-1">
        {label}
      </Text>
      <Text style={{ color: c.textPrimary }} className="text-3xl font-bold tracking-tight">
        {value}
      </Text>
      {caption && (
        <Text style={{ color: c.textTertiary }} className="text-[11px] mt-1">
          {caption}
        </Text>
      )}
    </Pressable>
  );
}
