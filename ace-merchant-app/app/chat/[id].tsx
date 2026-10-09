import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Hand, Send } from 'lucide-react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useChatDetails, useTakeoverChat, useSendChatMessage } from '../src/api/client';

export default function ChatDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const customerId = id as string;
  
  const { data: chatData, isLoading, refetch } = useChatDetails(customerId);
  const takeoverMutation = useTakeoverChat();
  const sendMutation = useSendChatMessage();

  const [replyText, setReplyText] = useState('');

  const isHumanOverride = chatData?.isHumanOverride || false;
  const messages = chatData?.messages || [];

  const handleTakeover = async () => {
    await takeoverMutation.mutateAsync(customerId);
    refetch();
  };

  const handleSend = async () => {
    if (!replyText.trim()) return;
    await sendMutation.mutateAsync({ customerId, text: replyText });
    setReplyText('');
    refetch();
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
      className="flex-1 bg-[#F7F8FA] dark:bg-[#090A0C]"
    >
      {/* Header */}
      <View className="px-4 pt-14 pb-4 bg-white dark:bg-[#15171A] flex-row items-center border-b border-gray-200 dark:border-[#1F2227]">
        <Pressable onPress={() => router.back()} className="mr-3 active:opacity-60 p-2">
          <ArrowLeft size={24} className="text-[#0F172A] dark:text-white" />
        </Pressable>
        <View className="flex-1">
          <Text className="text-[#0F172A] dark:text-white font-bold text-lg">Customer (ID: {id})</Text>
          <Text className="text-[#64748B] dark:text-[#A1A1AA] text-xs">
            {isHumanOverride ? 'Human Override Active' : 'Managed by Biblio AI'}
          </Text>
        </View>
        {!isHumanOverride && (
          <Pressable 
            onPress={handleTakeover}
            disabled={takeoverMutation.isPending}
            className={`px-3 py-2 rounded-full flex-row items-center border active:opacity-70 ${takeoverMutation.isPending ? 'bg-gray-100 border-gray-200 dark:bg-gray-800 dark:border-gray-700' : 'bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-900/30'}`}
          >
            {takeoverMutation.isPending ? (
               <ActivityIndicator size="small" color="#EF4444" />
            ) : (
               <>
                 <Hand size={14} className="text-red-500 mr-1" />
                 <Text className="text-red-500 font-bold text-xs">Take Over</Text>
               </>
            )}
          </Pressable>
        )}
      </View>

      {/* Message List */}
      <ScrollView className="flex-1 px-4 py-6" contentContainerStyle={{ paddingBottom: 20 }}>
        {isLoading && <ActivityIndicator size="large" color="#2563EB" className="mt-10" />}
        {!isLoading && messages.map((msg: any, idx: number) => {
          const isCustomer = msg.sender === 'customer';
          const isAI = msg.sender === 'ai';
          const isHuman = msg.sender === 'human';

          return (
            <Animated.View 
              entering={FadeInUp.delay(idx * 50).springify()}
              key={msg.id || idx} 
              className={`mb-4 max-w-[80%] ${isCustomer ? 'self-start' : 'self-end'}`}
            >
              <View 
                className={`p-3 rounded-2xl ${
                  isCustomer 
                    ? 'bg-white dark:bg-[#15171A] rounded-tl-none border border-gray-100 dark:border-[#1F2227]' 
                    : isAI 
                      ? 'bg-blue-500 dark:bg-[#2563EB] rounded-tr-none' 
                      : 'bg-emerald-500 dark:bg-emerald-600 rounded-tr-none'
                }`}
              >
                <Text className={`${isCustomer ? 'text-[#0F172A] dark:text-white' : 'text-white'} text-base`}>
                  {msg.text}
                </Text>
              </View>
              <View className={`flex-row mt-1 ${isCustomer ? 'justify-start' : 'justify-end'}`}>
                <Text className="text-[#94A3B8] text-[10px]">{msg.time}</Text>
                {!isCustomer && (
                  <Text className="text-[#94A3B8] text-[10px] ml-1 font-bold">
                    • {isAI ? 'Biblio AI' : 'You'}
                  </Text>
                )}
              </View>
            </Animated.View>
          );
        })}
      </ScrollView>

      {/* Input Area */}
      {isHumanOverride && (
        <Animated.View entering={FadeInUp.springify()} className="p-4 bg-white dark:bg-[#15171A] border-t border-gray-200 dark:border-[#1F2227] flex-row items-center">
          <TextInput
            value={replyText}
            onChangeText={setReplyText}
            placeholder="Type a message..."
            placeholderTextColor="#94A3B8"
            className="flex-1 bg-[#F7F8FA] dark:bg-[#090A0C] border border-gray-200 dark:border-[#1F2227] rounded-full px-4 h-12 text-[#0F172A] dark:text-white"
          />
          <Pressable 
            onPress={handleSend}
            disabled={sendMutation.isPending || !replyText.trim()}
            className={`ml-3 w-12 h-12 rounded-full items-center justify-center ${replyText.trim() ? 'bg-blue-500 dark:bg-[#E2FF6E]' : 'bg-gray-200 dark:bg-[#1F2227]'}`}
          >
            {sendMutation.isPending ? (
               <ActivityIndicator size="small" color="#FFF" />
            ) : (
               <Send size={20} className={replyText.trim() ? 'text-white dark:text-[#090A0C]' : 'text-gray-400 dark:text-gray-500'} />
            )}
          </Pressable>
        </Animated.View>
      )}
    </KeyboardAvoidingView>
  );
}
