import React from 'react';
import { View, Text } from 'react-native';
import { Check, CheckCheck, Clock, AlertCircle, Bot, User } from 'lucide-react-native';
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
  if (status === 'failed') return <AlertCircle size={11} color="#EF4444" />;
  if (status === 'read') return <CheckCheck size={11} color={color} />;
  if (status === 'delivered' || status === 'sent') return <Check size={11} color={color} />;
  return null;
}

export function MessageBubble({ message, index, isDraft = false }: { message: ChatMessage; index: number; isDraft?: boolean }) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const c = isDark ? colors.dark : colors.light;
  const { sender, text, time, status } = message;

  const isCustomer = sender === 'customer';
  const isAI = sender === 'ai';

  const bubbleBg = isDraft ? c.accentSoft : isCustomer ? c.surface : isAI ? c.accent : c.success;
  const bubbleTextColor = isDraft ? c.textPrimary : isCustomer ? c.textPrimary : isDark ? '#090A0C' : '#FFFFFF';

  return (
    <Animated.View
      entering={FadeInUp.delay(Math.min(index * 30, 300)).duration(250).springify()}
      style={{ alignSelf: isCustomer ? 'flex-start' : 'flex-end', maxWidth: '82%', opacity: isDraft ? 0.8 : 1 }}
      className="mb-3"
    >
      <View
        style={{
          backgroundColor: bubbleBg,
          borderColor: isCustomer || isDraft ? c.border : 'transparent',
          borderWidth: isCustomer || isDraft ? 1 : 0,
          borderTopLeftRadius: isCustomer ? 4 : 18,
          borderTopRightRadius: isCustomer ? 18 : 4,
        }}
        className="px-4 py-2.5 rounded-2xl"
      >
        <Text style={{ color: bubbleTextColor }} className="text-[15px] leading-5">
          {text}
        </Text>
      </View>
      <View className="flex-row items-center mt-1 justify-end" style={{ gap: 4 }}>
        {!isCustomer && (isAI ? <Bot size={10} color={c.textTertiary} /> : <User size={10} color={c.textTertiary} />)}
        <Text style={{ color: c.textTertiary }} className="text-[10px]">
          {isDraft ? 'Biblo AI is drafting...' : `${time} · ${isAI ? 'Biblo AI' : 'You'}`}
        </Text>
        {!isCustomer && !isDraft && <StatusIcon status={status} color={c.textTertiary} />}
      </View>
    </Animated.View>
  );
}
