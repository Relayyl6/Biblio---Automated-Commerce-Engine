import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { User, Filter, MessageCircleOff } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useChats } from '../src/api/client';
import { colors, shadows } from '../theme';
import { ScreenHeader } from '../src/components/ScreenHeader';
import { SearchBar } from '../src/components/SearchBar';
import { EmptyState } from '../src/components/EmptyState';
import { LoadingScreen } from '../src/components/LoadingScreen';

export default function ChatsScreen() {
  const router = useRouter();
  const { data: chats, isLoading } = useChats();
  const { colorScheme } = useColorScheme();
  const c = colorScheme === 'dark' ? colors.dark : colors.light;
  const [query, setQuery] = useState('');

  // Search bar existed visually before but did nothing — now it actually
  // filters, matching the pattern used in the Inbox/CRM rewrites.
  const filteredChats = useMemo(() => {
    if (!chats) return [];
    if (!query) return chats;
    return chats.filter(
      (chat: any) => chat.name?.toLowerCase().includes(query.toLowerCase()) || chat.message?.toLowerCase().includes(query.toLowerCase())
    );
  }, [chats, query]);

  if (isLoading) return <LoadingScreen />;

  return (
    <View style={{ backgroundColor: c.bg }} className="flex-1">
      <ScreenHeader
        title="Chats"
        rightAction={
          <Pressable
            style={{ backgroundColor: c.surface, borderColor: c.border, ...shadows.sm }}
            className="w-10 h-10 rounded-full border items-center justify-center active:opacity-70"
          >
            <Filter size={20} color={c.textPrimary} />
          </Pressable>
        }
      />

      <View className="px-6 mb-6">
        <SearchBar value={query} onChangeText={setQuery} placeholder="Search conversations..." variant="pill" />
      </View>

      <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingBottom: 100 }}>
        {filteredChats.length === 0 ? (
          <EmptyState
            icon={MessageCircleOff}
            title={query ? 'No matching chats' : 'No active chats'}
            subtitle={query ? `Nothing matched "${query}".` : "New WhatsApp conversations will show up here as they come in."}
          />
        ) : (
          filteredChats.map((chat: any, i: number) => (
            <Animated.View key={chat.id} entering={FadeInDown.delay(i * 40).springify()}>
              <Pressable
                onPress={() => router.push(`/chat/${chat.id}`)}
                style={{
                  backgroundColor: c.surface,
                  borderColor: chat.unread ? c.accent : c.border,
                  ...shadows.sm,
                }}
                className="p-4 rounded-[24px] mb-3 border flex-row items-center active:opacity-80"
              >
                <View style={{ backgroundColor: c.accentSoft }} className="w-12 h-12 rounded-full items-center justify-center mr-4">
                  <User size={24} color={c.accent} />
                </View>
                <View className="flex-1">
                  <View className="flex-row justify-between items-center mb-1">
                    <Text style={{ color: c.textPrimary }} className="font-bold text-base flex-1 mr-2" numberOfLines={1}>
                      {chat.name}
                    </Text>
                    <Text style={{ color: c.textTertiary }} className="text-xs font-medium">
                      {chat.time}
                    </Text>
                  </View>
                  <View className="flex-row items-center">
                    <Text
                      style={{ color: chat.unread ? c.textPrimary : c.textSecondary }}
                      className={`text-sm flex-1 mr-2 ${chat.unread ? 'font-semibold' : ''}`}
                      numberOfLines={1}
                    >
                      {chat.message}
                    </Text>
                    {chat.unread > 0 && (
                      <View style={{ backgroundColor: c.accent }} className="min-w-[20px] h-5 px-1 rounded-full items-center justify-center">
                        <Text style={{ color: colorScheme === 'dark' ? '#090A0C' : '#FFFFFF' }} className="text-[10px] font-bold">
                          {chat.unread}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              </Pressable>
            </Animated.View>
          ))
        )}
      </ScrollView>
    </View>
  );
}
