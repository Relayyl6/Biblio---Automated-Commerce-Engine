import React from 'react';
import { View, Text, Pressable, Dimensions } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Check, X, Clock } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { colors, radius, shadows } from '../../theme';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.4;

export type DraftType = 'restock' | 'winback' | 'tone_update' | 'pricing_override' | 'dispatch' | 'escalation_sms';

export interface DraftCardProps {
  id: string;
  type: DraftType;
  title: string;
  subtitle: string;
  status?: string;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onSnooze?: (id: string) => void;
}

/**
 * SwipeableDraftCard
 * Follows DESIGN.md Section 9.3 & 10.1:
 * Exception card: left 4px accent bar in review amber (c.review),
 * clear title and subtitle, with reversible swipe actions.
 */
export function SwipeableDraftCard({ id, type, title, subtitle, status, onApprove, onReject, onSnooze }: DraftCardProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const c = isDark ? colors.dark : colors.light;
  const [isDismissed, setIsDismissed] = React.useState(false);

  const translateX = useSharedValue(0);

  const handleApproveAction = () => {
    setIsDismissed(true);
    if (typeof onApprove === 'function') {
      onApprove(id);
    }
  };

  const handleRejectAction = () => {
    setIsDismissed(true);
    if (typeof onReject === 'function') {
      onReject(id);
    }
  };

  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      translateX.value = event.translationX;
    })
    .onEnd(() => {
      if (translateX.value > SWIPE_THRESHOLD) {
        translateX.value = withTiming(SCREEN_WIDTH * 1.5, { duration: 200 }, () => {
          runOnJS(handleApproveAction)();
        });
      } else if (translateX.value < -SWIPE_THRESHOLD) {
        translateX.value = withTiming(-SCREEN_WIDTH * 1.5, { duration: 200 }, () => {
          runOnJS(handleRejectAction)();
        });
      } else {
        translateX.value = withSpring(0);
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const bgStyle = useAnimatedStyle(() => {
    let bgColor = c.surfaceAlt;
    if (translateX.value > 50) bgColor = c.settledTint;
    else if (translateX.value < -50) bgColor = c.alertTint;

    return {
      backgroundColor: bgColor,
    };
  });

  if (isDismissed) return null;

  const displayType = String(type || 'Draft').replace(/_/g, ' ');

  return (
    <View className="mb-4 relative rounded-[24px] overflow-hidden" style={{ minHeight: 100 }}>
      {/* Background action indicators */}
      <Animated.View style={[bgStyle]} className="absolute inset-0 flex-row items-center justify-between px-4 rounded-[24px]">
        <View className="flex-row items-center">
          <Check size={28} color={c.settled} />
          <Text style={{ color: c.settled }} className="ml-2 font-bold text-lg">Execute</Text>
        </View>
        <View className="flex-row items-center">
          <Text style={{ color: c.alert }} className="mr-2 font-bold text-lg">Discard</Text>
          <X size={28} color={c.alert} />
        </View>
      </Animated.View>

      <GestureDetector gesture={panGesture}>
        <Animated.View
          style={[
            animatedStyle,
            {
              backgroundColor: c.surface,
              borderColor: c.border,
              borderLeftColor: c.review,
              borderLeftWidth: 4,
              borderRadius: radius.md,
              ...shadows.sm,
            },
          ]}
          className="flex-1 p-5 border"
        >
          <View className="flex-row justify-between items-start mb-2">
            <View className="flex-row items-center" style={{ gap: 6 }}>
              <View
                style={{ backgroundColor: c.accentSoft, borderRadius: radius.pill }}
                className="px-3 py-1"
              >
                <Text style={{ color: c.accent }} className="text-xs font-bold uppercase tracking-wider">
                  {displayType}
                </Text>
              </View>

              {status === 'snoozed' && (
                <View
                  style={{ backgroundColor: c.reviewTint, borderRadius: radius.pill }}
                  className="px-2.5 py-1 flex-row items-center"
                >
                  <Clock size={11} color={c.review} style={{ marginRight: 3 }} />
                  <Text style={{ color: c.review }} className="text-[10px] font-bold uppercase">
                    Snoozed
                  </Text>
                </View>
              )}
            </View>

            {onSnooze && (
              <Pressable
                onPress={() => onSnooze(id)}
                style={{ backgroundColor: c.surfaceAlt }}
                className="w-8 h-8 rounded-full items-center justify-center active:opacity-70"
              >
                <Clock size={14} color={c.textTertiary} />
              </Pressable>
            )}
          </View>

          <Text style={{ color: c.textPrimary }} className="text-lg font-bold tracking-tight mb-1">{title || 'Pending Decision'}</Text>
          <Text style={{ color: c.textSecondary }} className="text-sm leading-relaxed">{subtitle || ''}</Text>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}
