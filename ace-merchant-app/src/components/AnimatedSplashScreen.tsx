import React, { useEffect } from 'react';
import { View, Text, Image, StyleSheet, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withSequence,
  withRepeat,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { useColorScheme } from 'nativewind';
import { colors } from '../../theme';

interface AnimatedSplashScreenProps {
  onAnimationFinish?: () => void;
  isReady?: boolean;
}

export function AnimatedSplashScreen({ onAnimationFinish, isReady = false }: AnimatedSplashScreenProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const c = isDark ? colors.dark : colors.light;

  // Animation values
  const logoScale = useSharedValue(0.7);
  const logoOpacity = useSharedValue(0);
  const glowScale = useSharedValue(0.8);
  const glowOpacity = useSharedValue(0);
  const textOpacity = useSharedValue(0);
  const textTranslateY = useSharedValue(16);
  const footerOpacity = useSharedValue(0);
  const containerOpacity = useSharedValue(1);

  useEffect(() => {
    // 1. Entrance animation sequence
    logoOpacity.value = withTiming(1, { duration: 500, easing: Easing.out(Easing.cubic) });
    logoScale.value = withSpring(1, { damping: 11, stiffness: 100 });

    glowOpacity.value = withTiming(0.4, { duration: 600 });
    glowScale.value = withRepeat(
      withSequence(
        withTiming(1.2, { duration: 1400, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.9, { duration: 1400, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );

    // Text reveal with slight delay
    textOpacity.value = withTiming(1, { duration: 600 });
    textTranslateY.value = withSpring(0, { damping: 12, stiffness: 100 });

    // Footer reveal
    footerOpacity.value = withTiming(1, { duration: 800 });
  }, []);

  // When parent signals app is ready, gracefully exit
  useEffect(() => {
    if (isReady) {
      const timer = setTimeout(() => {
        containerOpacity.value = withTiming(
          0,
          { duration: 400, easing: Easing.inOut(Easing.ease) },
          (finished) => {
            if (finished && onAnimationFinish) {
              runOnJS(onAnimationFinish)();
            }
          }
        );
      }, 800); // Brief hold so user enjoys the silky entrance

      return () => clearTimeout(timer);
    }
  }, [isReady]);

  const animatedLogoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));

  const animatedGlowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
    transform: [{ scale: glowScale.value }],
  }));

  const animatedTextStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
    transform: [{ translateY: textTranslateY.value }],
  }));

  const animatedFooterStyle = useAnimatedStyle(() => ({
    opacity: footerOpacity.value,
  }));

  const animatedContainerStyle = useAnimatedStyle(() => ({
    opacity: containerOpacity.value,
  }));

  return (
    <Animated.View
      style={[
        StyleSheet.absoluteFill,
        { backgroundColor: isDark ? '#090A0C' : '#FFFFFF', zIndex: 99999 },
        animatedContainerStyle,
      ]}
      className="items-center justify-between py-16"
    >
      {/* Top Spacer */}
      <View className="h-6" />

      {/* Centered Brand Presentation */}
      <View className="items-center justify-center">
        {/* Ambient Halo Glow */}
        <Animated.View
          style={[
            {
              position: 'absolute',
              width: 180,
              height: 180,
              borderRadius: 90,
              backgroundColor: isDark ? '#059669' : '#10B981',
              opacity: 0.25,
            },
            animatedGlowStyle,
          ]}
        />

        {/* 3D Official Biblio Logo */}
        <Animated.View
          style={[
            {
              width: 104,
              height: 104,
              borderRadius: 28,
              backgroundColor: isDark ? '#111317' : '#F3F4F6',
              borderWidth: 1,
              borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
              shadowColor: '#10B981',
              shadowOffset: { width: 0, height: 12 },
              shadowOpacity: isDark ? 0.35 : 0.2,
              shadowRadius: 24,
              elevation: 12,
            },
            animatedLogoStyle,
          ]}
          className="items-center justify-center mb-6"
        >
          <Image
            source={require('../../assets/logo.png')}
            style={{ width: 76, height: 76 }}
            resizeMode="contain"
          />
        </Animated.View>

        {/* Brand Typography */}
        <Animated.View style={[animatedTextStyle]} className="items-center">
          <View className="flex-row items-center">
            <Text
              style={{ color: c.textPrimary }}
              className="text-3xl font-black tracking-tight"
            >
              Biblio
            </Text>
            <View className="w-2.5 h-2.5 rounded-full bg-emerald-500 ml-2 shadow-sm" />
          </View>

          <Text
            style={{ color: c.textSecondary }}
            className="text-sm font-semibold tracking-wide mt-1.5"
          >
            Autonomous Commerce Engine
          </Text>

          <View
            style={{
              backgroundColor: isDark ? 'rgba(16, 185, 129, 0.12)' : 'rgba(16, 185, 129, 0.08)',
              borderColor: isDark ? 'rgba(16, 185, 129, 0.25)' : 'rgba(16, 185, 129, 0.2)',
            }}
            className="border px-3 py-1 rounded-full mt-3 flex-row items-center"
          >
            <View className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-2" />
            <Text className="text-[11px] font-bold text-emerald-400 tracking-wider uppercase">
              Live-In Business Agent
            </Text>
          </View>
        </Animated.View>
      </View>

      {/* Footer Status & Enclave Beacon */}
      <Animated.View style={[animatedFooterStyle]} className="items-center">
        <View className="flex-row items-center mb-2">
          <View className="w-2 h-2 rounded-full bg-emerald-500 mr-2" />
          <Text
            style={{ color: c.textTertiary }}
            className="text-[11px] font-medium tracking-widest uppercase"
          >
            Initializing Enclave
          </Text>
        </View>

        <Text
          style={{ color: c.textTertiary }}
          className="text-[10px] font-mono opacity-60"
        >
          WhatsApp AI Agent • 24/7 Autopilot
        </Text>
      </Animated.View>
    </Animated.View>
  );
}
