import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, Pressable, RefreshControl } from 'react-native';
import { useColorScheme } from 'nativewind';
import {
  Bell,
  MessageCircle,
  Smartphone,
  ShieldAlert,
  Trash2,
  CheckCircle2,
  Clock,
  AlertCircle,
  Radio,
} from 'lucide-react-native';
import { colors } from '../theme';
import { ScreenHeader } from '../src/components/ScreenHeader';
import { SegmentedControl } from '../src/components/SegmentedControl';
import { EmptyState } from '../src/components/EmptyState';
import { useNotificationHistory, useClearNotificationHistory, NotificationEvent } from '../src/api/client';
import { useAlert } from '../src/store/alertStore';
import { NotificationSkeleton } from '../src/components/PulsingSkeleton';

type ChannelFilter = 'All' | 'WhatsApp' | 'SMS' | 'In-App';

export default function NotificationHistoryScreen() {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const c = isDark ? colors.dark : colors.light;
  const alert = useAlert();

  const [activeFilter, setActiveFilter] = useState<ChannelFilter>('All');
  const { data, isLoading, refetch, isRefetching } = useNotificationHistory();
  const clearMutation = useClearNotificationHistory();

  const events: NotificationEvent[] = data?.events || [];

  const filteredEvents = useMemo(() => {
    if (activeFilter === 'All') return events;
    if (activeFilter === 'WhatsApp') return events.filter((e) => e.channel === 'whatsapp');
    if (activeFilter === 'SMS') return events.filter((e) => e.channel === 'sms');
    return events.filter((e) => e.channel === 'in-app' || e.channel === 'push');
  }, [events, activeFilter]);

  const handleClearHistory = () => {
    alert.showConfirm({
      title: 'Clear Notification History?',
      message: 'This will remove the delivery log from your device. Active alerts will not be affected.',
      confirmLabel: 'Clear Log',
      destructive: true,
      onConfirm: async () => {
        try {
          await clearMutation.mutateAsync();
          alert.success('Log Cleared', 'Notification history has been cleared.');
        } catch (err: any) {
          alert.error('Error', err?.message || 'Could not clear history.');
        }
      },
    });
  };

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case 'whatsapp':
        return <MessageCircle size={18} color="#25D366" />;
      case 'sms':
        return <Smartphone size={18} color="#3B82F6" />;
      default:
        return <Bell size={18} color="#F59E0B" />;
    }
  };

  const getChannelBadge = (channel: string) => {
    switch (channel) {
      case 'whatsapp':
        return { label: 'WhatsApp', bg: isDark ? 'rgba(37, 211, 102, 0.15)' : '#DCFCE7', text: '#16A34A' };
      case 'sms':
        return { label: 'Direct SMS', bg: isDark ? 'rgba(59, 130, 246, 0.15)' : '#DBEAFE', text: '#2563EB' };
      default:
        return { label: 'System Alert', bg: isDark ? 'rgba(245, 158, 11, 0.15)' : '#FEF3C7', text: '#D97706' };
    }
  };

  const formatTime = (isoString?: string) => {
    if (!isoString) return 'Just now';
    try {
      const date = new Date(isoString);
      const diffSecs = Math.floor((Date.now() - date.getTime()) / 1000);
      if (diffSecs < 60) return 'Just now';
      if (diffSecs < 3600) return `${Math.floor(diffSecs / 60)}m ago`;
      if (diffSecs < 86400) return `${Math.floor(diffSecs / 3600)}h ago`;
      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch {
      return isoString;
    }
  };

  return (
    <View style={{ backgroundColor: c.bg }} className="flex-1">
      <ScreenHeader
        title="Notification History"
        variant="bar"
        rightAction={
          events.length > 0 ? (
            <Pressable
              onPress={handleClearHistory}
              hitSlop={10}
              className="p-2 rounded-full active:opacity-60"
              style={{ backgroundColor: c.surfaceAlt }}
            >
              <Trash2 size={18} color={c.danger} />
            </Pressable>
          ) : undefined
        }
      />

      <View className="px-4 pt-4 pb-2">
        <SegmentedControl
          options={['All', 'WhatsApp', 'SMS', 'In-App']}
          value={activeFilter}
          onChange={(val) => setActiveFilter(val as ChannelFilter)}
        />
      </View>

      <ScrollView
        className="flex-1 px-4 pt-2"
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={() => { refetch(); }} tintColor={c.accent} colors={[c.accent]} />
        }
      >
        {isLoading ? (
          <View className="py-6">
            <NotificationSkeleton count={4} />
          </View>
        ) : filteredEvents.length === 0 ? (
          <View className="py-16">
            <EmptyState
              title="No Notifications Found"
              subtitle={
                activeFilter === 'All'
                  ? 'No system notifications or carrier dispatches recorded in this period.'
                  : `No historical notifications for the ${activeFilter} channel.`
              }
              icon={Bell}
            />
          </View>
        ) : (
          <View className="mt-3" style={{ gap: 12 }}>
            {filteredEvents.map((event) => {
              const badge = getChannelBadge(event.channel);
              return (
                <View
                  key={event.id}
                  style={{ backgroundColor: c.surface, borderColor: c.border }}
                  className="p-4 rounded-2xl border"
                >
                  <View className="flex-row items-start justify-between mb-2">
                    <View className="flex-row items-center flex-1 mr-2">
                      <View
                        style={{ backgroundColor: badge.bg }}
                        className="w-8 h-8 rounded-xl items-center justify-center mr-2.5"
                      >
                        {getChannelIcon(event.channel)}
                      </View>
                      <View className="flex-1">
                        <Text style={{ color: c.textPrimary }} className="text-sm font-bold" numberOfLines={1}>
                          {event.title}
                        </Text>
                        <Text style={{ color: c.textTertiary }} className="text-[11px]">
                          {formatTime(event.timestamp)}
                        </Text>
                      </View>
                    </View>

                    <View style={{ backgroundColor: badge.bg }} className="px-2 py-0.5 rounded-md">
                      <Text style={{ color: badge.text }} className="text-[10px] font-extrabold uppercase">
                        {badge.label}
                      </Text>
                    </View>
                  </View>

                  <Text style={{ color: c.textSecondary }} className="text-xs leading-relaxed mb-3">
                    {event.body}
                  </Text>

                  <View className="flex-row items-center justify-between pt-2 border-t" style={{ borderColor: c.border }}>
                    <View className="flex-row items-center">
                      <CheckCircle2 size={13} color="#10B981" />
                      <Text style={{ color: '#10B981' }} className="text-[11px] font-bold ml-1">
                        Carrier Delivered
                      </Text>
                    </View>

                    {event.metadata && (event.metadata.sku || event.metadata.provider || event.metadata.strategy) && (
                      <Text style={{ color: c.textTertiary }} className="text-[11px]">
                        Ref: {event.metadata.sku || event.metadata.provider || event.metadata.strategy}
                      </Text>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
