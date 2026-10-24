import React from 'react';
import { View, Text, ScrollView, Pressable, StatusBar } from 'react-native';
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
  Package,
  ArrowUpRight,
  ChevronRight,
} from 'lucide-react-native';
import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import { useRouter } from 'expo-router';
import { useColorScheme } from 'nativewind';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { usePulseData, useProducts } from '../../src/api/client';
import { colors } from '../../theme';
import { StatTile } from '../../src/components/StatTile';
import { BentoGridSkeleton } from '../../src/components/PulsingSkeleton';

export default function PulseScreen() {
  const { data, isLoading } = usePulseData();
  const { data: products } = useProducts();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const c = isDark ? colors.dark : colors.light;

  if (isLoading) {
    return (
      <View style={{ backgroundColor: c.bg, paddingTop: Math.max(insets.top, StatusBar.currentHeight || 0) + 6 }} className="flex-1">
        <BentoGridSkeleton />
      </View>
    );
  }

  const recentProducts = (products || []).slice(0, 8);

  return (
    <ScrollView
      style={{ backgroundColor: c.bg, paddingTop: Math.max(insets.top, StatusBar.currentHeight || 0) + 6 }}
      className="flex-1"
      contentContainerStyle={{ paddingBottom: 140 }}
      showsVerticalScrollIndicator={false}
    >
      <View className="px-6 flex-row justify-between items-center mb-3">
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

      {/* ── Top Bento Grid (Xbox / App Store Hero Pattern) ── */}
      <Animated.View entering={FadeInDown.delay(80).springify()} className="mx-6 mb-6">
        <View style={{ gap: 12 }}>
          {/* Bento Hero Card (Today's Revenue with Live Velocity) */}
          <Pressable
            onPress={() => router.push('/finance')}
            style={{ backgroundColor: c.surface, borderColor: c.border }}
            className="p-6 rounded-[28px] border overflow-hidden active:opacity-90"
          >
            <View className="flex-row items-center justify-between mb-2">
              <View className="flex-row items-center">
                <View className="w-2.5 h-2.5 rounded-full bg-emerald-500 mr-2" />
                <Text style={{ color: c.textSecondary }} className="text-xs font-bold uppercase tracking-wider">
                  Today's Revenue
                </Text>
              </View>
              <View style={{ backgroundColor: c.successSoft }} className="flex-row items-center px-2.5 py-1 rounded-full">
                <TrendingUp size={12} color={c.success} />
                <Text style={{ color: c.success }} className="text-[11px] font-bold ml-1">
                  ↑ 18% vs last week
                </Text>
              </View>
            </View>

            <View className="flex-row items-baseline mb-2">
              <Text style={{ color: c.textPrimary }} className="text-4xl font-extrabold tracking-tight">
                ₦{data?.revenue?.total?.toLocaleString() ?? '0'}
              </Text>
            </View>

            <Text style={{ color: c.textSecondary }} className="text-xs leading-relaxed mb-4">
              Autonomously verified & negotiated across WhatsApp & storefront channels.
            </Text>

            <View className="flex-row items-center justify-between pt-3 border-t" style={{ borderColor: c.border }}>
              <Text style={{ color: c.accent }} className="text-xs font-bold">
                View Cash Flow & Margins
              </Text>
              <ChevronRight size={15} color={c.accent} />
            </View>
          </Pressable>

          {/* Right Bento Column: WhatsApp Copilot Card + Dual Metrics (Side-by-Side) */}
          <View style={{ gap: 12 }}>
            {/* WhatsApp Copilot Card (Vibrant Green matching user's Image 2) */}
            <Pressable
              onPress={() => router.push('/(tabs)/more')}
              style={{
                backgroundColor: isDark ? '#14532D' : '#DCFCE7',
                borderColor: isDark ? '#166534' : '#86EFAC',
              }}
              className="p-4 rounded-[24px] border flex-row items-center justify-between active:opacity-85"
            >
              <View className="flex-1 pr-3">
                <View className="flex-row items-center mb-1">
                  <Text style={{ color: isDark ? '#86EFAC' : '#14532D' }} className="font-extrabold text-sm">
                    WhatsApp Copilot
                  </Text>
                  <View className="w-2 h-2 rounded-full bg-emerald-400 ml-2" />
                </View>
                <Text style={{ color: isDark ? '#BBF7D0' : '#166534' }} className="text-[11px] font-medium leading-tight">
                  24/7 Persistent Daemon Active. Replying to customers autonomously.
                </Text>
              </View>
              <View style={{ backgroundColor: isDark ? '#15803D' : '#22C55E' }} className="w-12 h-12 rounded-2xl items-center justify-center">
                <FontAwesome5 name="whatsapp" size={24} color="#FFFFFF" />
              </View>
            </Pressable>

            {/* Bottom Dual Mini Cards (Side-by-Side) */}
            <View className="flex-row" style={{ gap: 12 }}>
              {/* Card 1: AOCR */}
              <Pressable
                onPress={() => router.push('/(tabs)/inbox')}
                style={{ backgroundColor: c.surface, borderColor: c.border }}
                className="flex-1 p-4 rounded-[22px] border active:opacity-80 justify-between"
              >
                <View className="flex-row items-center justify-between mb-1.5">
                  <Activity size={18} color={isDark ? '#8B5CF6' : '#2563EB'} />
                  <View style={{ backgroundColor: c.accentSoft }} className="px-1.5 py-0.5 rounded">
                    <Text style={{ color: c.accent }} className="text-[9px] font-bold">AOCR</Text>
                  </View>
                </View>
                <Text style={{ color: c.textPrimary }} className="text-2xl font-black">
                  {data?.outcomes?.[0]?.value ?? 94}%
                </Text>
                <Text style={{ color: c.textSecondary }} className="text-[11px]">
                  Zero human touch
                </Text>
              </Pressable>

              {/* Card 2: The Oracle */}
              <Pressable
                onPress={() => router.push('/(tabs)/inbox')}
                style={{ backgroundColor: c.surface, borderColor: c.border }}
                className="flex-1 p-4 rounded-[22px] border active:opacity-80 justify-between"
              >
                <View className="flex-row items-center justify-between mb-1.5">
                  <Sparkles size={18} color="#F59E0B" />
                  <View style={{ backgroundColor: '#FEF3C7' }} className="px-1.5 py-0.5 rounded">
                    <Text style={{ color: '#D97706' }} className="text-[9px] font-bold">ORACLE</Text>
                  </View>
                </View>
                <Text style={{ color: c.textPrimary }} className="text-2xl font-black">
                  {(data?.oracle_alerts || []).length || 2} Ready
                </Text>
                <Text style={{ color: c.textSecondary }} className="text-[11px]">
                  Swipe exceptions
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
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

      {/* Horizontal Carousel: Live / Recently Synced Inventory */}
      <View className="mb-6">
        <View className="mx-6 flex-row justify-between items-center mb-3">
          <Text style={{ color: c.textPrimary }} className="text-lg font-bold tracking-tight">
            Live Inventory & Sync
          </Text>
          <Pressable onPress={() => router.push('/crm')} className="flex-row items-center active:opacity-70">
            <Text style={{ color: c.accent }} className="text-xs font-bold mr-1">View CRM</Text>
            <ChevronRight size={14} color={c.accent} />
          </Pressable>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="pl-6" contentContainerStyle={{ paddingRight: 24 }}>
          {recentProducts.length === 0 ? (
            <Pressable
              onPress={() => router.push({ pathname: '/crm', params: { action: 'add' } })}
              style={{ backgroundColor: c.surface, borderColor: c.border }}
              className="w-72 p-5 rounded-[24px] border border-dashed flex-row items-center mr-4 active:opacity-70"
            >
              <View style={{ backgroundColor: c.accentSoft }} className="w-11 h-11 rounded-2xl items-center justify-center mr-3">
                <Package size={22} color={c.accent} />
              </View>
              <View className="flex-1">
                <Text style={{ color: c.textPrimary }} className="font-bold text-sm">Add First Product</Text>
                <Text style={{ color: c.textSecondary }} className="text-xs mt-0.5">Synced via WhatsApp, CSV or App</Text>
              </View>
            </Pressable>
          ) : (
            recentProducts.map((p: any, idx: number) => {
              const isWhatsApp = p.source === 'whatsapp';
              const inStock = Number(p.stock ?? p.quantity ?? 0) > 0;
              const stockCount = Number(p.stock ?? p.quantity ?? 0);
              return (
                <Pressable
                  key={p.sku || p.id || idx}
                  onPress={() => router.push('/crm')}
                  style={{ backgroundColor: c.surface, borderColor: c.border }}
                  className="w-56 p-4 rounded-[24px] border mr-4 justify-between active:opacity-80"
                >
                  <View>
                    <View className="flex-row items-center justify-between mb-2">
                      <View
                        style={{ backgroundColor: isWhatsApp ? '#22C55E1A' : c.surfaceAlt }}
                        className="flex-row items-center px-2 py-0.5 rounded-full"
                      >
                        {isWhatsApp ? (
                          <FontAwesome5 name="whatsapp" size={11} color="#22C55E" />
                        ) : (
                          <Package size={11} color={c.textTertiary} />
                        )}
                        <Text
                          style={{ color: isWhatsApp ? '#22C55E' : c.textSecondary }}
                          className="text-[10px] font-bold ml-1 uppercase"
                        >
                          {isWhatsApp ? 'WhatsApp' : (p.category || 'Catalog')}
                        </Text>
                      </View>
                      <View style={{ backgroundColor: inStock ? c.successSoft : c.dangerSoft }} className="px-2 py-0.5 rounded-full">
                        <Text style={{ color: inStock ? c.success : c.danger }} className="text-[10px] font-bold">
                          {inStock ? `${stockCount} left` : 'Out of stock'}
                        </Text>
                      </View>
                    </View>

                    <Text style={{ color: c.textPrimary }} className="font-bold text-sm mt-1" numberOfLines={1}>
                      {p.name}
                    </Text>
                    {p.description ? (
                      <Text style={{ color: c.textTertiary }} className="text-[11px] mt-0.5" numberOfLines={1}>
                        {p.description}
                      </Text>
                    ) : null}
                  </View>

                  <View className="mt-4 pt-3 flex-row items-center justify-between border-t" style={{ borderColor: c.border }}>
                    <Text style={{ color: c.textPrimary }} className="font-extrabold text-base">
                      ₦{Number(p.price || 0).toLocaleString()}
                    </Text>
                    <ArrowUpRight size={16} color={c.textTertiary} />
                  </View>
                </Pressable>
              );
            })
          )}
        </ScrollView>
      </View>

      <SectionHeader title="The Oracle" c={c} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="pl-6 pb-2" contentContainerStyle={{ paddingRight: 24 }}>
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
