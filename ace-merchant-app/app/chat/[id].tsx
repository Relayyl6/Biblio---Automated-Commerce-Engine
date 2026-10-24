import React, { useState, useRef, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, KeyboardAvoidingView, Platform, Linking, Modal } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Bot, MoreVertical, Phone, UserCheck, ShieldAlert, CreditCard, Copy, X } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import * as Haptics from 'expo-haptics';
import { useChatDetails, useTakeoverChat, useReleaseTakeoverChat, useSendChatMessage } from '../../src/api/client';
import { useAlert } from '../../src/store/alertStore';
import { colors } from '../../theme';
import { Avatar } from '../../src/components/Avatar';
import { MessageBubble, ChatMessage } from '../../src/components/MessageBubble';
import { DateSeparator, groupMessagesByDay } from '../../src/components/DateSeparator';
import { ChatInputBar } from '../../src/components/ChatInputBar';
import { TypingIndicator } from '../../src/components/TypingIndicator';
import { ChatLoadSkeleton, InlineLoadingDots } from '../../src/components/PulsingSkeleton';

export default function ChatDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const customerId = id as string;
  const { colorScheme } = useColorScheme();
  const c = colorScheme === 'dark' ? colors.dark : colors.light;
  const alert = useAlert();

  const { data: chatData, isLoading, refetch } = useChatDetails(customerId);
  const takeoverMutation = useTakeoverChat();
  const releaseTakeoverMutation = useReleaseTakeoverChat();
  const sendMutation = useSendChatMessage();

  const [replyText, setReplyText] = useState('');
  const [showOptionsModal, setShowOptionsModal] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const isHumanOverride = chatData?.isHumanOverride || false;
  const messages: ChatMessage[] = chatData?.messages || [];
  const customerName = chatData?.customerName || `Customer ${customerId}`;
  const customerPhone = chatData?.customerPhone || (customerId.startsWith('+') || /^\d+$/.test(customerId) ? customerId : undefined);
  const isAiComposing = chatData?.isAiComposing || false;
  const aiDraftMessage = chatData?.aiDraftMessage || '';

  const grouped = groupMessagesByDay(messages as any);

  useEffect(() => {
    const t = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    return () => clearTimeout(t);
  }, [messages.length, isAiComposing, aiDraftMessage]);

  const handleTakeover = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await takeoverMutation.mutateAsync(customerId);
      alert.info('Manual Override Active', 'Biblo AI is paused. You have taken over this chat for the next hour.');
      refetch();
    } catch (e: any) {
      alert.error('Takeover Failed', e?.message || 'Could not pause Biblo AI.');
    }
  };

  const handleReleaseTakeover = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await releaseTakeoverMutation.mutateAsync(customerId);
      alert.success('Biblo AI Resumed', 'Autopilot restored. Biblo AI is now actively handling this customer.');
      refetch();
    } catch (e: any) {
      alert.error('Handback Failed', e?.message || 'Could not resume Biblo AI.');
    }
  };

  const handleCall = () => {
    if (!customerPhone) {
      alert.warning('No Phone Number', 'No valid phone number recorded for this customer.');
      return;
    }
    const cleanPhone = customerPhone.replace(/[^\d+]/g, '');
    Linking.openURL(`tel:${cleanPhone}`).catch(() => {
      alert.error('Dialer Error', 'Could not open native phone dialer.');
    });
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
          <Pressable
            onPress={handleCall}
            style={{ backgroundColor: c.surfaceAlt }}
            className="w-9 h-9 rounded-full items-center justify-center mr-2 active:opacity-70"
          >
            <Phone size={16} color={c.textPrimary} />
          </Pressable>
        )}
        <Pressable
          onPress={() => setShowOptionsModal(true)}
          style={{ backgroundColor: c.surfaceAlt }}
          className="w-9 h-9 rounded-full items-center justify-center active:opacity-70"
        >
          <MoreVertical size={16} color={c.textPrimary} />
        </Pressable>
      </View>

      {!isHumanOverride ? (
        <View style={{ backgroundColor: c.accentSoft }} className="px-4 py-2.5 flex-row items-center justify-between">
          <Text style={{ color: c.textPrimary }} className="text-xs flex-1 mr-3">
            Biblo AI is replying automatically. Take over any time to respond yourself.
          </Text>
          <Pressable onPress={handleTakeover} disabled={takeoverMutation.isPending} className="active:opacity-70">
            {takeoverMutation.isPending ? (
              <InlineLoadingDots color={c.accent} />
            ) : (
              <Text style={{ color: c.accent }} className="text-xs font-bold">
                Take over
              </Text>
            )}
          </Pressable>
        </View>
      ) : (
        <View style={{ backgroundColor: '#22C55E1A' }} className="px-4 py-2.5 flex-row items-center justify-between">
          <Text style={{ color: c.textPrimary }} className="text-xs flex-1 mr-3">
            Manual takeover active. AI responses paused.
          </Text>
          <Pressable onPress={handleReleaseTakeover} disabled={releaseTakeoverMutation.isPending} className="active:opacity-70">
            {releaseTakeoverMutation.isPending ? (
              <InlineLoadingDots color="#22C55E" />
            ) : (
              <Text style={{ color: '#22C55E' }} className="text-xs font-bold">
                Hand back to AI
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
          <ChatLoadSkeleton />
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

      {/* Options Sheet Modal */}
      <Modal visible={showOptionsModal} transparent animationType="fade" onRequestClose={() => setShowOptionsModal(false)}>
        <Pressable onPress={() => setShowOptionsModal(false)} className="flex-1 bg-black/60 justify-end">
          <Pressable onPress={e => e.stopPropagation()} style={{ backgroundColor: c.surface, borderColor: c.border }} className="rounded-t-3xl p-6 border-t">
            <View className="flex-row items-center justify-between pb-4 border-b mb-4" style={{ borderColor: c.border }}>
              <View>
                <Text style={{ color: c.textPrimary }} className="text-lg font-bold">
                  {customerName}
                </Text>
                <Text style={{ color: c.textSecondary }} className="text-xs">
                  {customerPhone || 'Customer Actions'}
                </Text>
              </View>
              <Pressable onPress={() => setShowOptionsModal(false)} className="p-2">
                <X size={20} color={c.textTertiary} />
              </Pressable>
            </View>

            <View className="gap-2">
              <Pressable
                onPress={() => {
                  setShowOptionsModal(false);
                  if (isHumanOverride) {
                    handleReleaseTakeover();
                  } else {
                    handleTakeover();
                  }
                }}
                style={{ backgroundColor: c.surfaceAlt }}
                className="flex-row items-center p-3.5 rounded-2xl active:opacity-70"
              >
                <Bot size={18} color={c.accent} style={{ marginRight: 12 }} />
                <View className="flex-1">
                  <Text style={{ color: c.textPrimary }} className="font-bold text-sm">
                    {isHumanOverride ? 'Resume Biblo AI Autopilot' : 'Take Over Conversation'}
                  </Text>
                  <Text style={{ color: c.textSecondary }} className="text-xs">
                    {isHumanOverride ? 'Let AI auto-reply to incoming texts' : 'Pause AI and reply manually'}
                  </Text>
                </View>
              </Pressable>

              <Pressable
                onPress={() => {
                  setShowOptionsModal(false);
                  router.push('/crm');
                }}
                style={{ backgroundColor: c.surfaceAlt }}
                className="flex-row items-center p-3.5 rounded-2xl active:opacity-70"
              >
                <UserCheck size={18} color="#8B5CF6" style={{ marginRight: 12 }} />
                <View className="flex-1">
                  <Text style={{ color: c.textPrimary }} className="font-bold text-sm">
                    View in CRM & Catalog
                  </Text>
                  <Text style={{ color: c.textSecondary }} className="text-xs">
                    Inspect product floors and stock
                  </Text>
                </View>
              </Pressable>

              <Pressable
                onPress={() => {
                  setShowOptionsModal(false);
                  setReplyText(`Please proceed to complete payment here: https://pay.biblo.ai/order/${customerId.slice(0, 8)}`);
                }}
                style={{ backgroundColor: c.surfaceAlt }}
                className="flex-row items-center p-3.5 rounded-2xl active:opacity-70"
              >
                <CreditCard size={18} color={c.success} style={{ marginRight: 12 }} />
                <View className="flex-1">
                  <Text style={{ color: c.textPrimary }} className="font-bold text-sm">
                    Insert Payment Link Draft
                  </Text>
                  <Text style={{ color: c.textSecondary }} className="text-xs">
                    Pre-fill input with verified payment checkout link
                  </Text>
                </View>
              </Pressable>

              {customerPhone && (
                <Pressable
                  onPress={() => {
                    setShowOptionsModal(false);
                    handleCall();
                  }}
                  style={{ backgroundColor: c.surfaceAlt }}
                  className="flex-row items-center p-3.5 rounded-2xl active:opacity-70"
                >
                  <Phone size={18} color="#3B82F6" style={{ marginRight: 12 }} />
                  <View className="flex-1">
                    <Text style={{ color: c.textPrimary }} className="font-bold text-sm">
                      Call Customer
                    </Text>
                    <Text style={{ color: c.textSecondary }} className="text-xs">
                      {customerPhone}
                    </Text>
                  </View>
                </Pressable>
              )}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}
