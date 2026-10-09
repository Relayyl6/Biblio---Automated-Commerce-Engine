import React, { useMemo, useState, useRef } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SwipeableDraftCard } from '../../src/components/SwipeableDraftCard';
import { EmptyState } from '../../src/components/EmptyState';
import { CheckCircle2, ListFilter, CheckSquare, RotateCcw } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { useQueryClient } from '@tanstack/react-query';
import { useInbox, useExecuteInboxAction } from '../../src/api/client';
import { colors } from '../../theme';
import Animated, { FadeInDown, SlideInDown, SlideOutDown } from 'react-native-reanimated';

type FilterKey = 'priority' | 'restocks' | 'snoozed';

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'priority', label: 'High Priority' },
  { key: 'restocks', label: 'Restocks' },
  { key: 'snoozed', label: 'Snoozed' },
];

export default function InboxScreen() {
  const { colorScheme } = useColorScheme();
  const c = colorScheme === 'dark' ? colors.dark : colors.light;
  const queryClient = useQueryClient();
  const [activeFilter, setActiveFilter] = useState<FilterKey>('priority');
  const [undoToast, setUndoToast] = useState<{ visible: boolean; action: string; cardId: string | null }>({
    visible: false,
    action: '',
    cardId: null,
  });
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const { data: cards = [] } = useInbox();
  const { mutate: executeAction } = useExecuteInboxAction();

  // Filter counts drive the pill labels so they stay accurate as the
  // queue changes, rather than hardcoding "(N)" on one pill only.
  const counts = useMemo(
    () => ({
      priority: cards.filter((c: any) => c.priority === 'high' || !c.priority).length,
      restocks: cards.filter((c: any) => c.type === 'restock').length,
      snoozed: cards.filter((c: any) => c.status === 'snoozed').length,
    }),
    [cards]
  );

  const visibleCards = useMemo(() => {
    if (activeFilter === 'priority') return cards.filter((c: any) => c.priority === 'high' || !c.priority);
    if (activeFilter === 'restocks') return cards.filter((c: any) => c.type === 'restock');
    return cards.filter((c: any) => c.status === 'snoozed');
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

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={{ backgroundColor: c.bg }} className="flex-1 pt-16">
        <View className="px-6 mb-6 flex-row justify-between items-center">
          <Text style={{ color: c.textPrimary }} className="text-3xl font-bold tracking-tight">
            Exception Queue
          </Text>
          <View className="flex-row">
            <Pressable
              style={{ backgroundColor: c.surface, borderColor: c.border }}
              className="w-10 h-10 rounded-full border items-center justify-center mr-2 active:opacity-70"
            >
              <CheckSquare size={20} color={c.textPrimary} />
            </Pressable>
            <Pressable
              style={{ backgroundColor: c.textPrimary }}
              className="w-10 h-10 rounded-full items-center justify-center active:opacity-70"
            >
              <ListFilter size={20} color={c.bg} />
            </Pressable>
          </View>
        </View>

        {/* Filters are now actually wired to state instead of static pills */}
        <View className="px-6 flex-row mb-4">
          {FILTERS.map(f => {
            const isActive = activeFilter === f.key;
            return (
              <Pressable
                key={f.key}
                onPress={() => setActiveFilter(f.key)}
                style={{
                  backgroundColor: isActive ? c.textPrimary : c.surface,
                  borderColor: isActive ? c.textPrimary : c.border,
                }}
                className="px-4 py-2 rounded-full border mr-2 active:opacity-80"
              >
                <Text style={{ color: isActive ? c.bg : c.textSecondary }} className="font-semibold text-sm">
                  {f.label} ({counts[f.key]})
                </Text>
              </Pressable>
            );
          })}
        </View>

        {visibleCards.length > 0 ? (
          <ScrollView className="flex-1 px-6 pt-2" contentContainerStyle={{ paddingBottom: 140 }}>
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
          <EmptyState
            icon={CheckCircle2}
            title="You're all caught up."
            subtitle="Biblo is handling the rest. Go live your life."
            actionLabel="See what Biblo is doing"
            onAction={() => {}}
          />
        )}

        {undoToast.visible && (
          <Animated.View
            entering={SlideInDown.springify().damping(16)}
            exiting={SlideOutDown}
            style={{ backgroundColor: colorScheme === 'dark' ? c.surfaceAlt : c.textPrimary }}
            className="absolute bottom-10 left-6 right-6 rounded-2xl flex-row items-center justify-between px-5 py-4 shadow-lg"
          >
            <Text className="text-white text-sm font-medium">Action applied. ({undoToast.action})</Text>
            <Pressable onPress={handleUndo} className="flex-row items-center bg-white/10 px-3 py-1.5 rounded-full active:opacity-70">
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
