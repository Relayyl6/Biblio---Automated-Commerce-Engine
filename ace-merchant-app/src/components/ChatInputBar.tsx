import React from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import { Send, Lock, Hand } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { colors } from '../../theme';
import { InlineLoadingDots } from './PulsingSkeleton';

type Props = {
  isHumanOverride: boolean;
  value: string;
  onChangeText: (t: string) => void;
  onSend: () => void;
  isSending: boolean;
  onRequestTakeover: () => void;
  isTakingOver: boolean;
};

export function ChatInputBar({ isHumanOverride, value, onChangeText, onSend, isSending, onRequestTakeover, isTakingOver }: Props) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const c = isDark ? colors.dark : colors.light;

  if (!isHumanOverride) {
    return (
      <Animated.View
        entering={FadeInUp.springify()}
        style={{ backgroundColor: c.surface, borderTopColor: c.border }}
        className="p-4 border-t flex-row items-center"
      >
        <View style={{ backgroundColor: c.surfaceAlt }} className="flex-1 flex-row items-center h-12 rounded-full px-4">
          <Lock size={14} color={c.textTertiary} />
          <Text style={{ color: c.textTertiary }} className="text-sm ml-2">
            Biblo AI is handling this chat
          </Text>
        </View>
        <Pressable
          onPress={onRequestTakeover}
          disabled={isTakingOver}
          style={{ backgroundColor: c.dangerSoft }}
          className="ml-3 px-4 h-12 rounded-full flex-row items-center active:opacity-70"
        >
          {isTakingOver ? (
            <InlineLoadingDots color={c.danger} />
          ) : (
            <>
              <Hand size={14} color={c.danger} />
              <Text style={{ color: c.danger }} className="font-bold text-xs ml-1.5">
                Take Over
              </Text>
            </>
          )}
        </Pressable>
      </Animated.View>
    );
  }

  const canSend = value.trim().length > 0 && !isSending;

  return (
    <Animated.View
      entering={FadeInUp.springify()}
      style={{ backgroundColor: c.surface, borderTopColor: c.border }}
      className="p-4 border-t flex-row items-center"
    >
      <View style={{ backgroundColor: c.bg, borderColor: c.border }} className="flex-1 border rounded-full px-4 h-12 justify-center">
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder="Type a message..."
          placeholderTextColor={c.textTertiary}
          style={{ color: c.textPrimary }}
          className="text-base"
          multiline
          maxLength={1000}
        />
      </View>
      <Pressable
        onPress={onSend}
        disabled={!canSend}
        style={{ backgroundColor: canSend ? c.accent : c.surfaceAlt }}
        className="ml-3 w-12 h-12 rounded-full items-center justify-center active:opacity-80"
      >
        {isSending ? (
          <InlineLoadingDots color={isDark ? '#090A0C' : '#FFFFFF'} size={5} />
        ) : (
          <Send size={19} color={canSend ? (isDark ? '#090A0C' : '#FFFFFF') : c.textTertiary} />
        )}
      </Pressable>
    </Animated.View>
  );
}
