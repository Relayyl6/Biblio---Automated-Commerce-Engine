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
  multiline?: boolean;
};

/** Freeform labeled text field for panel content (API keys, addresses, policies) —
 *  supports secret toggling as well as multiline text areas. */
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
        style={{ backgroundColor: isDark ? '#1F2937' : '#F1F5F9', borderColor: c.border }}
        className={`flex-row border rounded-xl px-4 ${multiline ? 'min-h-[88px] py-3 items-start' : 'h-12 items-center'}`}
      >
        <TextInput
          style={[{ color: c.textPrimary }, multiline ? { textAlignVertical: 'top' } : undefined]}
          className="flex-1 text-base"
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
