import React, { useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  StatusBar,
  Dimensions,
  StyleSheet,
  BackHandler,
  Modal,
  ScrollView,
} from 'react-native';
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
  /** Fraction of screen width the panel occupies. Default 0.88. */
  widthFraction?: number;
};

/**
 * Slide-in drawer panel for secondary configuration & forms.
 * Rendered using a statusBarTranslucent Modal to ensure 100% full-screen coverage
 * from the absolute top to the absolute bottom of the device, eliminating any
 * cutoffs or raised bottom flaws on Android and iOS.
 */
export function SidePanel({
  visible,
  onClose,
  title,
  subtitle,
  children,
  widthFraction = 0.88,
}: Props) {
  const { colorScheme } = useColorScheme();
  const c = colorScheme === 'dark' ? colors.dark : colors.light;
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!visible) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [visible, onClose]);

  if (!visible) return null;

  const panelWidth = Math.min(Dimensions.get('window').width * widthFraction, 420);
  const topInset = Math.max(insets.top, StatusBar.currentHeight || 0);

  return (
    <Modal
      visible={visible}
      transparent
      statusBarTranslucent
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={StyleSheet.absoluteFill}>
        {/* Backdrop — tap to dismiss */}
        <Animated.View
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(150)}
          style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.55)' }]}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>

        {/* Full-height Drawer Panel */}
        <Animated.View
          entering={SlideInRight.duration(260)}
          exiting={SlideOutRight.duration(200)}
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            right: 0,
            height: '100%',
            width: panelWidth,
            backgroundColor: c.bg,
            paddingTop: topInset + 12,
            ...shadows.md,
          }}
        >
          {/* Header */}
          <View
            style={{ borderBottomColor: c.border, borderBottomWidth: 1 }}
            className="px-5 pb-4 flex-row items-start justify-between"
          >
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

          {/* Scrollable Panel Content */}
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{
              paddingHorizontal: 20,
              paddingTop: 16,
              paddingBottom: Math.max(insets.bottom, 24) + 24,
            }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}
