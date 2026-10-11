import React from 'react';
import { View, Text } from 'react-native';
import { useColorScheme } from 'nativewind';
import { colors } from '../../theme';

type Props = {
  name: string;
  size?: number;
  online?: boolean;
};

const PALETTE = ['#2563EB', '#8B5CF6', '#10B981', '#F59E0B', '#EC4899', '#0EA5E9'];

function colorForName(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

export function Avatar({ name, size = 44, online }: Props) {
  const { colorScheme } = useColorScheme();
  const c = colorScheme === 'dark' ? colors.dark : colors.light;
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase())
    .join('') || '?';
  const tint = colorForName(name || '?');

  return (
    <View style={{ width: size, height: size }}>
      <View
        style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: tint + '26' }}
        className="items-center justify-center"
      >
        <Text style={{ color: tint, fontSize: size * 0.38 }} className="font-bold">
          {initials}
        </Text>
      </View>
      {online !== undefined && (
        <View
          style={{
            position: 'absolute',
            bottom: 0,
            right: 0,
            width: size * 0.3,
            height: size * 0.3,
            borderRadius: size * 0.15,
            backgroundColor: online ? c.success : c.textTertiary,
            borderWidth: 2,
            borderColor: c.bg,
          }}
        />
      )}
    </View>
  );
}
