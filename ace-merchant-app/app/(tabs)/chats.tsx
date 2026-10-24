import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { User, Filter, MessageCircleOff } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useChats } from '../../src/api/client';
import { colors, shadows } from '../../theme';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { SearchBar } from '../../src/components/SearchBar';
import { EmptyState } from '../../src/components/EmptyState';
import { LoadingScreen } from '../../src/components/LoadingScreen';

export default function ChatsTabScreen() {
  const router = useRouter();
  const { data: chats, isLoading, refetch, isRefetching } = useChats();
  const { colorScheme } = useColorScheme();
  const c = colorScheme === 'dark' ? colors.dark : colors.light;
  const [query, setQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'unread' | 'takeover'>('all');

  const unreadCount = useMemo(() => (chats || []).filter((ch: any) => Number(ch.unread) > 0).length, [chats]);
  const takeoverCount = useMemo(() => (chats || []).filter((ch: any) => ch.isHumanOverride).length, [chats]);

  const cycleFilter = () => {
    setActiveFilter(prev => {
      if (prev === 'all') return 'unread';
      if (prev === 'unread') return 'takeover';
      return 'all';
    });
  };

  const filteredChats = useMemo(() => {
    if (!chats) return [];
    return chats.filter((chat: any) => {
      const matchesQuery = !query ||
        chat.name?.toLowerCase().includes(query.toLowerCase()) ||
        chat.message?.toLowerCase().includes(query.toLowerCase());

      if (!matchesQuery) return false;
      if (activeFilter === 'unread') return Number(chat.unread) > 0;
      if (activeFilter === 'takeover') return !!chat.isHumanOverride;
      return true;
    });
  }, [chats, query, activeFilter]);

  if (isLoading) return <LoadingScreen />;

  return (
    <View style={{ backgroundColor: c.bg }} className="flex-1">
      <ScreenHeader
        title="Chats"
        rightAction={
          <Pressable
            onPress={cycleFilter}
            style={{
              backgroundColor: activeFilter !== 'all' ? c.accentSoft : c.surface,
              borderColor: activeFilter !== 'all' ? c.accent : c.border,
              ...shadows.sm,
            }}
            className="w-10 h-10 rounded-full border items-center justify-center active:opacity-70"
          >
            <Filter size={18} color={activeFilter !== 'all' ? c.accent : c.textPrimary} />
          </Pressable>
        }
      />

      <View className="px-6 mb-2">
        <SearchBar value={query} onChangeText={setQuery} placeholder="Search conversations..." variant="pill" />
      </View>

      {/* Quick Filter Pills */}
      <View className="px-6 mb-2.5 flex-row items-center gap-2">
        <Pressable
          onPress={() => setActiveFilter('all')}
          style={{
            backgroundColor: activeFilter === 'all' ? c.accent : c.surface,
            borderColor: activeFilter === 'all' ? c.accent : c.border,
          }}
          className="px-3.5 py-1.5 rounded-full border flex-row items-center active:opacity-70"
        >
          <Text
            style={{ color: activeFilter === 'all' ? (colorScheme === 'dark' ? '#090A0C' : '#FFFFFF') : c.textSecondary }}
            className="text-xs font-bold"
          >
            All ({(chats || []).length})
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setActiveFilter('unread')}
          style={{
            backgroundColor: activeFilter === 'unread' ? c.accent : c.surface,
            borderColor: activeFilter === 'unread' ? c.accent : c.border,
          }}
          className="px-3.5 py-1.5 rounded-full border flex-row items-center active:opacity-70"
        >
          <Text
            style={{ color: activeFilter === 'unread' ? (colorScheme === 'dark' ? '#090A0C' : '#FFFFFF') : c.textSecondary }}
            className="text-xs font-bold"
          >
            Unread ({unreadCount})
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setActiveFilter('takeover')}
          style={{
            backgroundColor: activeFilter === 'takeover' ? c.accent : c.surface,
            borderColor: activeFilter === 'takeover' ? c.accent : c.border,
          }}
          className="px-3.5 py-1.5 rounded-full border flex-row items-center active:opacity-70"
        >
          <Text
            style={{ color: activeFilter === 'takeover' ? (colorScheme === 'dark' ? '#090A0C' : '#FFFFFF') : c.textSecondary }}
            className="text-xs font-bold"
          >
            Manual ({takeoverCount})
          </Text>
        </Pressable>
      </View>

      <ScrollView
        className="flex-1 px-4"
        contentContainerStyle={{ paddingBottom: 120 }}
      >
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
