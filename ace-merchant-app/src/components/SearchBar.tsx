import React from 'react';
import { View, TextInput, Pressable } from 'react-native';
import { Search, X } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { colors, shadows } from '../../theme';

type Props = {
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  /** 'pill' (Search/Chats screens) vs 'inset' (CRM/Settings-style filled field) */
  variant?: 'pill' | 'inset';
};

/**
 * Search/Chats/CRM each hand-rolled this input with slightly different
 * radii and backgrounds. One component — the clear (×) button and focus
 * styling now behave the same everywhere it appears.
 */
export function SearchBar({ value, onChangeText, placeholder = 'Search...', autoFocus, variant = 'pill' }: Props) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const c = isDark ? colors.dark : colors.light;

  const isPill = variant === 'pill';

  return (
    <View
      style={{
        backgroundColor: isPill ? c.surface : isDark ? '#1F2937' : '#F1F5F9',
        borderColor: c.border,
        ...(isPill ? shadows.sm : {}),
      }}
      className={`flex-row items-center border px-4 h-12 ${isPill ? 'rounded-full' : 'rounded-xl'}`}
    >
      <Search size={18} color={c.textSecondary} />
      <TextInput
        autoFocus={autoFocus}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={c.textTertiary}
        style={{ color: c.textPrimary }}
        className="flex-1 ml-3 text-base"
      />
      {value.length > 0 && (
        <Pressable onPress={() => onChangeText('')} hitSlop={8} className="p-1 active:opacity-60">
          <X size={16} color={c.textTertiary} />
        </Pressable>
      )}
    </View>
  );
}
