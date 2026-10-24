import React from 'react';
import { View } from 'react-native';
import { useColorScheme } from 'nativewind';
import { colors } from '../../theme';
import { BentoGridSkeleton } from './PulsingSkeleton';

/** Full-screen loading state rendering a modern pulsating Bento Grid skeleton instead of a spinner. */
export function LoadingScreen() {
  const { colorScheme } = useColorScheme();
  const c = colorScheme === 'dark' ? colors.dark : colors.light;
  return (
    <View style={{ backgroundColor: c.bg }} className="flex-1">
      <BentoGridSkeleton />
    </View>
  );
}
