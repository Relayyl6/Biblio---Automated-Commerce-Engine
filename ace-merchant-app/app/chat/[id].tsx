import React, { useState, useRef, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Bot, MoreVertical, Phone } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { useChatDetails, useTakeoverChat, useSendChatMessage } from '../../src/api/client';
import { colors } from '../../theme';
import { Avatar } from '../../src/components/Avatar';
import { MessageBubble, ChatMessage } from '../../src/components/MessageBubble';
import { DateSeparator, groupMessagesByDay } from '../../src/components/DateSeparator';
import { ChatInputBar } from '../../src/components/ChatInputBar';
import { TypingIndicator } from '../../src/components/TypingIndicator';

export default function ChatDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const customerId = id as string;
  const { colorScheme } = useColorScheme();
  const c = colorScheme === 'dark' ? colors.dark : colors.light;

  const { data: chatData, isLoading, refetch } = useChatDetails(customerId);
  const takeoverMutation = useTakeoverChat();
  const sendMutation = useSendChatMessage();

  const [replyText, setReplyText] = useState('');
  const scrollRef = useRef<ScrollView>(null);

  const isHumanOverride = chatData?.isHumanOverride || false;
  const messages: ChatMessage[] = chatData?.messages || [];
  const customerName = chatData?.customerName || `Customer ${customerId}`;
  const customerPhone = chatData?.customerPhone;
  const isAiComposing = chatData?.isAiComposing || false;
  const aiDraftMessage = chatData?.aiDraftMessage || '';

  const grouped = groupMessagesByDay(messages as any);

  useEffect(() => {
    const t = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    return () => clearTimeout(t);
  }, [messages.length, isAiComposing, aiDraftMessage]);

  const handleTakeover = async () => {
    await takeoverMutation.mutateAsync(customerId);
    refetch();
  };

  const handleSend = async () => {
    const text = replyText.trim();
    if (!text) return;
    setReplyText('');
    await sendMutation.mutateAsync({ customerId, text });
    refetch();
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor: c.bg }} keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}>
      <View style={{ backgroundColor: c.surface, borderBottomColor: c.border }} className="px-4 pt-14 pb-3 border-b flex-row items-center">
        <Pressable onPress={() => router.back()} hitSlop={10} className="mr-2 active:opacity-60 p-1">
          <ArrowLeft size={24} color={c.textPrimary} />
        </Pressable>

        <Avatar name={customerName} size={38} online={chatData?.isOnline} />

        <View className="flex-1 ml-3">
          <Text style={{ color: c.textPrimary }} className="font-bold text-base" numberOfLines={1}>
            {customerName}
          </Text>
          <View className="flex-row items-center" style={{ gap: 4 }}>
            {!isHumanOverride && <Bot size={11} color={c.accent} />}
            <Text style={{ color: isHumanOverride ? c.success : c.textSecondary }} className="text-xs font-medium">
              {isHumanOverride ? 'You are replying' : 'Managed by Biblo AI'}
            </Text>
          </View>
        </View>

        {customerPhone && (
          <Pressable style={{ backgroundColor: c.surfaceAlt }} className="w-9 h-9 rounded-full items-center justify-center mr-2 active:opacity-70">
            <Phone size={16} color={c.textPrimary} />
          </Pressable>
        )}
        <Pressable style={{ backgroundColor: c.surfaceAlt }} className="w-9 h-9 rounded-full items-center justify-center active:opacity-70">
          <MoreVertical size={16} color={c.textPrimary} />
        </Pressable>
      </View>

      {!isHumanOverride && (
        <View style={{ backgroundColor: c.accentSoft }} className="px-4 py-2.5 flex-row items-center justify-between">
          <Text style={{ color: c.textPrimary }} className="text-xs flex-1 mr-3">
            Biblo AI is replying automatically. Take over any time to respond yourself.
          </Text>
          <Pressable onPress={handleTakeover} disabled={takeoverMutation.isPending} className="active:opacity-70">
            {takeoverMutation.isPending ? (
              <ActivityIndicator size="small" color={c.accent} />
            ) : (
              <Text style={{ color: c.accent }} className="text-xs font-bold">
                Take over
              </Text>
            )}
          </Pressable>
        </View>
      )}

      <ScrollView
        ref={scrollRef}
        className="flex-1 px-4 pt-4"
        contentContainerStyle={{ paddingBottom: 12 }}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
      >
        {isLoading ? (
          <View className="mt-16 items-center">
            <ActivityIndicator size="large" color={c.accent} />
          </View>
        ) : (
          <>
            {grouped.map((group, gi) => (
              <View key={gi}>
                {!!group.label && <DateSeparator label={group.label} />}
                {group.items.map((msg: any, idx: number) => (
                  <MessageBubble key={msg.id ?? idx} message={msg} index={idx} />
                ))}
              </View>
            ))}
            
            {/* The streaming draft UI */}
            {isAiComposing && aiDraftMessage ? (
              <MessageBubble 
                message={{ id: 'draft', sender: 'ai', text: aiDraftMessage, time: '' }} 
                index={messages.length} 
                isDraft={true} 
              />
            ) : isAiComposing ? (
              <TypingIndicator />
            ) : null}
          </>
        )}
      </ScrollView>

      <ChatInputBar
        isHumanOverride={isHumanOverride}
        value={replyText}
        onChangeText={setReplyText}
        onSend={handleSend}
        isSending={sendMutation.isPending}
        onRequestTakeover={handleTakeover}
        isTakingOver={takeoverMutation.isPending}
      />
    </KeyboardAvoidingView>
  );
}
