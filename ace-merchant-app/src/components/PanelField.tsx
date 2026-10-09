import React, { useState } from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import { Eye, EyeOff } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { colors } from '../../theme';

type Props = {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  secure?: boolean;
  helper?: string;
};

/** Freeform labeled text field for panel content (API keys, addresses) —
 *  InputRow in SettingsRows.tsx is numeric-only, this one isn't, and it
 *  supports a show/hide toggle for secrets. */
export function PanelField({ label, value, onChangeText, placeholder, secure, helper }: Props) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const c = isDark ? colors.dark : colors.light;
  const [reveal, setReveal] = useState(false);

  return (
    <View className="mb-5">
      <Text style={{ color: c.textPrimary }} className="font-semibold text-sm mb-2">
        {label}
      </Text>
      <View style={{ backgroundColor: isDark ? '#1F2937' : '#F1F5F9', borderColor: c.border }} className="flex-row items-center border rounded-xl px-4 h-12">
        <TextInput
          style={{ color: c.textPrimary }}
          className="flex-1 text-base"
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={c.textTertiary}
          secureTextEntry={secure && !reveal}
          autoCapitalize="none"
          autoCorrect={false}
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
