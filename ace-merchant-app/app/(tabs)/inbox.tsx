import React, { useMemo, useState, useRef } from 'react';
import { View, Text, StatusBar, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SwipeableDraftCard } from '../../src/components/SwipeableDraftCard';
import { CheckCircle2, ListFilter, CheckSquare, RotateCcw, Sparkles, MessageCircle } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useInbox, useExecuteInboxAction, useSeedInboxCards } from '../../src/api/client';
import { colors } from '../../theme';
import Animated, { FadeInDown, SlideInDown, SlideOutDown } from 'react-native-reanimated';

type FilterKey = 'all' | 'priority' | 'restocks' | 'snoozed';

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All Drafts' },
  { key: 'priority', label: 'High Priority' },
  { key: 'restocks', label: 'Restocks' },
  { key: 'snoozed', label: 'Snoozed' },
];

export default function InboxScreen() {
  const router = useRouter();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const c = isDark ? colors.dark : colors.light;
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');
  const [undoToast, setUndoToast] = useState<{ visible: boolean; action: string; cardId: string | null }>({
    visible: false,
    action: '',
    cardId: null,
  });
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: cards = [], isLoading } = useInbox();
  const { mutate: executeAction } = useExecuteInboxAction();
  const seedMutation = useSeedInboxCards();

  const counts = useMemo(
    () => ({
      all: cards.length,
      priority: cards.filter((item: any) => item.priority === 'high' || !item.priority).length,
      restocks: cards.filter((item: any) => item.type === 'restock').length,
      snoozed: cards.filter((item: any) => item.status === 'snoozed').length,
    }),
    [cards]
  );

  const visibleCards = useMemo(() => {
    if (activeFilter === 'all') return cards;
    if (activeFilter === 'priority') return cards.filter((item: any) => item.priority === 'high' || !item.priority);
    if (activeFilter === 'restocks') return cards.filter((item: any) => item.type === 'restock');
    return cards.filter((item: any) => item.status === 'snoozed');
  }, [cards, activeFilter]);

  const removeCard = (id: string, actionStr: string) => {
    queryClient.setQueryData(['inboxCards'], (oldData: any[]) => (oldData ? oldData.filter(card => card.id !== id) : []));
    showUndoToast(id, actionStr);
  };

  const showUndoToast = (id: string, actionStr: string) => {
    setUndoToast({ visible: true, action: actionStr, cardId: id });
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setUndoToast(prev => ({ ...prev, visible: false })), 5000);
  };

  const handleUndo = () => {
    if (undoToast.cardId) {
      queryClient.invalidateQueries({ queryKey: ['inboxCards'] });
    }
    setUndoToast({ visible: false, action: '', cardId: null });
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  };

  const handleApprove = (id: string) => {
    executeAction({ cardId: id, action: 'approve' });
    removeCard(id, 'Approved');
  };

  const handleReject = (id: string) => {
    executeAction({ cardId: id, action: 'reject' });
    removeCard(id, 'Rejected');
  };

  const handleSnooze = (id: string) => {
    executeAction({ cardId: id, action: 'snooze' });
    removeCard(id, 'Snoozed');
  };

  const handleGenerateSampleCards = async () => {
    try {
      await seedMutation.mutateAsync();
    } catch (err: any) {
      console.warn('Seed sample cards error:', err?.message);
    }
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View
        style={{
          backgroundColor: c.bg,
          paddingTop: Math.max(insets.top, StatusBar.currentHeight || 0) + 6,
        }}
        className="flex-1"
      >
        {/* Header */}
        <View className="px-6 mb-2 flex-row justify-between items-start">
          <View className="flex-1 pr-3">
            <Text style={{ color: c.textPrimary }} className="text-2xl font-bold tracking-tight">
              Inbox
            </Text>
            <Text style={{ color: c.textSecondary }} className="text-xs mt-0.5">
              Swipe right to approve AI drafts • Swipe left to reject
            </Text>
          </View>
          <View className="flex-row">
            <Pressable
              onPress={() => router.push('/chats')}
              style={{ backgroundColor: c.surface, borderColor: c.border }}
              className="w-9 h-9 rounded-full border items-center justify-center mr-2 active:opacity-70"
            >
              <MessageCircle size={16} color={c.textPrimary} />
            </Pressable>
            <Pressable
              style={{ backgroundColor: c.textPrimary }}
              className="w-9 h-9 rounded-full items-center justify-center active:opacity-70"
            >
              <ListFilter size={16} color={c.bg} />
            </Pressable>
          </View>
        </View>

        {/* Scrollable Filter Chips */}
        <View style={{ height: 38 }} className="mb-2">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="pl-6"
            contentContainerStyle={{ paddingRight: 24, alignItems: 'center' }}
          >
            {FILTERS.map((f) => {
              const isActive = activeFilter === f.key;
              return (
                <Pressable
                  key={f.key}
                  onPress={() => setActiveFilter(f.key)}
                  style={{
                    backgroundColor: isActive ? c.textPrimary : c.surface,
                    borderColor: isActive ? c.textPrimary : c.border,
                    height: 32,
                  }}
                  className="px-3.5 rounded-full border mr-2 active:opacity-80 flex-row items-center justify-center self-center"
                >
                  <Text
                    style={{ color: isActive ? c.bg : c.textSecondary }}
                    className="font-semibold text-xs"
                  >
                    {f.label}
                  </Text>
                  <View
                    style={{
                      backgroundColor: isActive ? (isDark ? '#090A0C' : '#FFFFFF') : c.surfaceAlt,
                    }}
                    className="ml-1.5 px-1.5 py-0.5 rounded-full"
                  >
                    <Text
                      style={{
                        color: isActive ? (isDark ? '#FFFFFF' : '#090A0C') : c.textTertiary,
                      }}
                      className="text-[10px] font-bold"
                    >
                      {counts[f.key]}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* Cards or Empty State */}
        {visibleCards.length > 0 ? (
          <ScrollView
            className="flex-1 px-6 pt-2"
            contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 16) + 88 }}
            showsVerticalScrollIndicator={false}
          >
            {visibleCards.map((card: any, i: number) => (
              <Animated.View key={card.id} entering={FadeInDown.delay(i * 40).springify()}>
                <SwipeableDraftCard
                  id={card.id}
                  type={card.type}
                  title={card.title}
                  subtitle={card.subtitle}
                  onApprove={handleApprove}
                  onReject={handleReject}
                  onSnooze={handleSnooze}
                />
              </Animated.View>
            ))}
          </ScrollView>
        ) : (
          <ScrollView
            className="flex-1 px-6"
            contentContainerStyle={{
              paddingTop: 8,
              alignItems: 'center',
              paddingBottom: Math.max(insets.bottom, 16) + 88,
            }}
            showsVerticalScrollIndicator={false}
          >
            <View
              style={{ backgroundColor: c.surface, borderColor: c.border }}
              className="w-full p-5 rounded-[22px] border items-center text-center"
            >
              <View
                style={{ backgroundColor: c.successSoft }}
                className="w-12 h-12 rounded-full items-center justify-center mb-3"
              >
                <CheckCircle2 size={24} color={c.success} />
              </View>

              <Text style={{ color: c.textPrimary }} className="text-lg font-bold text-center mb-1">
                All caught up!
              </Text>
              <Text
                style={{ color: c.textSecondary }}
                className="text-xs text-center leading-relaxed mb-4 px-1"
              >
                No pending customer actions or restock orders require your manual review. Biblio AI is handling active chats autonomously.
              </Text>

              <View className="w-full" style={{ gap: 8 }}>
                <Pressable
                  onPress={handleGenerateSampleCards}
                  disabled={seedMutation.isPending}
                  style={{ backgroundColor: c.accent }}
                  className="py-3 px-4 rounded-xl items-center justify-center flex-row active:opacity-80"
                >
                  {seedMutation.isPending ? (
                    <ActivityIndicator color={isDark ? '#090A0C' : '#FFFFFF'} />
                  ) : (
                    <>
                      <Sparkles size={15} color={isDark ? '#090A0C' : '#FFFFFF'} />
                      <Text
                        style={{ color: isDark ? '#090A0C' : '#FFFFFF' }}
                        className="font-bold text-xs ml-2"
                      >
                        Generate Sample Approval Cards
                      </Text>
                    </>
                  )}
                </Pressable>

                <Pressable
                  onPress={() => router.push('/chats')}
                  style={{ backgroundColor: c.surfaceAlt }}
                  className="py-3 px-4 rounded-xl items-center justify-center flex-row active:opacity-80"
                >
                  <MessageCircle size={15} color={c.textPrimary} />
                  <Text style={{ color: c.textPrimary }} className="font-bold text-xs ml-2">
                    Open Live Customer Chats →
                  </Text>
                </Pressable>
              </View>
            </View>
          </ScrollView>
        )}

        {/* Undo Toast */}
        {undoToast.visible && (
          <Animated.View
            entering={SlideInDown.springify().damping(16)}
            exiting={SlideOutDown}
            style={{
              backgroundColor: isDark ? c.surfaceAlt : c.textPrimary,
              bottom: Math.max(insets.bottom, 16) + 76,
            }}
            className="absolute left-6 right-6 rounded-2xl flex-row items-center justify-between px-5 py-4 shadow-lg"
          >
            <Text className="text-white text-sm font-medium">
              Action applied ({undoToast.action})
            </Text>
            <Pressable
              onPress={handleUndo}
              className="flex-row items-center bg-white/10 px-3 py-1.5 rounded-full active:opacity-70"
            >
              <RotateCcw size={14} color={c.accent} />
              <Text style={{ color: c.accent }} className="text-xs font-bold uppercase tracking-wider ml-1.5">
                Undo
              </Text>
            </Pressable>
          </Animated.View>
        )}
      </View>
    </GestureHandlerRootView>
  );
}
