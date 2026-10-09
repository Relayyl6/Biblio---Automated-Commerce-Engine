import React from 'react';
import { View, Text, Pressable, Dimensions } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Check, X, Clock } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { colors } from '../../theme';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.4;

export type DraftType = 'restock' | 'winback' | 'tone_update' | 'pricing_override' | 'dispatch' | 'escalation_sms';

export interface DraftCardProps {
  id: string;
  type: DraftType;
  title: string;
  subtitle: string;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onSnooze?: (id: string) => void;
}

export function SwipeableDraftCard({ id, type, title, subtitle, onApprove, onReject, onSnooze }: DraftCardProps) {
  const { colorScheme } = useColorScheme();
  const c = colorScheme === 'dark' ? colors.dark : colors.light;

  const translateX = useSharedValue(0);

  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      translateX.value = event.translationX;
    })
    .onEnd(() => {
      if (translateX.value > SWIPE_THRESHOLD) {
        translateX.value = withSpring(SCREEN_WIDTH, {}, () => {
          runOnJS(onApprove)(id);
        });
      } else if (translateX.value < -SWIPE_THRESHOLD) {
        translateX.value = withSpring(-SCREEN_WIDTH, {}, () => {
          runOnJS(onReject)(id);
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
    if (translateX.value > 50) bgColor = c.successSoft;
    else if (translateX.value < -50) bgColor = c.dangerSoft;
    
    return {
      backgroundColor: bgColor,
    };
  });

  return (
    <View className="mb-4 relative rounded-[24px] overflow-hidden" style={{ minHeight: 100 }}>
      {/* Background action indicators */}
      <Animated.View style={[bgStyle]} className="absolute inset-0 flex-row items-center justify-between px-6 rounded-[24px]">
        <View className="flex-row items-center">
          <Check size={28} color={c.success} />
          <Text style={{ color: c.success }} className="ml-2 font-bold text-lg">Execute</Text>
        </View>
        <View className="flex-row items-center">
          <Text style={{ color: c.danger }} className="mr-2 font-bold text-lg">Discard</Text>
          <X size={28} color={c.danger} />
        </View>
      </Animated.View>

      <GestureDetector gesture={panGesture}>
        <Animated.View style={[animatedStyle, { backgroundColor: c.surface, borderColor: c.border }]} className="flex-1 p-5 border rounded-[24px] shadow-sm">
          <View className="flex-row justify-between items-start mb-2">
            <View 
              style={{ backgroundColor: c.accentSoft }}
              className="px-3 py-1 rounded-full"
            >
              <Text style={{ color: c.accent }} className="text-xs font-bold uppercase tracking-wider">
                {type.replace('_', ' ')}
              </Text>
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
          
          <Text style={{ color: c.textPrimary }} className="text-lg font-bold tracking-tight mb-1">{title}</Text>
          <Text style={{ color: c.textSecondary }} className="text-sm leading-relaxed">{subtitle}</Text>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}
