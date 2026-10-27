import React, { useState } from 'react';
import { View, Text, Pressable, Dimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
  runOnJS,
} from 'react-native-reanimated';
import { Check, X, Clock, Sparkles, MessageCircle, ArrowRight, ShieldCheck, Tag } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useColorScheme } from 'nativewind';
import { colors, shadows } from '../../theme';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.35;

export interface TinderCardStackProps {
  cards: any[];
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onSnooze: (id: string) => void;
}

export function TinderCardStack({ cards, onApprove, onReject, onSnooze }: TinderCardStackProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const c = isDark ? colors.dark : colors.light;

  const topCard = cards[0];
  const nextCard = cards[1];

  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  const handleActionComplete = (action: 'approve' | 'reject') => {
    translateX.value = 0;
    translateY.value = 0;
    if (action === 'approve') {
      onApprove(topCard.id);
    } else {
      onReject(topCard.id);
    }
  };

  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      translateX.value = event.translationX;
      translateY.value = event.translationY * 0.3; // dampen vertical drag
    })
    .onEnd(() => {
      if (translateX.value > SWIPE_THRESHOLD) {
        runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Medium);
        translateX.value = withTiming(SCREEN_WIDTH * 1.4, { duration: 220 }, () => {
          runOnJS(handleActionComplete)('approve');
        });
      } else if (translateX.value < -SWIPE_THRESHOLD) {
        runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Medium);
        translateX.value = withTiming(-SCREEN_WIDTH * 1.4, { duration: 220 }, () => {
          runOnJS(handleActionComplete)('reject');
        });
      } else {
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
      }
    });

  const topCardStyle = useAnimatedStyle(() => {
    const rotate = interpolate(
      translateX.value,
      [-SCREEN_WIDTH * 0.8, 0, SCREEN_WIDTH * 0.8],
      [-14, 0, 14]
    );
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { rotate: `${rotate}deg` },
      ],
    };
  });

  const nextCardStyle = useAnimatedStyle(() => {
    const scale = interpolate(
      Math.abs(translateX.value),
      [0, SWIPE_THRESHOLD],
      [0.93, 1],
      'clamp'
    );
    const translateYNext = interpolate(
      Math.abs(translateX.value),
      [0, SWIPE_THRESHOLD],
      [16, 0],
      'clamp'
    );
    const opacity = interpolate(
      Math.abs(translateX.value),
      [0, SWIPE_THRESHOLD],
      [0.72, 1],
      'clamp'
    );
    return {
      transform: [{ scale }, { translateY: translateYNext }],
      opacity,
    };
  });

  const approveStampStyle = useAnimatedStyle(() => {
    const opacity = interpolate(translateX.value, [20, SWIPE_THRESHOLD * 0.7], [0, 1], 'clamp');
    return { opacity };
  });

  const rejectStampStyle = useAnimatedStyle(() => {
    const opacity = interpolate(translateX.value, [-SWIPE_THRESHOLD * 0.7, -20], [1, 0], 'clamp');
    return { opacity };
  });

  const triggerSwipeRight = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    translateX.value = withTiming(SCREEN_WIDTH * 1.4, { duration: 240 }, () => {
      runOnJS(handleActionComplete)('approve');
    });
  };

  const triggerSwipeLeft = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    translateX.value = withTiming(-SCREEN_WIDTH * 1.4, { duration: 240 }, () => {
      runOnJS(handleActionComplete)('reject');
    });
  };

  if (!topCard) return null;

  return (
    <View className="flex-1 justify-between px-2 pt-1 pb-4">
      {/* Stack Deck Area */}
      <View className="relative w-full" style={{ minHeight: 390, justifyContent: 'center' }}>
        {/* Next Card in Stack (Preview Underneath) */}
        {nextCard && (
          <Animated.View
            style={[
              nextCardStyle,
              {
                backgroundColor: c.surface,
                borderColor: c.border,
                ...shadows.sm,
              },
            ]}
            className="absolute inset-x-2 top-0 p-5 rounded-[30px] border"
          >
            <View className="flex-row justify-between items-center mb-3">
              <View
                style={{ backgroundColor: c.accentSoft }}
                className="px-3 py-1 rounded-full flex-row items-center"
              >
                <Text style={{ color: c.accent }} className="text-[11px] font-bold uppercase tracking-wider">
                  {(nextCard.type || 'Draft').replace('_', ' ')}
                </Text>
              </View>
              <Text style={{ color: c.textTertiary }} className="text-xs font-semibold">
                Up Next
              </Text>
            </View>

            <Text style={{ color: c.textPrimary }} className="text-xl font-bold tracking-tight mb-2" numberOfLines={2}>
              {nextCard.title || 'Pending AI Draft'}
            </Text>
            <Text style={{ color: c.textSecondary }} className="text-sm leading-relaxed mb-4" numberOfLines={4}>
              {nextCard.subtitle || nextCard.message_draft || 'AI synthesized recommendation ready for review.'}
            </Text>

            <View style={{ backgroundColor: c.surfaceAlt }} className="p-3.5 rounded-2xl flex-row items-center">
              <Sparkles size={16} color={c.accent} />
              <Text style={{ color: c.textSecondary }} className="text-xs ml-2 flex-1" numberOfLines={1}>
                {nextCard.proposed_discount_percent ? `${nextCard.proposed_discount_percent}% loyalty discount` : 'Autonomous agent queue'}
              </Text>
            </View>
          </Animated.View>
        )}

        {/* Top Active Card */}
        <GestureDetector gesture={panGesture}>
          <Animated.View
            style={[
              topCardStyle,
              {
                backgroundColor: c.surface,
                borderColor: c.border,
                ...shadows.md,
                zIndex: 10,
              },
            ]}
            className="w-full p-5 rounded-[30px] border relative overflow-hidden"
          >
            {/* Stamp Overlays */}
            <Animated.View
              style={[
                approveStampStyle,
                { borderColor: '#22C55E', backgroundColor: '#22C55E1A' },
              ]}
              className="absolute top-6 left-6 border-2 px-3.5 py-1.5 rounded-xl z-20 flex-row items-center"
            >
              <Check size={18} color="#22C55E" />
              <Text style={{ color: '#22C55E' }} className="font-black text-sm uppercase ml-1.5 tracking-wider">
                EXECUTE
              </Text>
            </Animated.View>

            <Animated.View
              style={[
                rejectStampStyle,
                { borderColor: '#EF4444', backgroundColor: '#EF44441A' },
              ]}
              className="absolute top-6 right-6 border-2 px-3.5 py-1.5 rounded-xl z-20 flex-row items-center"
            >
              <X size={18} color="#EF4444" />
              <Text style={{ color: '#EF4444' }} className="font-black text-sm uppercase ml-1.5 tracking-wider">
                DISCARD
              </Text>
            </Animated.View>

            {/* Header info */}
            <View className="flex-row justify-between items-center mb-3">
              <View
                style={{ backgroundColor: c.accentSoft }}
                className="px-3.5 py-1 rounded-full flex-row items-center"
              >
                <Tag size={12} color={c.accent} style={{ marginRight: 5 }} />
                <Text style={{ color: c.accent }} className="text-xs font-bold uppercase tracking-wider">
                  {(topCard.type || 'Draft').replace('_', ' ')}
                </Text>
              </View>

              <Pressable
                onPress={() => onSnooze(topCard.id)}
                hitSlop={8}
                style={{ backgroundColor: c.surfaceAlt }}
                className="px-2.5 py-1 rounded-full flex-row items-center active:opacity-70"
              >
                <Clock size={12} color={c.textTertiary} style={{ marginRight: 4 }} />
                <Text style={{ color: c.textTertiary }} className="text-xs font-medium">
                  Snooze
                </Text>
              </Pressable>
            </View>

            {/* Title & context */}
            <Text style={{ color: c.textPrimary }} className="text-xl font-bold tracking-tight mb-2">
              {topCard.title}
            </Text>

            <Text style={{ color: c.textSecondary }} className="text-sm leading-relaxed mb-4">
              {topCard.subtitle}
            </Text>

            {/* Simulated WhatsApp draft speech bubble */}
            <View
              style={{
                backgroundColor: isDark ? '#1F2937' : '#F1F5F9',
                borderColor: c.border,
              }}
              className="p-4 rounded-2xl border mb-3"
            >
              <View className="flex-row items-center justify-between mb-1.5">
                <View className="flex-row items-center">
                  <MessageCircle size={14} color="#22C55E" />
                  <Text style={{ color: '#22C55E' }} className="text-[11px] font-bold uppercase ml-1.5 tracking-wider">
                    WhatsApp Message Draft
                  </Text>
                </View>
                <ShieldCheck size={14} color={c.textTertiary} />
              </View>
              <Text style={{ color: c.textPrimary }} className="text-xs leading-relaxed italic">
                "{topCard.subtitle || 'Automated customer dispatch ready.'}"
              </Text>
            </View>

            {/* Hint / Helper */}
            <View className="flex-row items-center justify-between pt-1">
              <Text style={{ color: c.textTertiary }} className="text-[11px]">
                Swipe right to approve • Swipe left to reject
              </Text>
              <View style={{ backgroundColor: c.surfaceAlt }} className="px-2 py-0.5 rounded-md">
                <Text style={{ color: c.textSecondary }} className="text-[10px] font-bold uppercase">
                  AI Generated
                </Text>
              </View>
            </View>
          </Animated.View>
        </GestureDetector>
      </View>

      {/* Floating Action Controls */}
      <View className="items-center mt-3">
        <View className="flex-row items-center justify-center gap-6 mb-2">
          {/* Reject button */}
          <Pressable
            onPress={triggerSwipeLeft}
            hitSlop={8}
            style={{
              backgroundColor: '#EF444418',
              borderColor: '#EF444455',
              width: 58,
              height: 58,
              borderRadius: 29,
              ...shadows.sm,
            }}
            className="items-center justify-center border active:opacity-75"
          >
            <X size={26} color="#EF4444" />
          </Pressable>

          {/* Snooze button */}
          <Pressable
            onPress={() => onSnooze(topCard.id)}
            hitSlop={8}
            style={{
              backgroundColor: c.surfaceAlt,
              borderColor: c.border,
              width: 46,
              height: 46,
              borderRadius: 23,
            }}
            className="items-center justify-center border active:opacity-75"
          >
            <Clock size={20} color={c.textSecondary} />
          </Pressable>

          {/* Approve button */}
          <Pressable
            onPress={triggerSwipeRight}
            hitSlop={8}
            style={{
              backgroundColor: '#22C55E18',
              borderColor: '#22C55E55',
              width: 58,
              height: 58,
              borderRadius: 29,
              ...shadows.sm,
            }}
            className="items-center justify-center border active:opacity-75"
          >
            <Check size={26} color="#22C55E" />
          </Pressable>
        </View>

        {/* Counter */}
        <Text style={{ color: c.textTertiary }} className="text-xs font-semibold">
          1 of {cards.length} pending drafts
        </Text>
      </View>
    </View>
  );
}
