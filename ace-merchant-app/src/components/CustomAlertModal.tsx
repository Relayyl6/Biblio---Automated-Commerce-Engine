import React, { useEffect } from 'react';
import { Modal, View, Text, Pressable, ScrollView, Dimensions } from 'react-native';
import { useColorScheme } from 'nativewind';
import {
  AlertTriangle,
  Info,
  CheckCircle2,
  Trash2,
  Archive,
  HelpCircle,
  X,
} from 'lucide-react-native';
import Animated, { FadeIn, FadeOut, ZoomIn, ZoomOut } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { colors, shadows } from '../../theme';

export type AlertVariant = 'info' | 'success' | 'warning' | 'danger' | 'soft-delete' | 'neutral';

export type ActionButtonVariant =
  | 'primary'
  | 'destructive'
  | 'soft-delete'
  | 'outline'
  | 'cancel'
  | 'subtle';

export interface AlertAction {
  label: string;
  onPress?: () => void | Promise<void>;
  variant?: ActionButtonVariant;
  icon?: React.ReactNode;
  autoClose?: boolean; // defaults to true
  disabled?: boolean;
}

export interface CustomAlertModalProps {
  visible: boolean;
  title: string;
  message?: string;
  variant?: AlertVariant;
  icon?: React.ReactNode;
  badge?: string;
  itemName?: string;
  actions?: AlertAction[];
  children?: React.ReactNode;
  onClose: () => void;
  dismissible?: boolean;
  buttonLayout?: 'row' | 'column' | 'auto';
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export function CustomAlertModal({
  visible,
  title,
  message,
  variant = 'warning',
  icon,
  badge,
  itemName,
  actions = [],
  children,
  onClose,
  dismissible = true,
  buttonLayout = 'auto',
}: CustomAlertModalProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const c = isDark ? colors.dark : colors.light;

  // Trigger haptic feedback when modal opens
  useEffect(() => {
    if (visible) {
      if (variant === 'danger') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      } else if (variant === 'warning' || variant === 'soft-delete') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      } else if (variant === 'success') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      } else {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }
    }
  }, [visible, variant]);

  if (!visible) return null;

  // Theme palettes based on variant
  const getVariantStyles = () => {
    switch (variant) {
      case 'danger':
        return {
          bgSoft: c.dangerSoft,
          color: c.danger,
          defaultIcon: <Trash2 size={22} color={c.danger} />,
        };
      case 'success':
        return {
          bgSoft: c.successSoft,
          color: c.success,
          defaultIcon: <CheckCircle2 size={22} color={c.success} />,
        };
      case 'info':
        return {
          bgSoft: isDark ? 'rgba(59, 130, 246, 0.15)' : 'rgba(59, 130, 246, 0.1)',
          color: '#3B82F6',
          defaultIcon: <Info size={22} color="#3B82F6" />,
        };
      case 'soft-delete':
        return {
          bgSoft: isDark ? 'rgba(139, 92, 246, 0.15)' : 'rgba(139, 92, 246, 0.1)',
          color: '#8B5CF6',
          defaultIcon: <Archive size={22} color="#8B5CF6" />,
        };
      case 'neutral':
        return {
          bgSoft: c.surfaceAlt,
          color: c.textSecondary,
          defaultIcon: <HelpCircle size={22} color={c.textSecondary} />,
        };
      case 'warning':
      default:
        return {
          bgSoft: c.warningSoft,
          color: c.warning,
          defaultIcon: <AlertTriangle size={22} color={c.warning} />,
        };
    }
  };

  const vStyles = getVariantStyles();

  // If no actions provided, provide default "OK"
  const resolvedActions: AlertAction[] =
    actions.length > 0
      ? actions
      : [
          {
            label: 'OK',
            variant: 'primary',
            onPress: onClose,
          },
        ];

  // Determine button layout: if > 2 buttons or long labels, default to column
  const isColumnLayout =
    buttonLayout === 'column' ||
    (buttonLayout === 'auto' && (resolvedActions.length > 2 || resolvedActions.some(a => a.label.length > 14)));

  const handleActionPress = async (action: AlertAction) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    if (action.autoClose !== false) {
      onClose();
    }
    if (action.onPress) {
      await action.onPress();
    }
  };

  const getButtonStyles = (bVariant: ActionButtonVariant = 'primary') => {
    switch (bVariant) {
      case 'destructive':
        return {
          bg: c.danger,
          text: '#FFFFFF',
          border: 'transparent',
        };
      case 'soft-delete':
        return {
          bg: isDark ? 'rgba(139, 92, 246, 0.22)' : 'rgba(139, 92, 246, 0.12)',
          text: isDark ? '#A78BFA' : '#7C3AED',
          border: isDark ? '#8B5CF6' : 'rgba(139, 92, 246, 0.3)',
        };
      case 'cancel':
        return {
          bg: c.surfaceAlt,
          text: c.textPrimary,
          border: 'transparent',
        };
      case 'outline':
        return {
          bg: 'transparent',
          text: c.textPrimary,
          border: c.border,
        };
      case 'subtle':
        return {
          bg: 'transparent',
          text: c.textSecondary,
          border: 'transparent',
        };
      case 'primary':
      default:
        return {
          bg: c.accent,
          text: isDark ? '#090A0C' : '#FFFFFF',
          border: 'transparent',
        };
    }
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={dismissible ? onClose : undefined}>
      <Animated.View
        entering={FadeIn.duration(150)}
        exiting={FadeOut.duration(120)}
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.65)' }}
        className="items-center justify-center px-6"
      >
        {dismissible && (
          <Pressable
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            onPress={onClose}
          />
        )}

        <Animated.View
          entering={ZoomIn.duration(3).springify().damping(100)}
          exiting={ZoomOut.duration(2).springify().damping(100)}
          style={{
            backgroundColor: c.surface,
            borderColor: c.border,
            maxHeight: SCREEN_HEIGHT * 0.85,
            ...shadows.md,
          }}
          className="w-full rounded-3xl p-6 border"
        >
          {/* Header Bar with Icon and Optional Badge */}
          <View className="flex-row items-start justify-between mb-3">
            <View
              style={{ backgroundColor: vStyles.bgSoft }}
              className="w-12 h-12 rounded-2xl items-center justify-center"
            >
              {icon || vStyles.defaultIcon}
            </View>

            <View className="flex-row items-center" style={{ gap: 8 }}>
              {badge && (
                <View
                  style={{
                    backgroundColor: vStyles.bgSoft,
                    borderColor: vStyles.color,
                  }}
                  className="px-2.5 py-1 rounded-full border"
                >
                  <Text style={{ color: vStyles.color }} className="text-[11px] font-bold uppercase tracking-wider">
                    {badge}
                  </Text>
                </View>
              )}

              {dismissible && (
                <Pressable
                  onPress={onClose}
                  hitSlop={10}
                  className="p-1 rounded-full active:opacity-60"
                  style={{ backgroundColor: c.surfaceAlt }}
                >
                  <X size={16} color={c.textTertiary} />
                </Pressable>
              )}
            </View>
          </View>

          {/* Title & Message */}
          <Text style={{ color: c.textPrimary }} className="text-lg font-extrabold mb-1.5">
            {title}
          </Text>

          {message && (
            <Text style={{ color: c.textSecondary }} className="text-sm leading-relaxed mb-3">
              {message}
            </Text>
          )}

          {/* Optional Item Name Chip (e.g. for Soft Delete of a specific product or order) */}
          {itemName && (
            <View
              style={{ backgroundColor: c.surfaceAlt, borderColor: c.border }}
              className="px-3.5 py-2 rounded-xl border mb-3 flex-row items-center"
            >
              <Text style={{ color: c.textTertiary }} className="text-xs font-semibold mr-1.5">
                Target:
              </Text>
              <Text style={{ color: c.textPrimary }} className="text-xs font-bold flex-1" numberOfLines={1}>
                {itemName}
              </Text>
            </View>
          )}

          {/* Injected Children Content */}
          {children && <View className="mb-4">{children}</View>}

          {/* Action Buttons */}
          <View
            className={isColumnLayout ? 'flex-col' : 'flex-row'}
            style={{ gap: 9, marginTop: 10 }}
          >
            {resolvedActions.map((action, idx) => {
              const bStyle = getButtonStyles(action.variant);
              return (
                <Pressable
                  key={`${action.label}-${idx}`}
                  onPress={() => handleActionPress(action)}
                  disabled={action.disabled}
                  style={{
                    backgroundColor: bStyle.bg,
                    borderColor: bStyle.border,
                    borderWidth: bStyle.border !== 'transparent' ? 1 : 0,
                    opacity: action.disabled ? 0.5 : 1,
                  }}
                  className={`py-3.5 px-4 rounded-xl items-center justify-center flex-row active:opacity-80 ${
                    !isColumnLayout ? 'flex-1' : 'w-full'
                  }`}
                >
                  {action.icon && <View className="mr-2">{action.icon}</View>}
                  <Text style={{ color: bStyle.text }} className="font-bold text-sm text-center">
                    {action.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}
