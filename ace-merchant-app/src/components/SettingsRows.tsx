import React from 'react';
import { View, Text, Switch, Pressable, TextInput } from 'react-native';
import { useColorScheme } from 'nativewind';
import { ChevronRight, LucideIcon } from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { colors, radius, typography } from '../../theme';

function useThemeColors() {
  const { colorScheme } = useColorScheme();
  return colorScheme === 'dark' ? colors.dark : colors.light;
}

/**
 * Section
 * Follows DESIGN.md Section 3.2, 3.4 & 9:
 * Groups rows under a clean elevated card with radius-md (16px) or radius-lg (24px)
 */
export function Section({
  title,
  icon: Icon,
  children,
  delay = 0,
}: {
  title: string;
  icon?: LucideIcon;
  children: React.ReactNode;
  delay?: number;
}) {
  const c = useThemeColors();
  return (
    <Animated.View entering={FadeInDown.delay(delay).springify()} className="mb-6">
      <View className="flex-row items-center mb-3 px-4">
        {Icon && <Icon size={18} color={c.textTertiary} style={{ marginRight: 8 }} />}
        <Text style={{ color: c.textTertiary }} className="font-bold text-xs uppercase tracking-wider">
          {title}
        </Text>
      </View>
      <View
        style={{
          backgroundColor: c.surface,
          borderColor: c.border,
          borderRadius: radius.lg,
        }}
        className="mx-4 px-4 border"
      >
        {children}
      </View>
    </Animated.View>
  );
}

export function ToggleRow({
  title,
  subtitle,
  value,
  onValueChange,
  isLast = false,
}: {
  title: string;
  subtitle: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  isLast?: boolean;
}) {
  const c = useThemeColors();
  return (
    <View
      style={{ borderBottomWidth: isLast ? 0 : 1, borderBottomColor: c.border }}
      className="py-4 flex-row justify-between items-center"
    >
      <View className="flex-1 pr-4">
        <Text style={{ color: c.textPrimary }} className="font-semibold text-base mb-1">
          {title}
        </Text>
        <Text style={{ color: c.textSecondary }} className="text-xs leading-relaxed">
          {subtitle}
        </Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: c.border, true: c.accent }}
        thumbColor={c.surface}
      />
    </View>
  );
}

/**
 * InputRow
 * Follows DESIGN.md Section 9.5:
 * Height 52px, radius-sm (10px), wellBg fill, 1px border.
 */
export function InputRow({
  title,
  subtitle,
  value,
  onChangeText,
  placeholder,
  prefix = '',
  isLast = false,
}: {
  title: string;
  subtitle: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  prefix?: string;
  isLast?: boolean;
}) {
  const c = useThemeColors();
  return (
    <View style={{ borderBottomWidth: isLast ? 0 : 1, borderBottomColor: c.border }} className="py-4">
      <View className="mb-2.5">
        <Text style={{ color: c.textPrimary }} className="font-semibold text-base mb-1">
          {title}
        </Text>
        <Text style={{ color: c.textSecondary }} className="text-xs leading-relaxed">
          {subtitle}
        </Text>
      </View>
      <View
        style={{
          backgroundColor: c.wellBg,
          borderColor: c.border,
          borderRadius: radius.sm,
          height: 52,
        }}
        className="flex-row items-center border px-4"
      >
        {!!prefix && (
          <Text style={{ color: c.textTertiary }} className="mr-2 font-bold text-base">
            {prefix}
          </Text>
        )}
        <TextInput
          style={{
            color: c.textPrimary,
            ...typography.tabularNums,
          }}
          className="flex-1 font-semibold text-base"
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={c.textTertiary}
          keyboardType="numeric"
        />
      </View>
    </View>
  );
}

export function NavigationRow({
  title,
  subtitle,
  icon: Icon,
  onPress,
  isLast = false,
}: {
  title: string;
  subtitle: string;
  icon: LucideIcon;
  onPress: () => void;
  isLast?: boolean;
}) {
  const c = useThemeColors();
  return (
    <Pressable
      onPress={onPress}
      style={{ borderBottomWidth: isLast ? 0 : 1, borderBottomColor: c.border }}
      className="py-4 flex-row justify-between items-center active:opacity-70"
    >
      <View style={{ backgroundColor: c.accentSoft }} className="w-10 h-10 rounded-full items-center justify-center mr-3">
        <Icon size={20} color={c.accent} />
      </View>
      <View className="flex-1 pr-4">
        <Text style={{ color: c.textPrimary }} className="font-semibold text-base mb-0.5">
          {title}
        </Text>
        <Text style={{ color: c.textSecondary }} className="text-xs leading-relaxed">
          {subtitle}
        </Text>
      </View>
      <ChevronRight size={20} color={c.textTertiary} />
    </Pressable>
  );
}
