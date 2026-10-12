import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  ArrowLeft,
  Send,
  Sparkles,
  Bot,
  User,
  MessageSquare,
  ShieldCheck,
  Zap,
} from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { colors } from '../theme';
import { useAgentMessages, useSendAgentMessage, type AgentMessage } from '../src/api/client';
import * as Haptics from 'expo-haptics';

export default function BiblioAssistantScreen() {
  const router = useRouter();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const c = isDark ? colors.dark : colors.light;

  const { data: messages = [], isLoading } = useAgentMessages();
  const sendMessageMutation = useSendAgentMessage();

  const [inputText, setInputText] = useState('');
  const flatListRef = useRef<FlatList>(null);

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text || sendMessageMutation.isPending) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setInputText('');
    await sendMessageMutation.mutateAsync({ text });
  };

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length]);

  const quickPrompts = [
    'Add product: Blue Ankara with white shine shine 45k 3 yards',
    "What's my revenue today?",
    'Explain the Zero-Deduction Fee Padding model',
    'Set my payout to instant',
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={['top']}>
      {/* Header */}
      <View
        style={{
          borderBottomColor: c.border,
          borderBottomWidth: 1,
          backgroundColor: isDark ? 'rgba(24, 24, 27, 0.8)' : 'rgba(255, 255, 255, 0.8)',
        }}
        className="flex-row items-center justify-between px-4 py-3"
      >
        <View className="flex-row items-center space-x-3">
          <Pressable
            onPress={() => router.back()}
            className="p-2 -ml-2 rounded-full active:opacity-70"
          >
            <ArrowLeft size={20} color={c.textPrimary} />
          </Pressable>
          <View className="flex-row items-center space-x-2">
            <View
              style={{ backgroundColor: c.accent }}
              className="w-9 h-9 rounded-full items-center justify-center"
            >
              <Bot size={20} color="#FFFFFF" />
            </View>
            <View>
              <View className="flex-row items-center space-x-1.5">
                <Text style={{ color: c.textPrimary }} className="text-base font-bold">
                  Biblio Assistant
                </Text>
                <View className="bg-emerald-500/20 px-1.5 py-0.5 rounded-full flex-row items-center">
                  <View className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1" />
                  <Text className="text-[10px] font-bold text-emerald-500">Live Agent</Text>
                </View>
              </View>
              <Text style={{ color: c.textTertiary }} className="text-xs">
                Syncs with WhatsApp in real-time
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Parity Banner */}
      <View
        style={{ backgroundColor: isDark ? '#1C1917' : '#FEF3C7', borderColor: '#F59E0B' }}
        className="mx-4 my-2 p-2.5 rounded-xl border flex-row items-center space-x-2"
      >
        <ShieldCheck size={16} color="#D97706" />
        <Text style={{ color: isDark ? '#FDE68A' : '#92400E' }} className="text-xs flex-1">
          Full Cross-Channel Parity: Anything you configure or chat here is immediately known on WhatsApp and other channels.
        </Text>
      </View>

      {/* Messages List */}
      {isLoading && messages.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={c.accent} />
          <Text style={{ color: c.textTertiary }} className="text-xs mt-2">
            Loading conversations...
          </Text>
        </View>
      ) : messages.length === 0 ? (
        <View className="flex-1 items-center justify-center p-6">
          <View
            style={{ backgroundColor: isDark ? '#27272A' : '#F4F4F5' }}
            className="w-16 h-16 rounded-full items-center justify-center mb-3"
          >
            <Sparkles size={28} color={c.accent} />
          </View>
          <Text style={{ color: c.textPrimary }} className="text-lg font-bold text-center mb-1">
            Hi, I'm Biblio!
          </Text>
          <Text style={{ color: c.textTertiary }} className="text-sm text-center mb-6">
            Ask me to catalog products, explain fee padding, set your bank details, or summarize today's sales.
          </Text>

          <View className="w-full space-y-2">
            {quickPrompts.map((prompt, idx) => (
              <Pressable
                key={idx}
                onPress={() => handleSend(prompt)}
                style={{
                  backgroundColor: isDark ? '#27272A' : '#FFFFFF',
                  borderColor: c.border,
                }}
                className="p-3 rounded-xl border active:opacity-70 flex-row items-center justify-between"
              >
                <Text style={{ color: c.textPrimary }} className="text-xs font-medium flex-1">
                  "{prompt}"
                </Text>
                <Zap size={14} color={c.accent} />
              </Pressable>
            ))}
          </View>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16 }}
          renderItem={({ item }) => {
            const isAgent = item.sender_role === 'agent' || item.sender_role === 'system';
            return (
              <View
                className={`mb-3 flex-row ${isAgent ? 'justify-start' : 'justify-end'}`}
              >
                {isAgent && (
                  <View
                    style={{ backgroundColor: c.accent }}
                    className="w-7 h-7 rounded-full items-center justify-center mr-2 self-end mb-1"
                  >
                    <Bot size={15} color="#FFFFFF" />
                  </View>
                )}

                <View
                  style={{
                    maxWidth: '82%',
                    backgroundColor: isAgent
                      ? isDark
                        ? '#27272A'
                        : '#F3F4F6'
                      : c.accent,
                    borderRadius: 18,
                    borderBottomLeftRadius: isAgent ? 4 : 18,
                    borderBottomRightRadius: isAgent ? 18 : 4,
                  }}
                  className="px-4 py-2.5"
                >
                  <Text
                    style={{
                      color: isAgent ? c.textPrimary : '#FFFFFF',
                      fontSize: 14,
                      lineHeight: 20,
                    }}
                  >
                    {item.content}
                  </Text>
                  <View className="flex-row items-center justify-between mt-1 pt-1 border-t border-black/5 dark:border-white/5">
                    <Text
                      style={{ color: isAgent ? c.textTertiary : 'rgba(255,255,255,0.7)' }}
                      className="text-[9px]"
                    >
                      {item.channel === 'whatsapp' ? 'via WhatsApp' : 'In-App'}
                    </Text>
                    <Text
                      style={{ color: isAgent ? c.textTertiary : 'rgba(255,255,255,0.7)' }}
                      className="text-[9px]"
                    >
                      {new Date(item.created_at).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </Text>
                  </View>
                </View>

                {!isAgent && (
                  <View
                    style={{ backgroundColor: isDark ? '#3F3F46' : '#E5E7EB' }}
                    className="w-7 h-7 rounded-full items-center justify-center ml-2 self-end mb-1"
                  >
                    <User size={15} color={c.textPrimary} />
                  </View>
                )}
              </View>
            );
          }}
        />
      )}

      {/* Input Bar */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View
          style={{
            borderTopColor: c.border,
            borderTopWidth: 1,
            backgroundColor: isDark ? '#18181B' : '#FFFFFF',
          }}
          className="p-3 flex-row items-center space-x-2"
        >
          <TextInput
            style={{
              backgroundColor: isDark ? '#27272A' : '#F4F4F5',
              color: c.textPrimary,
              borderColor: c.border,
            }}
            className="flex-1 py-2.5 px-4 rounded-full border text-sm max-h-24"
            placeholder="Talk with Biblio..."
            placeholderTextColor={c.textTertiary}
            value={inputText}
            onChangeText={setInputText}
            multiline
          />
          <Pressable
            onPress={() => handleSend()}
            disabled={!inputText.trim() || sendMessageMutation.isPending}
            style={{
              backgroundColor: inputText.trim() ? c.accent : isDark ? '#3F3F46' : '#E5E7EB',
            }}
            className="w-10 h-10 rounded-full items-center justify-center active:opacity-70"
          >
            {sendMessageMutation.isPending ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Send size={18} color="#FFFFFF" />
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
