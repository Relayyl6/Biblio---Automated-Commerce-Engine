import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { colors } from '../../theme';

type Props = {
  title: string;
  subtitle?: string;
  /** Render as a bordered bar sitting flush at the top (Settings/CRM style)
   *  instead of floating over the background (Finance/Chats style). */
  variant?: 'bar' | 'floating';
  rightAction?: React.ReactNode;
  onBack?: () => void;
};

/**
 * Every subscreen (Settings, Finance, Chats, CRM, Search) reimplemented
 * "back arrow + title" slightly differently. One component now, so the
 * back-button hit target, spacing and typography stay identical everywhere.
 */
export function ScreenHeader({ title, subtitle, variant = 'floating', rightAction, onBack }: Props) {
  const router = useRouter();
  const { colorScheme } = useColorScheme();
  const c = colorScheme === 'dark' ? colors.dark : colors.light;

  const content = (
    <View className="flex-row items-center justify-between">
      <View className="flex-row items-center flex-1">
        <Pressable
          onPress={onBack ?? (() => router.back())}
          hitSlop={10}
          className="w-10 h-10 items-center justify-center -ml-2 mr-1 active:opacity-60"
        >
          <ArrowLeft size={24} color={c.textPrimary} />
        </Pressable>
        <View className="flex-1">
          <Text style={{ color: c.textPrimary }} className="text-2xl font-bold tracking-tight" numberOfLines={1}>
            {title}
          </Text>
          {subtitle && (
            <Text style={{ color: c.textSecondary }} className="text-xs mt-0.5">
              {subtitle}
            </Text>
          )}
        </View>
      </View>
      {rightAction}
    </View>
  );

  if (variant === 'bar') {
    return (
      <View style={{ backgroundColor: c.surface, borderBottomColor: c.border, borderBottomWidth: 1 }} className="pt-16 pb-4 px-6">
        {content}
      </View>
    );
  }

  return <View className="px-6 pt-16 mb-4">{content}</View>;
}
