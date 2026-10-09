import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useColorScheme } from 'nativewind';
import { colors } from '../../theme';

/** Full-screen loading state (Finance/Pulse both hand-rolled this). */
export function LoadingScreen() {
  const { colorScheme } = useColorScheme();
  const c = colorScheme === 'dark' ? colors.dark : colors.light;
  return (
    <View style={{ backgroundColor: c.bg }} className="flex-1 items-center justify-center">
      <ActivityIndicator size="large" color={c.accent} />
    </View>
  );
}
