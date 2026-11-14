import React, { useMemo } from 'react';
import { View, Text, ScrollView, Pressable, StatusBar } from 'react-native';
import {
  Settings,
  TrendingUp,
  TrendingDown,
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
  CheckCircle2,
  Clock,
  Zap,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useColorScheme } from 'nativewind';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { usePulseData, useProducts, useMerchantConfig, useInbox } from '../../src/api/client';
import { colors, radius, shadows, typography } from '../../theme';
import { BentoGridSkeleton } from '../../src/components/PulsingSkeleton';
import { StatusPill } from '../../src/components/StatusPill';

export default function CommandCenterScreen() {
  const { data, isLoading } = usePulseData();
  const { data: products } = useProducts();
  const { data: config } = useMerchantConfig();
  const { data: rawInbox } = useInbox();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const c = isDark ? colors.dark : colors.light;

  // Time-aware greeting
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }, []);

  const merchantName = config?.name || 'Ada';

  if (isLoading) {
    return (
      <View
        style={{
          backgroundColor: c.bg,
          paddingTop: Math.max(insets.top, StatusBar.currentHeight || 0) + 2,
        }}
        className="flex-1"
      >
        <BentoGridSkeleton />
      </View>
    );
  }

  const recentProducts = Array.isArray(products) ? products.slice(0, 8) : [];
  const exceptions = Array.isArray(rawInbox) ? rawInbox.filter((item: any) => item && item.status !== 'snoozed') : [];
  const oracleAlerts = Array.isArray(data?.oracle_alerts) ? data.oracle_alerts : [];

  return (
    <ScrollView
      style={{
        backgroundColor: c.bg,
        paddingTop: Math.max(insets.top, StatusBar.currentHeight || 0) + 2,
      }}
      className="flex-1"
      contentContainerStyle={{ paddingBottom: 140 }}
      showsVerticalScrollIndicator={false}
    >
      {/* ── 1. Greeting line (DESIGN.md Section 10.1) ── */}
      <View className="px-4 flex-row justify-between items-center mb-4">
        <View>
          <Text style={{ color: c.textSecondary }} className="text-sm font-medium">
            {greeting}, {merchantName}
          </Text>
          <Text style={{ color: c.textPrimary }} className="text-2xl font-bold tracking-tight mt-0.5">
            Command Center
          </Text>
        </View>
        <Pressable
          onPress={() => router.push('/settings')}
          style={{ backgroundColor: c.surface, borderColor: c.border, ...shadows.sm }}
          className="w-10 h-10 rounded-full border items-center justify-center active:opacity-70"
          accessibilityRole="button"
          accessibilityLabel="Settings"
        >
          <Settings size={20} color={c.textPrimary} />
        </Pressable>
      </View>

      {/* ── 2. Hero Glass Card: Today's Revenue & Velocity (DESIGN.md Section 10.1) ── */}
      <Animated.View entering={FadeInDown.delay(60).springify()} className="mx-4 mb-4">
        <Pressable
          onPress={() => router.push('/finance')}
          style={{
            backgroundColor: c.surface,
            borderColor: c.border,
            borderRadius: radius.lg,
            ...shadows.md,
          }}
          className="p-6 border overflow-hidden active:opacity-90"
        >
          <View className="flex-row items-center justify-between mb-3">
            <View className="flex-row items-center">
              <View
                style={{ backgroundColor: c.settled }}
                className="w-2.5 h-2.5 rounded-full mr-2"
              />
              <Text style={{ color: c.textSecondary }} className="text-xs font-bold uppercase tracking-wider">
                Today's Revenue
              </Text>
            </View>
            <View
              style={{
                backgroundColor: data?.revenue?.is_positive !== false ? c.settledTint : c.alertTint,
              }}
              className="flex-row items-center px-2.5 py-1 rounded-full"
            >
              {data?.revenue?.is_positive !== false ? (
                <TrendingUp size={12} color={c.settled} />
              ) : (
                <TrendingDown size={12} color={c.alert} />
              )}
              <Text
                style={{
                  color: data?.revenue?.is_positive !== false ? c.settled : c.alert,
                  ...typography.tabularNums,
                }}
                className="text-[11px] font-bold ml-1"
              >
                {data?.revenue?.delta_label ?? '0% vs last week'}
              </Text>
            </View>
          </View>

          {/* Money in display font with tabular numerals */}
          <Text
            style={{
              color: c.textPrimary,
              ...typography.tabularNums,
            }}
            className="text-4xl font-extrabold tracking-tight mb-2"
          >
            ₦{Number(data?.revenue?.total || 0).toLocaleString()}
          </Text>

          <Text style={{ color: c.textSecondary }} className="text-xs leading-relaxed mb-4">
            Autonomously reconciled across WhatsApp conversations and direct orders.
          </Text>

          {/* Quick Cash Flow River link */}
          <View
            className="flex-row items-center justify-between pt-3 border-t"
            style={{ borderColor: c.border }}
          >
            <Text style={{ color: c.accent }} className="text-xs font-bold">
              View Cash Flow & Margins
            </Text>
            <ChevronRight size={15} color={c.accent} />
          </View>
        </Pressable>
      </Animated.View>

      {/* ── 3. WhatsApp Copilot & Automation State Banner ── */}
      <Animated.View entering={FadeInDown.delay(100).springify()} className="mx-4 mb-4">
        <Pressable
          onPress={() => router.push('/(tabs)/more')}
          style={{
            backgroundColor: data?.whatsapp_connected ? c.settledTint : c.reviewTint,
            borderColor: data?.whatsapp_connected ? c.settled : c.review,
            borderRadius: radius.md,
          }}
          className="p-4 border flex-row items-center justify-between active:opacity-85"
        >
          <View className="flex-1 pr-3">
            <View className="flex-row items-center mb-1">
              <Text
                style={{ color: data?.whatsapp_connected ? c.settled : c.review }}
                className="font-extrabold text-sm"
              >
                WhatsApp Copilot
              </Text>
              <View
                style={{ backgroundColor: data?.whatsapp_connected ? c.settled : c.review }}
                className="w-2 h-2 rounded-full ml-2"
              />
            </View>
            <Text
              style={{ color: c.textSecondary }}
              className="text-xs font-medium leading-tight"
            >
              {data?.whatsapp_connected
                ? 'ACE is active 24/7. Replying to customers, taking orders, and verifying payments.'
                : 'Standby. Tap to pair companion WhatsApp device.'}
            </Text>
          </View>
          <View
            style={{ backgroundColor: data?.whatsapp_connected ? c.settled : c.review }}
            className="w-10 h-10 rounded-full items-center justify-center"
          >
            <MessageCircle size={20} color="#FFFFFF" />
          </View>
        </Pressable>
      </Animated.View>

      {/* ── 4. Exception Queue (Highest Priority, Section 10.1) ── */}
      <Animated.View entering={FadeInDown.delay(130).springify()} className="mb-4">
        <View className="mx-4 flex-row justify-between items-center mb-3">
          <Text style={{ color: c.textPrimary }} className="text-lg font-bold tracking-tight">
            Exceptions & Human Decisions
          </Text>
          {exceptions.length > 0 && (
            <Pressable onPress={() => router.push('/(tabs)/inbox')} className="flex-row items-center active:opacity-70">
              <Text style={{ color: c.accent }} className="text-xs font-bold mr-1">
                View All ({exceptions.length})
              </Text>
              <ChevronRight size={14} color={c.accent} />
            </Pressable>
          )}
        </View>

        {exceptions.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="pl-4" contentContainerStyle={{ paddingRight: 16 }}>
            {exceptions.slice(0, 4).map((card: any, idx: number) => (
              <View
                key={card.id || idx}
                style={{
                  backgroundColor: c.surface,
                  borderColor: c.border,
                  borderLeftColor: c.review,
                  borderLeftWidth: 4,
                  borderRadius: radius.md,
                  ...shadows.sm,
                }}
                className="w-80 p-5 border mr-3 justify-between"
              >
                <View>
                  <View className="flex-row items-center justify-between mb-2">
                    <StatusPill label={card.type || 'Needs Review'} tone="review" />
                    <Text style={{ color: c.textTertiary }} className="text-xs">
                      {card.time || 'Pending'}
                    </Text>
                  </View>
                  <Text style={{ color: c.textPrimary }} className="font-bold text-base mb-1" numberOfLines={1}>
                    {card.title || card.customerName || 'Order Requires Confirmation'}
                  </Text>
                  <Text style={{ color: c.textSecondary }} className="text-xs leading-relaxed mb-3" numberOfLines={2}>
                    {card.reason || card.description || 'Payment mismatch or discount threshold exceeded.'}
                  </Text>
                </View>

                <Pressable
                  onPress={() => router.push('/(tabs)/inbox')}
                  style={{ backgroundColor: c.accent, borderRadius: radius.pill }}
                  className="h-10 items-center justify-center active:opacity-85"
                >
                  <Text style={{ color: '#FFFFFF' }} className="font-bold text-xs">
                    Review Decision
                  </Text>
                </Pressable>
              </View>
            ))}
          </ScrollView>
        ) : (
          /* Calm 0-Exceptions Success State (DESIGN.md Section 10.1 & 2.3) */
          <View
            style={{
              backgroundColor: c.settledTint,
              borderColor: c.settled,
              borderRadius: radius.md,
            }}
            className="mx-4 p-4 border flex-row items-center"
          >
            <View
              style={{ backgroundColor: c.settled }}
              className="w-8 h-8 rounded-full items-center justify-center mr-3"
            >
              <CheckCircle2 size={18} color="#FFFFFF" />
            </View>
            <View className="flex-1">
              <Text style={{ color: c.settled }} className="font-bold text-sm">
                Nothing needs you right now.
              </Text>
              <Text style={{ color: c.textSecondary }} className="text-xs mt-0.5">
                ACE is handling conversations, payments, and restock tracking autonomously.
              </Text>
            </View>
          </View>
        )}
      </Animated.View>

      {/* ── 5. AI Daily Briefing (DESIGN.md Section 10.1) ── */}
      <Animated.View entering={FadeInDown.delay(160).springify()} className="mx-4 mb-5">
        <View
          style={{
            backgroundColor: c.signalTint,
            borderColor: c.signal,
            borderRadius: radius.md,
          }}
          className="p-4 border"
        >
          <View className="flex-row items-center justify-between mb-2">
            <View className="flex-row items-center">
              <Sparkles size={16} color={c.signal} />
              <Text style={{ color: c.signal }} className="font-bold text-xs ml-2 uppercase tracking-wider">
                ACE Daily Briefing
              </Text>
            </View>
            <StatusPill label="Handled by ACE" tone="signal" />
          </View>
          <Text style={{ color: c.textPrimary }} className="text-sm leading-relaxed mb-3">
            {data?.market_pulse?.trend
              ? `Demand for '${data.market_pulse.trend}' is up in your region. Catalog prices average ₦${Number(data.market_pulse.avg_price || 0).toLocaleString()}.`
              : 'ACE replied to all incoming inquiries within 3 seconds. Stock levels and Providus virtual accounts are healthy.'}
          </Text>
          <Pressable
            onPress={() => router.push('/biblio-assistant')}
            className="flex-row items-center"
          >
            <Text style={{ color: c.signal }} className="text-xs font-bold mr-1">
              Ask ACE about your shop
            </Text>
            <ArrowUpRight size={13} color={c.signal} />
          </Pressable>
        </View>
      </Animated.View>

      {/* ── 6. Cash Flow River (DESIGN.md Section 10.1) ── */}
      <Animated.View entering={FadeInDown.delay(190).springify()} className="mx-4 mb-5">
        <View className="flex-row justify-between items-center mb-3">
          <Text style={{ color: c.textPrimary }} className="text-lg font-bold tracking-tight">
            Cash Flow River
          </Text>
          <Pressable onPress={() => router.push('/finance')} className="flex-row items-center active:opacity-70">
            <Text style={{ color: c.accent }} className="text-xs font-bold mr-1">
              Detailed Ledger
            </Text>
            <ChevronRight size={14} color={c.accent} />
          </Pressable>
        </View>

        <Pressable
          onPress={() => router.push('/finance')}
          style={{
            backgroundColor: c.surface,
            borderColor: c.border,
            borderRadius: radius.md,
            ...shadows.sm,
          }}
          className="p-5 border flex-row justify-between items-center active:opacity-80"
        >
          <View>
            <Text
              style={{
                color: c.settled,
                ...typography.tabularNums,
              }}
              className="font-bold text-lg"
            >
              +₦{(data?.revenue?.total || 0).toLocaleString()}
            </Text>
            <Text style={{ color: c.textSecondary }} className="text-xs">
              Inflows (Verified Orders)
            </Text>
          </View>
          <Activity size={24} color={c.textTertiary} />
          <View className="items-end">
            <Text
              style={{
                color: c.alert,
                ...typography.tabularNums,
              }}
              className="font-bold text-lg"
            >
              −₦{(data?.supplier_outflow || 0).toLocaleString()}
            </Text>
            <Text style={{ color: c.textSecondary }} className="text-xs">
              Outflows (Suppliers & Restocks)
            </Text>
          </View>
        </Pressable>
      </Animated.View>

      {/* ── 7. Live Inventory & Products Carousel ── */}
      <View className="mb-5">
        <View className="mx-4 flex-row justify-between items-center mb-3">
          <Text style={{ color: c.textPrimary }} className="text-lg font-bold tracking-tight">
            Live Inventory
          </Text>
          <Pressable onPress={() => router.push('/crm')} className="flex-row items-center active:opacity-70">
            <Text style={{ color: c.accent }} className="text-xs font-bold mr-1">
              Manage Catalog
            </Text>
            <ChevronRight size={14} color={c.accent} />
          </Pressable>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="pl-4" contentContainerStyle={{ paddingRight: 16 }}>
          {recentProducts.length === 0 ? (
            <Pressable
              onPress={() => router.push({ pathname: '/crm', params: { action: 'add' } })}
              style={{
                backgroundColor: c.surface,
                borderColor: c.border,
                borderRadius: radius.md,
              }}
              className="w-72 p-5 border border-dashed flex-row items-center mr-4 active:opacity-70"
            >
              <View
                style={{ backgroundColor: c.accentSoft }}
                className="w-11 h-11 rounded-2xl items-center justify-center mr-3"
              >
                <Package size={22} color={c.accent} />
              </View>
              <View className="flex-1">
                <Text style={{ color: c.textPrimary }} className="font-bold text-sm">
                  Add First Product
                </Text>
                <Text style={{ color: c.textSecondary }} className="text-xs mt-0.5">
                  Sync via WhatsApp, CSV or App
                </Text>
              </View>
            </Pressable>
          ) : (
            recentProducts.map((p: any, idx: number) => {
              const inStock = Number(p.stock ?? p.quantity ?? 0) > 0;
              const stockCount = Number(p.stock ?? p.quantity ?? 0);
              return (
                <Pressable
                  key={p.sku || p.id || idx}
                  onPress={() => router.push('/crm')}
                  style={{
                    backgroundColor: c.surface,
                    borderColor: c.border,
                    borderRadius: radius.md,
                    ...shadows.sm,
                  }}
                  className="w-56 p-4 border mr-3 justify-between active:opacity-80"
                >
                  <View>
                    <View className="flex-row items-center justify-between mb-2">
                      <StatusPill
                        label={inStock ? `${stockCount} in stock` : 'Out of stock'}
                        tone={inStock ? 'settled' : 'alert'}
                      />
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

                  <View
                    className="mt-4 pt-3 flex-row items-center justify-between border-t"
                    style={{ borderColor: c.border }}
                  >
                    <Text
                      style={{
                        color: c.textPrimary,
                        ...typography.tabularNums,
                      }}
                      className="font-extrabold text-base"
                    >
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
    </ScrollView>
  );
}
