import React from 'react';
import { Modal, View, Text, Pressable } from 'react-native';
import { X } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeOut, SlideInRight, SlideOutRight } from 'react-native-reanimated';
import { colors, shadows } from '../../theme';

type Props = {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  /** Fraction of screen width the panel occupies. Default 0.86. */
  widthFraction?: number;
};

/**
 * Generic slide-in-from-right panel for secondary config (API keys, a
 * calibration slider, a webhook connection) that doesn't deserve a full
 * navigation stack — closing it returns you to Settings exactly as you
 * left it, with no back-stack entry to pop.
 *
 * Usage: hold one `activePanel: PanelKey | null` state value in the
 * parent screen, open each panel with a NavigationRow's onPress, and
 * render <SidePanel visible={activePanel === 'x'} onClose={...}>.
 */
export function SidePanel({ visible, onClose, title, subtitle, children, widthFraction = 0.86 }: Props) {
  const { colorScheme } = useColorScheme();
  const c = colorScheme === 'dark' ? colors.dark : colors.light;
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      {/* Backdrop — tap to dismiss */}
      <Animated.View
        entering={FadeIn.duration(200)}
        exiting={FadeOut.duration(150)}
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', flexDirection: 'row' }}
      >
        <Pressable style={{ flex: 1 }} onPress={onClose} />

        <Animated.View
          entering={SlideInRight.springify().damping(22).stiffness(220)}
          exiting={SlideOutRight.duration(200)}
          style={{
            width: `${widthFraction * 100}%`,
            backgroundColor: c.bg,
            paddingTop: insets.top + 16,
            paddingBottom: insets.bottom,
            ...shadows.md,
          }}
        >
          <View style={{ borderBottomColor: c.border }} className="px-5 pb-4 border-b flex-row items-start justify-between">
            <View className="flex-1 pr-3">
              <Text style={{ color: c.textPrimary }} className="text-xl font-bold tracking-tight">
                {title}
              </Text>
              {subtitle && (
                <Text style={{ color: c.textSecondary }} className="text-xs mt-1 leading-relaxed">
                  {subtitle}
                </Text>
              )}
            </View>
            <Pressable
              onPress={onClose}
              hitSlop={10}
              style={{ backgroundColor: c.surfaceAlt }}
              className="w-9 h-9 rounded-full items-center justify-center active:opacity-70"
            >
              <X size={18} color={c.textPrimary} />
            </Pressable>
          </View>

          <View className="flex-1 px-5 pt-5">{children}</View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}
