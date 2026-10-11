import React, { useEffect } from 'react';
import { View } from 'react-native';
import { useColorScheme } from 'nativewind';
import Animated, { FadeIn, FadeOut, useSharedValue, useAnimatedStyle, withRepeat, withSequence, withTiming, withDelay } from 'react-native-reanimated';
import { colors } from '../../theme';

function Dot({ delay, color }: { delay: number; color: string }) {
  const opacity = useSharedValue(0.3);
  useEffect(() => {
    opacity.value = withDelay(delay, withRepeat(withSequence(withTiming(1, { duration: 350 }), withTiming(0.3, { duration: 350 })), -1, true));
  }, []);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View style={[style, { width: 6, height: 6, borderRadius: 3, backgroundColor: color, marginHorizontal: 2 }]} />;
}

export function TypingIndicator({ label = 'Biblo AI is typing' }: { label?: string }) {
  const { colorScheme } = useColorScheme();
  const c = colorScheme === 'dark' ? colors.dark : colors.light;

  return (
    <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(150)} style={{ alignSelf: 'flex-start' }} className="mb-3">
      <View style={{ backgroundColor: c.accentSoft }} className="flex-row items-center px-4 py-3 rounded-2xl" >
        <Dot delay={0} color={c.accent} />
        <Dot delay={150} color={c.accent} />
        <Dot delay={300} color={c.accent} />
      </View>
    </Animated.View>
  );
}
