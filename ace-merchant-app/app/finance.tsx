import React from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { CreditCard, Receipt } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { useFinanceData } from '../src/api/client';
import { colors, shadows } from '../theme';
import { ScreenHeader } from '../src/components/ScreenHeader';
import { LoadingScreen } from '../src/components/LoadingScreen';
import { EmptyState } from '../src/components/EmptyState';

export default function FinanceScreen() {
  const { data, isLoading } = useFinanceData();
  const { colorScheme } = useColorScheme();
  const c = colorScheme === 'dark' ? colors.dark : colors.light;

  if (isLoading) return <LoadingScreen />;

  const hasReconciliation = (data?.reconciliation || []).length > 0;
  const hasOutstanding = (data?.outstanding || []).length > 0;
  const hasMargins = (data?.margins || []).length > 0;

  return (
    <View style={{ backgroundColor: c.bg }} className="flex-1">
      <ScreenHeader title="Financial Dashboard" />

      <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Receivables hero */}
        <View style={{ backgroundColor: c.surface, borderColor: c.border, ...shadows.sm }} className="p-6 rounded-[24px] mb-4 border overflow-hidden relative">
          <View style={{ backgroundColor: c.accentSoft }} className="absolute -top-10 -right-10 w-32 h-32 rounded-full opacity-60" />
          <Text style={{ color: c.textSecondary }} className="text-sm font-medium mb-2">
            Total Outstanding Receivables
          </Text>
          <Text style={{ color: c.textPrimary }} className="text-4xl font-bold tracking-tight">
            ₦{data?.receivables_total?.toLocaleString() ?? '0'}
          </Text>
        </View>

        {/* Reconciliation */}
        <View style={{ backgroundColor: c.surface, borderColor: c.border, ...shadows.sm }} className="p-5 rounded-[24px] border mb-6">
          <Text style={{ color: c.textPrimary }} className="text-lg font-bold tracking-tight mb-4">
            Payment Reconciliation
          </Text>
          {!hasReconciliation ? (
            <Text style={{ color: c.textSecondary }}>No paid orders yet.</Text>
          ) : (
            data.reconciliation.map((rec: any, idx: number) => (
              <View
                key={idx}
                style={{ borderBottomColor: c.border, borderBottomWidth: idx === data.reconciliation.length - 1 ? 0 : 1 }}
                className="flex-row justify-between items-center py-3"
              >
                <View className="flex-row items-center">
                  <CreditCard size={16} color={c.accent} style={{ marginRight: 8 }} />
                  <Text style={{ color: c.textPrimary }} className="font-medium capitalize">
                    {rec.payment_method}
                  </Text>
                </View>
                <View className="items-end">
                  <Text style={{ color: c.success }} className="font-bold">
                    ₦{rec.total.toLocaleString()}
                  </Text>
                  <Text style={{ color: c.textSecondary }} className="text-xs">
                    {rec.count} transactions
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>

        {/* AI drafted follow-ups */}
        <View style={{ backgroundColor: c.surface, borderColor: c.border, ...shadows.sm }} className="p-5 rounded-[24px] border mb-6">
          <Text style={{ color: c.textPrimary }} className="text-lg font-bold tracking-tight mb-4">
            Pending Payments (AI Drafts)
          </Text>
          {!hasOutstanding ? (
            <Text style={{ color: c.textSecondary }}>No pending payments.</Text>
          ) : (
            data.outstanding.map((o: any, idx: number) => (
              <View key={idx} style={{ backgroundColor: c.surfaceAlt, borderColor: c.border }} className="mb-3 p-4 rounded-xl border">
                <View className="flex-row justify-between mb-2">
                  <Text style={{ color: c.textPrimary }} className="font-bold">
                    {o.name || 'Customer'}
                  </Text>
                  <Text style={{ color: c.warning }} className="font-bold">
                    ₦{o.total_amount}
                  </Text>
                </View>
                <Text style={{ color: c.textSecondary }} className="text-sm mb-3 italic">
                  "{o.draft_message}"
                </Text>
                <Pressable style={{ backgroundColor: c.accent }} className="py-2.5 rounded-lg items-center active:opacity-80">
                  <Text style={{ color: colorScheme === 'dark' ? '#090A0C' : '#FFFFFF' }} className="font-bold">
                    Send Reminder
                  </Text>
                </Pressable>
              </View>
            ))
          )}
        </View>

        {/* Margin analysis */}
        <View style={{ backgroundColor: c.surface, borderColor: c.border, ...shadows.sm }} className="p-5 rounded-[24px] border mb-6">
          <Text style={{ color: c.textPrimary }} className="text-lg font-bold tracking-tight mb-4">
            Margin Analysis
          </Text>
          {!hasMargins ? (
            <Text style={{ color: c.textSecondary }}>No products available for margin analysis.</Text>
          ) : (
            data.margins.map((m: any, idx: number) => (
              <View
                key={idx}
                style={{ borderBottomColor: c.border, borderBottomWidth: idx === data.margins.length - 1 ? 0 : 1 }}
                className="flex-row justify-between items-center py-3"
              >
                <Text style={{ color: c.textPrimary }} className="flex-1 mr-2" numberOfLines={1}>
                  {m.name}
                </Text>
                <View className="items-end">
                  <Text style={{ color: c.success }} className="font-bold">
                    ₦{Number(m.margin).toLocaleString()} profit
                  </Text>
                  <Text style={{ color: c.textSecondary }} className="text-xs">
                    Cost: ₦{Number(m.cost).toLocaleString()}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>

        {!hasReconciliation && !hasOutstanding && !hasMargins && (
          <EmptyState icon={Receipt} title="No financial activity yet" subtitle="Reconciliation, pending payments and margins will show up here once orders start coming in." />
        )}
      </ScrollView>
    </View>
  );
}
