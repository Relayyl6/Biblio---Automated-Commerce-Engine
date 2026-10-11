import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useColorScheme } from 'nativewind';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { LucideIcon } from 'lucide-react-native';
import { colors } from '../../theme';

type Props = {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
};

/**
 * Reusable zero-state for any screen whose list can be empty
 * (inbox, chats, orders...). Keeps the "you're all caught up" feel
 * consistent instead of every screen re-inventing it.
 */
export function EmptyState({ icon: Icon, title, subtitle, actionLabel, onAction }: Props) {
  const { colorScheme } = useColorScheme();
  const c = colorScheme === 'dark' ? colors.dark : colors.light;

  return (
    <Animated.View
      entering={FadeInUp.duration(400).springify()}
      className="flex-1 items-center justify-center px-10"
    >
      <View
        style={{ backgroundColor: c.successSoft }}
        className="w-20 h-20 rounded-full items-center justify-center mb-6"
      >
        <Icon size={36} color={c.success} strokeWidth={2} />
      </View>
      <Text style={{ color: c.textPrimary }} className="text-xl font-bold mb-2 text-center">
        {title}
      </Text>
      {subtitle && (
        <Text style={{ color: c.textSecondary }} className="text-sm text-center leading-relaxed mb-6">
          {subtitle}
        </Text>
      )}
      {actionLabel && onAction && (
        <Pressable
          onPress={onAction}
          style={{ backgroundColor: c.surface, borderColor: c.border }}
          className="px-6 py-3 rounded-full border active:opacity-70"
        >
          <Text style={{ color: c.textPrimary }} className="font-bold text-sm">
            {actionLabel}
          </Text>
        </Pressable>
      )}
    </Animated.View>
  );
}
