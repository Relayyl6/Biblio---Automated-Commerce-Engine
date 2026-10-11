import React from 'react';
import { Modal, View, Text, Pressable } from 'react-native';
import { useColorScheme } from 'nativewind';
import { AlertTriangle } from 'lucide-react-native';
import Animated, { FadeIn, FadeOut, ZoomIn, ZoomOut } from 'react-native-reanimated';
import { colors, shadows } from '../../theme';

type Props = {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({ visible, title, message, confirmLabel = 'Confirm', destructive = true, onConfirm, onCancel }: Props) {
  const { colorScheme } = useColorScheme();
  const c = colorScheme === 'dark' ? colors.dark : colors.light;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onCancel}>
      <Animated.View
        entering={FadeIn.duration(150)}
        exiting={FadeOut.duration(120)}
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }}
        className="items-center justify-center px-8"
      >
        <Pressable style={{ position: 'absolute', inset: 0 } as any} onPress={onCancel} />
        <Animated.View
          entering={ZoomIn.duration(180).springify().damping(16)}
          exiting={ZoomOut.duration(120)}
          style={{ backgroundColor: c.surface, ...shadows.md }}
          className="w-full rounded-3xl p-6"
        >
          <View style={{ backgroundColor: destructive ? c.dangerSoft : c.accentSoft }} className="w-12 h-12 rounded-full items-center justify-center mb-4">
            <AlertTriangle size={22} color={destructive ? c.danger : c.accent} />
          </View>
          <Text style={{ color: c.textPrimary }} className="text-lg font-bold mb-2">
            {title}
          </Text>
          <Text style={{ color: c.textSecondary }} className="text-sm leading-relaxed mb-6">
            {message}
          </Text>
          <View className="flex-row" style={{ gap: 10 }}>
            <Pressable onPress={onCancel} style={{ backgroundColor: c.surfaceAlt }} className="flex-1 py-3 rounded-xl items-center active:opacity-70">
              <Text style={{ color: c.textPrimary }} className="font-bold text-sm">
                Cancel
              </Text>
            </Pressable>
            <Pressable
              onPress={onConfirm}
              style={{ backgroundColor: destructive ? c.danger : c.accent }}
              className="flex-1 py-3 rounded-xl items-center active:opacity-80"
            >
              <Text style={{ color: '#FFFFFF' }} className="font-bold text-sm">
                {confirmLabel}
              </Text>
            </Pressable>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}
