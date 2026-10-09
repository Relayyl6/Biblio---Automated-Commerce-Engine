import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useColorScheme } from 'nativewind';
import { colors } from '../../theme';

/** Used for the Tone & Dialect calibration panel's pidgin-ratio picker,
 *  reusable anywhere a small fixed set of options beats a Switch. */
export function SegmentedControl({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  const { colorScheme } = useColorScheme();
  const c = colorScheme === 'dark' ? colors.dark : colors.light;

  return (
    <View style={{ backgroundColor: c.surfaceAlt, borderColor: c.border }} className="flex-row p-1 rounded-xl border">
      {options.map(opt => {
        const active = opt === value;
        return (
          <Pressable
            key={opt}
            onPress={() => onChange(opt)}
            style={{ backgroundColor: active ? c.accent : 'transparent' }}
            className="flex-1 py-2 rounded-lg items-center active:opacity-80"
          >
            <Text
              style={{ color: active ? (colorScheme === 'dark' ? '#090A0C' : '#FFFFFF') : c.textSecondary }}
              className="text-xs font-bold"
            >
              {opt}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
