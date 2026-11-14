import React, { useState } from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import { Eye, EyeOff } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { colors, radius } from '../../theme';

type Props = {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  secure?: boolean;
  helper?: string;
  multiline?: boolean;
};

/**
 * Freeform labeled text field for panel content (API keys, addresses, policies)
 * Strictly follows DESIGN.md Section 9.5:
 * Height 52px, radius-sm, wellBg fill, clean border.
 */
export function PanelField({ label, value, onChangeText, placeholder, secure, helper, multiline }: Props) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const c = isDark ? colors.dark : colors.light;
  const [reveal, setReveal] = useState(false);

  return (
    <View className="mb-5">
      <Text style={{ color: c.textPrimary }} className="font-semibold text-sm mb-2">
        {label}
      </Text>
      <View
        style={{
          backgroundColor: c.wellBg,
          borderColor: c.border,
          borderRadius: radius.sm,
        }}
        className={`flex-row border px-4 ${multiline ? 'min-h-[88px] py-3 items-start' : 'h-[52px] items-center'}`}
      >
        <TextInput
          style={[{ color: c.textPrimary }, multiline ? { textAlignVertical: 'top' } : undefined]}
          className="flex-1 text-base font-medium"
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={c.textTertiary}
          secureTextEntry={secure && !reveal}
          autoCapitalize="none"
          autoCorrect={false}
          multiline={multiline}
        />
        {secure && (
          <Pressable onPress={() => setReveal(r => !r)} hitSlop={8}>
            {reveal ? <EyeOff size={18} color={c.textTertiary} /> : <Eye size={18} color={c.textTertiary} />}
          </Pressable>
        )}
      </View>
      {helper && (
        <Text style={{ color: c.textTertiary }} className="text-xs mt-1.5 leading-relaxed">
          {helper}
        </Text>
      )}
    </View>
  );
}
