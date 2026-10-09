import React from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import {
  Settings,
  TrendingUp,
  Activity,
  Sparkles,
  MessageCircle,
  AlertTriangle,
  ShoppingCart,
  CreditCard,
  AlertCircle,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useColorScheme } from 'nativewind';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { usePulseData } from '../../src/api/client';
import { colors } from '../../theme';
import { StatTile } from '../../src/components/StatTile';

function Skeleton({ h, w, radius = 16, c }: { h: number; w: string | number; radius?: number; c: typeof colors.light }) {
  return <View style={{ height: h, width: w as any, borderRadius: radius, backgroundColor: c.surfaceAlt }} />;
}

function PulseSkeleton({ c }: { c: typeof colors.light }) {
  // A shape-matched skeleton reads as "loading your data" instead of a
  // spinner, which reads as "something might be broken."
  return (
    <View style={{ backgroundColor: c.bg }} className="flex-1 pt-16 px-6">
      <View className="flex-row justify-between items-center mb-8">
        <Skeleton h={28} w={120} c={c} />
        <Skeleton h={40} w={40} radius={20} c={c} />
      </View>
      <Skeleton h={140} w="100%" radius={24} c={c} />
      <View className="flex-row mt-4" style={{ gap: 12 }}>
        <Skeleton h={120} w="48%" radius={24} c={c} />
        <Skeleton h={120} w="48%" radius={24} c={c} />
      </View>
      <View className="mt-4">
        <Skeleton h={80} w="100%" radius={20} c={c} />
      </View>
    </View>
  );
}

export default function PulseScreen() {
  const { data, isLoading } = usePulseData();
  const router = useRouter();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const c = isDark ? colors.dark : colors.light;

  if (isLoading) return <PulseSkeleton c={c} />;

  return (
    <ScrollView style={{ backgroundColor: c.bg }} className="flex-1 pt-16" contentContainerStyle={{ paddingBottom: 140 }}>
      <View className="px-6 flex-row justify-between items-center mb-6">
        <View>
          <Text style={{ color: c.textSecondary }} className="text-xs font-semibold uppercase tracking-wider">
            Good morning
          </Text>
          <Text style={{ color: c.textPrimary }} className="text-2xl font-bold tracking-tight mt-0.5">
            Analytics
          </Text>
        </View>
        <Pressable
          onPress={() => router.push('/settings')}
          style={{ backgroundColor: c.surface, borderColor: c.border }}
          className="w-10 h-10 rounded-full border items-center justify-center active:opacity-70"
        >
          <Settings size={20} color={c.textPrimary} />
        </Pressable>
      </View>

      {/* Hero Metric */}
      <Animated.View entering={FadeInDown.delay(80).springify()} className="mx-6 mb-4">
        <View style={{ backgroundColor: c.surface, borderColor: c.border }} className="p-6 rounded-[28px] border overflow-hidden">
          <Text style={{ color: c.textSecondary }} className="text-sm font-medium mb-2">
            Today's Revenue
          </Text>
          <View className="flex-row items-baseline flex-wrap">
            <Text style={{ color: c.textPrimary }} className="text-4xl font-bold tracking-tight mr-3">
              ₦{data?.revenue?.total?.toLocaleString() ?? '0'}
            </Text>
            <View style={{ backgroundColor: c.successSoft }} className="flex-row items-center px-2 py-1 rounded-full">
              <TrendingUp size={14} color={c.success} />
              <Text style={{ color: c.success }} className="text-xs font-bold ml-1">
                ↑ 18% vs last Tue
              </Text>
            </View>
          </View>
        </View>
      </Animated.View>

      {/* KPI row, now sharing the StatTile component */}
      <Animated.View entering={FadeInDown.delay(130).springify()} className="mx-6 flex-row mb-6" style={{ gap: 12 }}>
        <StatTile
          icon={Activity}
          iconColor={isDark ? '#8B5CF6' : '#2563EB'}
          label="Auto Completion"
          value={`${data?.outcomes?.[0]?.value ?? 0}%`}
          caption="Zero human touch"
          onPress={() => router.push('/inbox')}
        />
        <StatTile
          icon={MessageCircle}
          iconColor={c.success}
          label="Active AI Chats"
          value="12"
          caption="Live right now"
          onPress={() => router.push('/inbox')}
        />
      </Animated.View>

      {/* Autonomy Debt */}
      {!!data?.autonomy_debt?.drop_pct && (
        <Animated.View entering={FadeInDown.delay(170).springify()} className="mx-6 mb-6">
          <View style={{ backgroundColor: c.warningSoft, borderColor: isDark ? 'rgba(251,191,36,0.2)' : '#FDE68A' }} className="p-4 rounded-2xl border flex-row items-center">
            <AlertTriangle size={22} color={isDark ? '#FBBF24' : '#D97706'} />
            <View className="flex-1 ml-3">
              <Text style={{ color: isDark ? '#FBBF24' : '#92400E' }} className="font-bold mb-1">
                Autonomy Debt
              </Text>
              <Text style={{ color: isDark ? '#FCD34D' : '#B45309' }} className="text-sm leading-relaxed">
                Your AOCR dropped {data.autonomy_debt.drop_pct}% this week. {data.autonomy_debt.interventions ?? 0} orders needed manual intervention.{' '}
                <Text onPress={() => router.push('/inbox')} className="font-bold underline">
                  View reasons
                </Text>
              </Text>
            </View>
          </View>
        </Animated.View>
      )}

      <SectionHeader title="The Oracle" c={c} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="pl-6 pb-2">
        {(data?.oracle_alerts || []).map((alert: any, idx: number) => {
          const isWinback = alert.type === 'WINBACK';
          const accentColor = isWinback ? '#F59E0B' : '#EF4444';
          return (
            <View
              key={idx}
              style={{ backgroundColor: c.surface, borderColor: c.border, borderLeftColor: accentColor }}
              className="w-80 p-5 rounded-[24px] border border-l-4 mr-4"
            >
              <View className="flex-row items-center mb-2">
                <Sparkles size={16} color={accentColor} />
                <Text style={{ color: c.textPrimary }} className="font-bold ml-2">
                  {isWinback ? 'VIP Win-Back' : 'Inventory Alert'}
                </Text>
              </View>
              <Text style={{ color: c.textSecondary }} className="text-sm leading-relaxed mb-4">
                {alert.message}
              </Text>
              <Pressable
                onPress={() => router.push(isWinback ? '/inbox' : '/crm')}
                style={{ backgroundColor: c.textPrimary }}
                className="rounded-full py-2.5 items-center active:opacity-80"
              >
                <Text style={{ color: c.bg }} className="font-bold text-sm">
                  {isWinback ? 'Review Drafts' : 'Approve Restock'}
                </Text>
              </Pressable>
            </View>
          );
        })}
      </ScrollView>

      <View className="mt-6">
        <SectionHeader title="Cash Flow" c={c} />
        <Pressable
          onPress={() => router.push('/finance')}
          style={{ backgroundColor: c.surface, borderColor: c.border }}
          className="mx-6 p-5 rounded-3xl border mb-6 flex-row justify-between items-center active:opacity-80"
        >
          <View>
            <Text style={{ color: c.success }} className="font-bold text-lg">
              + ₦{(data?.revenue?.total || 0).toLocaleString()}
            </Text>
            <Text style={{ color: c.textSecondary }} className="text-xs">
              In (30d)
            </Text>
          </View>
          <Activity size={28} color={c.textTertiary} />
          <View className="items-end">
            <Text style={{ color: c.danger }} className="font-bold text-lg">
              − ₦180k
            </Text>
            <Text style={{ color: c.textSecondary }} className="text-xs">
              Out (Suppliers)
            </Text>
          </View>
        </Pressable>
      </View>

      <SectionHeader title="Leak Map" c={c} />
      <View style={{ backgroundColor: c.surface, borderColor: c.border }} className="mx-6 p-5 rounded-3xl border mb-6">
        <LeakRow icon={ShoppingCart} title="Abandoned Carts" subtitle="Revenue leaked" amount={data?.leak_map?.abandoned_carts} c={c} onPress={() => router.push('/finance')} showDivider />
        <LeakRow icon={CreditCard} title="Failed Payments" subtitle="Card declined" amount={data?.leak_map?.failed_payments} c={c} onPress={() => router.push('/finance')} showDivider />
        <LeakRow icon={AlertCircle} title="Unverified Payments" subtitle="Missing receipts" amount={data?.leak_map?.unverified} c={c} onPress={() => router.push('/finance')} />
      </View>

      <SectionHeader title="Market Intelligence" c={c} />
      <View style={{ backgroundColor: isDark ? c.surface : '#0F172A', borderColor: isDark ? c.border : '#1E293B' }} className="mx-6 p-5 rounded-3xl border mb-6">
        <View className="flex-row items-center justify-between mb-4 pb-4" style={{ borderBottomWidth: 1, borderBottomColor: '#1F2937' }}>
          <View className="flex-row items-center flex-1">
            <View style={{ backgroundColor: 'rgba(59,130,246,0.15)', borderColor: 'rgba(59,130,246,0.3)' }} className="w-10 h-10 rounded-full border items-center justify-center mr-3">
              <Activity size={18} color="#60A5FA" />
            </View>
            <View>
              <Text className="text-white font-semibold">Demand Velocity</Text>
              <Text style={{ color: '#9CA3AF' }} className="text-xs mt-0.5">
                Live market signals
              </Text>
            </View>
          </View>
          <View style={{ backgroundColor: 'rgba(59,130,246,0.2)' }} className="px-2 py-1 rounded">
            <Text style={{ color: '#60A5FA' }} className="text-[10px] font-bold uppercase tracking-wider">
              Beta
            </Text>
          </View>
        </View>

        <Text className="text-white text-sm leading-relaxed mb-4">
          <Text style={{ color: c.success }} className="font-bold">
            Opportunity:{' '}
          </Text>
          Inquiries for '{data?.market_pulse?.trend || 'Item'}' are up {data?.market_pulse?.surge_pct || 0}% in your zone. Competitors average ₦{(data?.market_pulse?.avg_price || 0).toLocaleString()}.
        </Text>

        <View className="flex-row items-center justify-between">
          <Text style={{ color: '#9CA3AF' }} className="text-xs">
            Based on 1,840 local chats
          </Text>
          <Pressable onPress={() => router.push('/crm')}>
            <Text style={{ color: '#60A5FA' }} className="text-xs font-bold active:opacity-70">
              Source Inventory →
            </Text>
          </Pressable>
        </View>
      </View>

      <SectionHeader title="Deep-Dive Analytics" c={c} />
      <View className="px-6">
        <DeepDiveRow title="Product Performance Matrix" c={c} onPress={() => router.push('/crm')} />
        <DeepDiveRow title="Customer Cohort Analysis" c={c} onPress={() => router.push('/crm')} />
        <DeepDiveRow title="Conversation Analytics" c={c} onPress={() => router.push('/inbox')} />
        <DeepDiveRow title="Logistics Scorecard" c={c} onPress={() => router.push('/finance')} />
      </View>
    </ScrollView>
  );
}

function SectionHeader({ title, c }: { title: string; c: typeof colors.light }) {
  return (
    <Text style={{ color: c.textPrimary }} className="px-6 text-lg font-bold tracking-tight mb-4">
      {title}
    </Text>
  );
}

function LeakRow({
  icon: Icon,
  title,
  subtitle,
  amount,
  c,
  onPress,
  showDivider,
}: {
  icon: typeof ShoppingCart;
  title: string;
  subtitle: string;
  amount?: number;
  c: typeof colors.light;
  onPress: () => void;
  showDivider?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={showDivider ? { borderBottomWidth: 1, borderBottomColor: c.border } : undefined}
      className="flex-row items-center justify-between py-3 active:opacity-60"
    >
      <View className="flex-row items-center flex-1">
        <View style={{ backgroundColor: c.dangerSoft }} className="w-10 h-10 rounded-full items-center justify-center mr-3">
          <Icon size={18} color={c.danger} />
        </View>
        <View>
          <Text style={{ color: c.textPrimary }} className="font-semibold">
            {title}
          </Text>
          <Text style={{ color: c.textSecondary }} className="text-xs mt-0.5">
            {subtitle}
          </Text>
        </View>
      </View>
      <Text style={{ color: c.danger }} className="font-bold text-base">
        ₦{(amount || 0).toLocaleString()}
      </Text>
    </Pressable>
  );
}

function DeepDiveRow({ title, c, onPress }: { title: string; c: typeof colors.light; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={{ backgroundColor: c.surface, borderColor: c.border }}
      className="p-4 rounded-xl border mb-3 flex-row justify-between items-center active:opacity-80"
    >
      <Text style={{ color: c.textPrimary }} className="font-semibold">
        {title}
      </Text>
      <Text style={{ color: c.accent }} className="font-bold">
        →
      </Text>
    </Pressable>
  );
}
