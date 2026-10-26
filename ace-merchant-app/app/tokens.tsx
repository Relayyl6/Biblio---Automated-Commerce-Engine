import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, Modal, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useColorScheme } from 'nativewind';
import {
  Coins,
  TrendingUp,
  Zap,
  Sliders,
  AlertTriangle,
  CreditCard,
  CheckCircle2,
  PieChart,
  ArrowUpRight,
  ShieldAlert,
  ChevronRight,
  X,
} from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { colors, shadows } from '../theme';
import { ScreenHeader } from '../src/components/ScreenHeader';
import { useTokens, useUpdateSpendCaps, useTopUpTokens } from '../src/api/client';
import { useAuthStore } from '../src/store/authStore';
import { useAlert } from '../src/store/alertStore';
import { LoadingScreen } from '../src/components/LoadingScreen';
import { InlineLoadingDots } from '../src/components/PulsingSkeleton';

const TOP_UP_TIERS = [
  { naira: 2000, tokens: 20000, label: 'Starter Pack' },
  { naira: 5000, tokens: 50000, label: 'Growth Pack', popular: true },
  { naira: 10000, tokens: 100000, label: 'High Volume' },
  { naira: 25000, tokens: 250000, label: 'Enterprise' },
];

export default function TokensScreen() {
  const router = useRouter();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const c = isDark ? colors.dark : colors.light;
  const merchantId = useAuthStore(state => state.merchantId);
  const alert = useAlert();

  const { data: tokenData, isLoading, refetch } = useTokens(merchantId || '');
  const updateCapsMutation = useUpdateSpendCaps();
  const topUpMutation = useTopUpTokens();

  const [showCapsModal, setShowCapsModal] = useState(false);
  const [showTopUpModal, setShowTopUpModal] = useState(false);
  const [dailyCapInput, setDailyCapInput] = useState('');
  const [monthlyCapInput, setMonthlyCapInput] = useState('');
  const [customTopUp, setCustomTopUp] = useState('');

  if (isLoading) return <LoadingScreen />;

  const balanceTokens = tokenData?.balance_tokens ?? 50000;
  const balanceNaira = tokenData?.balance_naira ?? 5000;
  const dailyCap = tokenData?.daily_cap ?? 15000;
  const monthlyCap = tokenData?.monthly_cap ?? 100000;
  const spentToday = tokenData?.spent_today ?? 0;
  const spentMonth = tokenData?.spent_month ?? 0;
  const burnRate7d = tokenData?.burn_rate_7d ?? 0;
  const usageBreakdown = tokenData?.usage_breakdown ?? [];

  // Threshold warning calculations
  const monthlyPercentageUsed = monthlyCap > 0 ? (spentMonth / monthlyCap) * 100 : 0;
  const isLowBalance = balanceNaira < 1500;
  const isCriticalBalance = balanceNaira < 500;

  const handleOpenCaps = () => {
    setDailyCapInput(String(dailyCap));
    setMonthlyCapInput(String(monthlyCap));
    setShowCapsModal(true);
  };

  const handleSaveCaps = async () => {
    const daily = Number(dailyCapInput);
    const monthly = Number(monthlyCapInput);
    if (isNaN(daily) || isNaN(monthly) || daily <= 0 || monthly <= 0) {
      alert.warning('Invalid Limit', 'Please enter valid numerical amounts in Naira.');
      return;
    }
    try {
      await updateCapsMutation.mutateAsync({
        merchantId: merchantId || '',
        dailyCap: daily,
        monthlyCap: monthly,
      });
      setShowCapsModal(false);
      alert.success('Limits Saved', 'Daily and monthly autonomous spend limits updated.');
    } catch (e: any) {
      alert.error('Update Failed', e?.message || 'Could not save spend caps.');
    }
  };

  const handleSelectTopUp = async (tier: typeof TOP_UP_TIERS[0]) => {
    try {
      await topUpMutation.mutateAsync({
        merchantId: merchantId || '',
        amountNaira: tier.naira,
      });
      setShowTopUpModal(false);
      alert.success('Tokens Credited', `+${tier.tokens.toLocaleString()} tokens (₦${tier.naira.toLocaleString()}) added to your store balance.`);
    } catch (e: any) {
      alert.error('Top-Up Error', e?.message || 'Could not complete token top-up.');
    }
  };

  const handleCustomTopUp = async () => {
    const num = Number(customTopUp);
    if (isNaN(num) || num < 500) {
      alert.warning('Minimum Amount', 'Minimum top-up is ₦500.');
      return;
    }
    try {
      await topUpMutation.mutateAsync({
        merchantId: merchantId || '',
        amountNaira: num,
      });
      setShowTopUpModal(false);
      setCustomTopUp('');
      alert.success('Tokens Credited', `+${(num * 10).toLocaleString()} tokens added to your balance.`);
    } catch (e: any) {
      alert.error('Top-Up Error', e?.message || 'Could not process custom top-up.');
    }
  };

  return (
    <View style={{ backgroundColor: c.bg }} className="flex-1">
      <ScreenHeader
        title="Token & Compute Ledger"
        rightAction={
          <Pressable
            onPress={handleOpenCaps}
            style={{ backgroundColor: c.surface, borderColor: c.border, ...shadows.sm }}
            className="w-10 h-10 rounded-full border items-center justify-center active:opacity-70"
          >
            <Sliders size={18} color={c.textPrimary} />
          </Pressable>
        }
      />

      <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingBottom: 120 }}>
        {/* Low balance alert banner */}
        {(isLowBalance || isCriticalBalance) && (
          <Animated.View entering={FadeInDown.springify()} className="mb-4">
            <View
              style={{
                backgroundColor: isCriticalBalance ? c.dangerSoft : c.warningSoft,
                borderColor: isCriticalBalance ? c.danger : c.warning,
              }}
              className="p-4 rounded-2xl border flex-row items-center"
            >
              <AlertTriangle size={20} color={isCriticalBalance ? c.danger : c.warning} />
              <View className="flex-1 ml-3">
                <Text style={{ color: isCriticalBalance ? c.danger : c.warning }} className="font-bold text-sm">
                  {isCriticalBalance ? 'Critical Balance (<5%)' : 'Low Compute Balance (<15%)'}
                </Text>
                <Text style={{ color: c.textSecondary }} className="text-xs mt-0.5 leading-tight">
                  {isCriticalBalance
                    ? 'AI autonomous replies will pause if compute tokens run out.'
                    : 'Top up now to avoid interruption in autonomous customer negotiations.'}
                </Text>
              </View>
              <Pressable
                onPress={() => setShowTopUpModal(true)}
                style={{ backgroundColor: isCriticalBalance ? c.danger : c.warning }}
                className="px-3 py-1.5 rounded-full"
              >
                <Text className="text-white text-xs font-bold">Top Up</Text>
              </Pressable>
            </View>
          </Animated.View>
        )}

        {/* Hero Token Card */}
        <Animated.View entering={FadeInDown.delay(60).springify()}>
          <View style={{ backgroundColor: c.surface, borderColor: c.border, ...shadows.sm }} className="p-6 rounded-[28px] border mb-4 relative overflow-hidden">
            <View style={{ backgroundColor: c.accentSoft }} className="absolute -top-12 -right-12 w-36 h-36 rounded-full opacity-60" />
            <View className="flex-row items-center justify-between mb-2">
              <View className="flex-row items-center">
                <View style={{ backgroundColor: c.accentSoft }} className="w-8 h-8 rounded-full items-center justify-center mr-2">
                  <Coins size={16} color={c.accent} />
                </View>
                <Text style={{ color: c.textSecondary }} className="text-xs font-bold uppercase tracking-wider">
                  Available Compute Balance
                </Text>
              </View>
              <View style={{ backgroundColor: c.successSoft }} className="px-2.5 py-1 rounded-full">
                <Text style={{ color: c.success }} className="text-[10px] font-bold">Active</Text>
              </View>
            </View>

            <View className="my-2">
              <Text style={{ color: c.textPrimary }} className="text-4xl font-extrabold tracking-tight">
                {balanceTokens.toLocaleString()}
                <Text style={{ color: c.textTertiary }} className="text-xl font-normal"> tokens</Text>
              </Text>
              <Text style={{ color: c.accent }} className="text-base font-bold mt-1">
                ≈ ₦{balanceNaira.toLocaleString()} compute equity
              </Text>
            </View>

            <View className="flex-row gap-3 mt-4 pt-4 border-t" style={{ borderColor: c.border }}>
              <Pressable
                onPress={() => setShowTopUpModal(true)}
                style={{ backgroundColor: c.accent }}
                className="flex-1 py-3 rounded-2xl items-center flex-row justify-center active:opacity-85"
              >
                <Zap size={16} color={isDark ? '#090A0C' : '#FFFFFF'} style={{ marginRight: 6 }} />
                <Text style={{ color: isDark ? '#090A0C' : '#FFFFFF' }} className="font-bold text-sm">
                  Top Up Compute
                </Text>
              </Pressable>

              <Pressable
                onPress={handleOpenCaps}
                style={{ backgroundColor: c.surfaceAlt, borderColor: c.border }}
                className="px-4 py-3 rounded-2xl border items-center justify-center active:opacity-75"
              >
                <Sliders size={18} color={c.textPrimary} />
              </Pressable>
            </View>
          </View>
        </Animated.View>

        {/* Burn Rate & Velocity */}
        <Animated.View entering={FadeInDown.delay(100).springify()}>
          <View style={{ backgroundColor: c.surface, borderColor: c.border, ...shadows.sm }} className="p-5 rounded-[24px] border mb-4">
            <Text style={{ color: c.textPrimary }} className="text-base font-bold mb-3">
              Burn Rate & Velocity
            </Text>

            <View className="flex-row justify-between items-center mb-3">
              <View>
                <Text style={{ color: c.textSecondary }} className="text-xs">7-Day Burn Rate</Text>
                <Text style={{ color: c.textPrimary }} className="text-xl font-bold mt-0.5">
                  ₦{burnRate7d.toLocaleString()}
                  <Text style={{ color: c.textTertiary }} className="text-xs font-normal">/wk</Text>
                </Text>
              </View>
              <View className="items-end">
                <Text style={{ color: c.textSecondary }} className="text-xs">Monthly Spend</Text>
                <Text style={{ color: c.textPrimary }} className="text-xl font-bold mt-0.5">
                  ₦{spentMonth.toLocaleString()}
                  <Text style={{ color: c.textTertiary }} className="text-xs font-normal"> / ₦{monthlyCap.toLocaleString()}</Text>
                </Text>
              </View>
            </View>

            {/* Progress bar */}
            <View style={{ backgroundColor: c.surfaceAlt }} className="h-2 rounded-full overflow-hidden mb-2">
              <View
                style={{
                  backgroundColor: monthlyPercentageUsed > 90 ? c.danger : monthlyPercentageUsed > 75 ? c.warning : c.accent,
                  width: `${Math.min(100, Math.max(5, monthlyPercentageUsed))}%`,
                  height: '100%',
                }}
              />
            </View>
            <Text style={{ color: c.textTertiary }} className="text-[11px]">
              {monthlyPercentageUsed.toFixed(1)}% of your ₦{monthlyCap.toLocaleString()} monthly safety cap used.
            </Text>
          </View>
        </Animated.View>

        {/* Feature Usage Breakdown */}
        <Animated.View entering={FadeInDown.delay(140).springify()}>
          <View style={{ backgroundColor: c.surface, borderColor: c.border, ...shadows.sm }} className="p-5 rounded-[24px] border mb-6">
            <View className="flex-row items-center justify-between mb-4">
              <Text style={{ color: c.textPrimary }} className="text-base font-bold">
                Compute by Feature
              </Text>
              <PieChart size={18} color={c.textTertiary} />
            </View>

            {usageBreakdown.length === 0 ? (
              <View className="py-6 items-center">
                <Text style={{ color: c.textSecondary }} className="text-xs text-center leading-relaxed">
                  No compute events recorded yet. As Biblio negotiates on WhatsApp, extracts catalogue items, and transcribes voice notes, usage metrics will populate here in real-time.
                </Text>
              </View>
            ) : (
              usageBreakdown.map((item, idx) => (
                <View
                  key={idx}
                  style={{
                    borderBottomColor: c.border,
                    borderBottomWidth: idx === usageBreakdown.length - 1 ? 0 : 1,
                  }}
                  className="py-3 flex-row items-center justify-between"
                >
                  <View className="flex-1 pr-3">
                    <Text style={{ color: c.textPrimary }} className="font-semibold text-sm">
                      {item.feature}
                    </Text>
                    <Text style={{ color: c.textSecondary }} className="text-xs mt-0.5">
                      {item.tokens.toLocaleString()} tokens ({item.percentage}%)
                    </Text>
                  </View>
                  <Text style={{ color: c.textPrimary }} className="font-bold text-sm">
                    ₦{item.naira.toLocaleString()}
                  </Text>
                </View>
              ))
            )}
          </View>
        </Animated.View>
      </ScrollView>

      {/* Spend Caps Modal */}
      <Modal visible={showCapsModal} animationType="slide" transparent>
        <View className="flex-1 justify-end bg-black/60">
          <View style={{ backgroundColor: c.surface }} className="p-6 rounded-t-[32px]">
            <View className="flex-row justify-between items-center mb-4">
              <Text style={{ color: c.textPrimary }} className="text-lg font-bold">
                Spend Cap Controls
              </Text>
              <Pressable onPress={() => setShowCapsModal(false)} hitSlop={10}>
                <X size={20} color={c.textSecondary} />
              </Pressable>
            </View>

            <Text style={{ color: c.textSecondary }} className="text-xs mb-4 leading-relaxed">
              Hard limits stop autonomous actions if reached. Soft limits trigger warning notifications to your phone.
            </Text>

            <Text style={{ color: c.textSecondary }} className="text-xs font-bold uppercase mb-1">
              Daily Hard Cap (₦)
            </Text>
            <TextInput
              style={{ backgroundColor: c.surfaceAlt, color: c.textPrimary, borderColor: c.border }}
              className="border rounded-2xl p-3.5 mb-4 text-base font-semibold"
              keyboardType="numeric"
              value={dailyCapInput}
              onChangeText={setDailyCapInput}
              placeholder="15000"
              placeholderTextColor={c.textTertiary}
            />

            <Text style={{ color: c.textSecondary }} className="text-xs font-bold uppercase mb-1">
              Monthly Safety Cap (₦)
            </Text>
            <TextInput
              style={{ backgroundColor: c.surfaceAlt, color: c.textPrimary, borderColor: c.border }}
              className="border rounded-2xl p-3.5 mb-6 text-base font-semibold"
              keyboardType="numeric"
              value={monthlyCapInput}
              onChangeText={setMonthlyCapInput}
              placeholder="100000"
              placeholderTextColor={c.textTertiary}
            />

            <Pressable
              onPress={handleSaveCaps}
              disabled={updateCapsMutation.isPending}
              style={{ backgroundColor: c.accent }}
              className="py-3.5 rounded-2xl items-center"
            >
              {updateCapsMutation.isPending ? (
                <InlineLoadingDots color={isDark ? '#090A0C' : '#FFFFFF'} />
              ) : (
                <Text style={{ color: isDark ? '#090A0C' : '#FFFFFF' }} className="font-bold text-base">
                  Save Spend Caps
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Top Up Modal */}
      <Modal visible={showTopUpModal} animationType="slide" transparent>
        <View className="flex-1 justify-end bg-black/60">
          <View style={{ backgroundColor: c.surface }} className="p-6 rounded-t-[32px]">
            <View className="flex-row justify-between items-center mb-4">
              <Text style={{ color: c.textPrimary }} className="text-lg font-bold">
                Top Up Compute Tokens
              </Text>
              <Pressable onPress={() => setShowTopUpModal(false)} hitSlop={10}>
                <X size={20} color={c.textSecondary} />
              </Pressable>
            </View>

            <Text style={{ color: c.textSecondary }} className="text-xs mb-4">
              1 Token = ₦0.10. Tokens never expire and apply across all channels.
            </Text>

            <View className="gap-2.5 mb-4">
              {TOP_UP_TIERS.map((tier, idx) => (
                <Pressable
                  key={idx}
                  onPress={() => handleSelectTopUp(tier)}
                  disabled={topUpMutation.isPending}
                  style={{
                    backgroundColor: tier.popular ? (isDark ? '#1E293B' : '#EFF6FF') : c.surfaceAlt,
                    borderColor: tier.popular ? c.accent : c.border,
                  }}
                  className="p-4 rounded-2xl border flex-row items-center justify-between active:opacity-75"
                >
                  <View>
                    <View className="flex-row items-center">
                      <Text style={{ color: c.textPrimary }} className="font-bold text-base">
                        ₦{tier.naira.toLocaleString()}
                      </Text>
                      {tier.popular && (
                        <View style={{ backgroundColor: c.accent }} className="px-2 py-0.5 rounded-full ml-2">
                          <Text style={{ color: isDark ? '#090A0C' : '#FFFFFF' }} className="text-[10px] font-bold">
                            Popular
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text style={{ color: c.textSecondary }} className="text-xs mt-0.5">
                      +{tier.tokens.toLocaleString()} Compute Tokens ({tier.label})
                    </Text>
                  </View>
                  <ArrowUpRight size={18} color={c.accent} />
                </Pressable>
              ))}
            </View>

            <View className="flex-row gap-2 mt-2">
              <TextInput
                style={{ backgroundColor: c.surfaceAlt, color: c.textPrimary, borderColor: c.border }}
                className="flex-1 border rounded-2xl p-3 text-sm font-semibold"
                keyboardType="numeric"
                value={customTopUp}
                onChangeText={setCustomTopUp}
                placeholder="Custom Naira amount"
                placeholderTextColor={c.textTertiary}
              />
              <Pressable
                onPress={handleCustomTopUp}
                disabled={topUpMutation.isPending || !customTopUp}
                style={{ backgroundColor: c.accent }}
                className="px-5 rounded-2xl items-center justify-center"
              >
                <Text style={{ color: isDark ? '#090A0C' : '#FFFFFF' }} className="font-bold text-sm">
                  Add
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
