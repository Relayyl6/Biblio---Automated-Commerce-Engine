import React from 'react';
import { View, Text } from 'react-native';
import { Check, CheckCheck, Clock, AlertCircle, Sparkles, User } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { colors } from '../../theme';

export type MessageSender = 'customer' | 'ai' | 'human';
export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'failed';

export type ChatMessage = {
  id: string;
  sender: MessageSender;
  text: string;
  time: string;
  status?: MessageStatus;
};

function StatusIcon({ status, color }: { status?: MessageStatus; color: string }) {
  if (status === 'sending') return <Clock size={11} color={color} />;
  if (status === 'failed') return <AlertCircle size={11} color="#C8322B" />;
  if (status === 'read') return <CheckCheck size={11} color={color} />;
  if (status === 'delivered' || status === 'sent') return <Check size={11} color={color} />;
  return null;
}

/**
 * MessageBubble
 * Follows DESIGN.md Section 9.4:
 * - Customer messages: paper-0 on paper background, aligned left.
 * - Merchant messages: ink-950 background with white text, aligned right.
 * - ACE messages: signal-50 tint with sparkle mark and "ACE" label.
 * - Max bubble width: 78% of screen width.
 */
export function MessageBubble({ message, index, isDraft = false }: { message: ChatMessage; index: number; isDraft?: boolean }) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const c = isDark ? colors.dark : colors.light;
  const { sender, text, time, status } = message;

  const isCustomer = sender === 'customer';
  const isAI = sender === 'ai';

  // Background and text colours strictly per DESIGN.md Section 9.4
  let bubbleBg = isDark ? c.surfaceAlt : c.textPrimary; // Merchant: ink-950
  let bubbleTextColor = '#FFFFFF';
  let borderColor = 'transparent';

  if (isDraft) {
    bubbleBg = c.accentTint;
    bubbleTextColor = c.textPrimary;
    borderColor = c.border;
  } else if (isCustomer) {
    bubbleBg = c.surface; // paper-0
    bubbleTextColor = c.textPrimary;
    borderColor = c.border;
  } else if (isAI) {
    bubbleBg = c.signalTint; // signal-50
    bubbleTextColor = isDark ? '#E9F0FD' : '#1E3A8A';
    borderColor = isDark ? 'rgba(106,157,255,0.2)' : 'rgba(47,111,219,0.15)';
  }

  return (
    <Animated.View
      entering={FadeInUp.delay(Math.min(index * 30, 300)).duration(250).springify()}
      style={{
        alignSelf: isCustomer ? 'flex-start' : 'flex-end',
        maxWidth: '78%',
        opacity: isDraft ? 0.8 : 1,
      }}
      className="mb-3"
    >
      {isAI && (
        <View className="flex-row items-center mb-1 ml-1" style={{ gap: 4 }}>
          <Sparkles size={11} color={c.signal} />
          <Text style={{ color: c.signal }} className="text-[10px] font-bold uppercase tracking-wider">
            ACE
          </Text>
        </View>
      )}

      <View
        style={{
          backgroundColor: bubbleBg,
          borderColor,
          borderWidth: 1,
          borderTopLeftRadius: isCustomer ? 4 : 18,
          borderTopRightRadius: isCustomer ? 18 : 4,
          borderRadius: 18,
        }}
        className="px-4 py-2.5"
      >
        <Text style={{ color: bubbleTextColor }} className="text-[15px] leading-5">
          {text}
        </Text>
      </View>

      <View className="flex-row items-center mt-1 justify-end" style={{ gap: 4 }}>
        {!isCustomer && (
          isAI ? (
            <Sparkles size={10} color={c.signal} />
          ) : (
            <User size={10} color={c.textTertiary} />
          )
        )}
        <Text style={{ color: c.textTertiary }} className="text-[10px]">
          {isDraft ? 'ACE is drafting...' : `${time} · ${isAI ? 'Handled by ACE' : 'You'}`}
        </Text>
        {!isCustomer && !isDraft && <StatusIcon status={status} color={c.textTertiary} />}
      </View>
    </Animated.View>
  );
}
