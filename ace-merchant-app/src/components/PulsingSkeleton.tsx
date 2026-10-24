import React, { useEffect } from 'react';
import { View, StyleProp, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useColorScheme } from 'nativewind';
import { colors } from '../../theme';

interface PulsingSkeletonItemProps {
  width?: number | string;
  height?: number | string;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
  className?: string;
}

export function PulsingSkeletonItem({
  width = '100%',
  height = 20,
  borderRadius = 16,
  style,
  className,
}: PulsingSkeletonItemProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const c = isDark ? colors.dark : colors.light;

  const opacity = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.75, { duration: 850, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.3, { duration: 850, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        {
          width: width as any,
          height: height as any,
          borderRadius,
          backgroundColor: isDark ? '#23272F' : '#E2E8F0',
        },
        animatedStyle,
        style,
      ]}
      className={className}
    />
  );
}

/**
 * BentoGridSkeleton directly matches the high-end Xbox / App Store Bento loading pattern:
 * - Large Hero tile on left
 * - Top-right medium card + bottom-right dual micro cards
 * - Pagination pill indicators
 * - Secondary grid rows below
 */
export function BentoGridSkeleton() {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const c = isDark ? colors.dark : colors.light;

  return (
    <View style={{ backgroundColor: c.bg }} className="flex-1 px-5 pt-4">
      {/* Header bar skeleton */}
      <View className="flex-row justify-between items-center mb-4">
        <PulsingSkeletonItem width={140} height={28} borderRadius={14} />
        <PulsingSkeletonItem width={42} height={42} borderRadius={21} />
      </View>

      {/* Bento Main Grid Row */}
      <View className="flex-row mb-3" style={{ gap: 12 }}>
        {/* Large Hero Card (Left) */}
        <View style={{ flex: 1.25 }}>
          <PulsingSkeletonItem height={196} borderRadius={26} />
        </View>

        {/* Right Stack (Top medium + Bottom dual cards) */}
        <View style={{ flex: 1, gap: 10 }}>
          {/* Top Right Card (e.g. WhatsApp Companion) */}
          <PulsingSkeletonItem height={106} borderRadius={22} />
          {/* Bottom Dual Cards (e.g. AOCR + Oracle) */}
          <View className="flex-row" style={{ gap: 8 }}>
            <View style={{ flex: 1 }}>
              <PulsingSkeletonItem height={80} borderRadius={18} />
            </View>
            <View style={{ flex: 1 }}>
              <PulsingSkeletonItem height={80} borderRadius={18} />
            </View>
          </View>
        </View>
      </View>

      {/* Pagination indicators */}
      <View className="flex-row justify-center items-center my-3" style={{ gap: 6 }}>
        <PulsingSkeletonItem width={18} height={5} borderRadius={3} />
        <PulsingSkeletonItem width={6} height={5} borderRadius={3} />
        <PulsingSkeletonItem width={6} height={5} borderRadius={3} />
        <PulsingSkeletonItem width={6} height={5} borderRadius={3} />
      </View>

      {/* Section Header */}
      <View className="mb-3 mt-1">
        <PulsingSkeletonItem width={120} height={18} borderRadius={8} />
      </View>

      {/* Bottom Grid Rows */}
      <View className="flex-row mb-3" style={{ gap: 10 }}>
        <View style={{ flex: 1 }}>
          <PulsingSkeletonItem height={88} borderRadius={20} />
        </View>
        <View style={{ flex: 1 }}>
          <PulsingSkeletonItem height={88} borderRadius={20} />
        </View>
        <View style={{ flex: 1 }}>
          <PulsingSkeletonItem height={88} borderRadius={20} />
        </View>
        <View style={{ flex: 1 }}>
          <PulsingSkeletonItem height={88} borderRadius={20} />
        </View>
      </View>

      <View className="flex-row mb-3" style={{ gap: 10 }}>
        <View style={{ flex: 1 }}>
          <PulsingSkeletonItem height={88} borderRadius={20} />
        </View>
        <View style={{ flex: 1 }}>
          <PulsingSkeletonItem height={88} borderRadius={20} />
        </View>
        <View style={{ flex: 1 }}>
          <PulsingSkeletonItem height={88} borderRadius={20} />
        </View>
        <View style={{ flex: 1 }}>
          <PulsingSkeletonItem height={88} borderRadius={20} />
        </View>
      </View>
    </View>
  );
}

/**
 * ChatLoadSkeleton provides pulsating message bubbles for the chat detail loading state.
 * No spinners!
 */
export function ChatLoadSkeleton() {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const c = isDark ? colors.dark : colors.light;

  return (
    <View style={{ padding: 16, gap: 16 }}>
      {/* Customer bubble (left) */}
      <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-end' }}>
        <PulsingSkeletonItem width={34} height={34} borderRadius={17} />
        <PulsingSkeletonItem width='68%' height={52} borderRadius={18} />
      </View>
      {/* Vendor bubble (right) */}
      <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-end', justifyContent: 'flex-end' }}>
        <PulsingSkeletonItem width='55%' height={40} borderRadius={18} />
      </View>
      {/* Customer bubble (left) */}
      <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-end' }}>
        <PulsingSkeletonItem width={34} height={34} borderRadius={17} />
        <PulsingSkeletonItem width='75%' height={64} borderRadius={18} />
      </View>
      {/* Vendor bubble (right) */}
      <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-end', justifyContent: 'flex-end' }}>
        <PulsingSkeletonItem width='42%' height={40} borderRadius={18} />
      </View>
      {/* Customer bubble (left) */}
      <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-end' }}>
        <PulsingSkeletonItem width={34} height={34} borderRadius={17} />
        <PulsingSkeletonItem width='60%' height={44} borderRadius={18} />
      </View>
    </View>
  );
}

/**
 * NotificationSkeleton provides pulsating notification list rows for the notification-history screen.
 * No spinners!
 */
export function NotificationSkeleton({ count = 4 }: { count?: number }) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const c = isDark ? colors.dark : colors.light;

  return (
    <View style={{ gap: 12 }}>
      {Array.from({ length: count }).map((_, idx) => (
        <View
          key={idx}
          style={{
            backgroundColor: isDark ? '#1A1F1C' : '#FFFFFF',
            borderRadius: 16,
            padding: 16,
            gap: 10,
            borderWidth: 1,
            borderColor: c.border,
          }}
        >
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
            <PulsingSkeletonItem width={34} height={34} borderRadius={10} />
            <View style={{ flex: 1, gap: 6 }}>
              <PulsingSkeletonItem width={`${55 + (idx % 3) * 10}%`} height={14} borderRadius={7} />
              <PulsingSkeletonItem width='30%' height={11} borderRadius={5} />
            </View>
            <PulsingSkeletonItem width={70} height={20} borderRadius={6} />
          </View>
          <PulsingSkeletonItem width='90%' height={12} borderRadius={6} />
          <PulsingSkeletonItem width='75%' height={12} borderRadius={6} />
        </View>
      ))}
    </View>
  );
}

/**
 * InlineLoadingDots renders three animated pulsing dots for use inside
 * button press states where ActivityIndicator was previously used.
 * Keeps perceived latency low without a spinner.
 */
export function InlineLoadingDots({ color = '#FFFFFF', size = 6 }: { color?: string; size?: number }) {
  const op1 = useSharedValue(0.3);
  const op2 = useSharedValue(0.3);
  const op3 = useSharedValue(0.3);

  useEffect(() => {
    const delay = 220;
    op1.value = withRepeat(
      withSequence(withTiming(1, { duration: 350 }), withTiming(0.3, { duration: 350 })),
      -1,
      false
    );
    setTimeout(() => {
      op2.value = withRepeat(
        withSequence(withTiming(1, { duration: 350 }), withTiming(0.3, { duration: 350 })),
        -1,
        false
      );
    }, delay);
    setTimeout(() => {
      op3.value = withRepeat(
        withSequence(withTiming(1, { duration: 350 }), withTiming(0.3, { duration: 350 })),
        -1,
        false
      );
    }, delay * 2);
  }, []);

  const s1 = useAnimatedStyle(() => ({ opacity: op1.value }));
  const s2 = useAnimatedStyle(() => ({ opacity: op2.value }));
  const s3 = useAnimatedStyle(() => ({ opacity: op3.value }));

  const dot = {
    width: size,
    height: size,
    borderRadius: size / 2,
    backgroundColor: color,
    marginHorizontal: 2,
  };

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 20 }}>
      <Animated.View style={[dot, s1]} />
      <Animated.View style={[dot, s2]} />
      <Animated.View style={[dot, s3]} />
    </View>
  );
}

/**
 * SearchSkeleton provides smooth pulsating result rows for the Search tab.
 * No spinners!
 */
export function SearchSkeleton({ count = 5 }: { count?: number }) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const c = isDark ? colors.dark : colors.light;

  return (
    <View className="py-2">
      {Array.from({ length: count }).map((_, idx) => (
        <View
          key={idx}
          className="flex-row items-center py-4 border-b"
          style={{ borderBottomColor: c.border }}
        >
          {/* Avatar circle */}
          <PulsingSkeletonItem width={42} height={42} borderRadius={21} style={{ marginRight: 14 }} />

          {/* Text block */}
          <View className="flex-1" style={{ gap: 8 }}>
            <PulsingSkeletonItem width={`${65 + (idx % 3) * 10}%`} height={16} borderRadius={8} />
            <PulsingSkeletonItem width={`${40 + (idx % 2) * 15}%`} height={12} borderRadius={6} />
          </View>
        </View>
      ))}
    </View>
  );
}
