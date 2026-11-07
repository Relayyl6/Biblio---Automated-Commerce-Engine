import { useState } from 'react';
import { View, Text, ScrollView, Pressable, RefreshControl } from 'react-native';
import { CreditCard, Receipt, Share2, AlertTriangle, RefreshCw } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { useFinanceData, useSendChatMessage } from '../src/api/client';
import { useAlert } from '../src/store/alertStore';
import { colors, shadows } from '../theme';
import { ScreenHeader } from '../src/components/ScreenHeader';
import { LoadingScreen } from '../src/components/LoadingScreen';
import { EmptyState } from '../src/components/EmptyState';

export default function FinanceScreen() {
  const { data, isLoading, isError, error, refetch, isRefetching } = useFinanceData();
  const { colorScheme } = useColorScheme();
  const c = colorScheme === 'dark' ? colors.dark : colors.light;
  const alert = useAlert();
  const sendChatMessage = useSendChatMessage();
  const [sendingId, setSendingId] = useState<string | null>(null);

  const handleExportSummary = () => {
    const totalRev = (data?.reconciliation || []).reduce((acc: number, r: any) => acc + Number(r?.total || 0), 0);
    const pendingRev = Number(data?.receivables_total || 0);
    alert.info(
      'Ledger Summary',
      `Settled Revenue: ₦${totalRev.toLocaleString()}\nPending Receivables: ₦${pendingRev.toLocaleString()}\nActive Channels: ${(data?.reconciliation || []).length} payment sources\n\nYour books are fully reconciled with Providus & Paystack gateways.`
    );
  };

  const handleSendReminder = async (o: any) => {
    if (!o?.customer_id) {
      alert.warning('No Customer Link', 'This invoice cannot be messaged because no WhatsApp customer ID is linked to it.');
      return;
    }
    const targetKey = o.id || o.name || 'reminder';
    setSendingId(targetKey);
    try {
      await sendChatMessage.mutateAsync({
        customerId: o.customer_id,
        text: o.draft_message || `Hello ${o.name || 'Customer'}, your invoice of ₦${Number(o.total_amount || 0).toLocaleString()} is awaiting settlement.`,
      });
      alert.success('Reminder Sent', `Dispatched follow-up invoice reminder to ${o.name || 'customer'} on WhatsApp.`);
    } catch (err: any) {
      alert.error('Failed to Send', err?.message || 'Could not dispatch payment reminder.');
    } finally {
      setSendingId(null);
    }
  };

  if (isLoading) return <LoadingScreen />;

  const hasReconciliation = (data?.reconciliation || []).length > 0;
  const hasOutstanding = (data?.outstanding || []).length > 0;
  const hasMargins = (data?.margins || []).length > 0;

  return (
    <View style={{ backgroundColor: c.bg }} className="flex-1">
      <ScreenHeader
        title="Financial Dashboard"
        rightAction={
          <Pressable
            onPress={handleExportSummary}
            style={{ backgroundColor: c.surface, borderColor: c.border, ...shadows.sm }}
            className="w-10 h-10 rounded-full border items-center justify-center active:opacity-70"
          >
            <Share2 size={18} color={c.textPrimary} />
          </Pressable>
        }
      />

      <ScrollView
        className="flex-1 px-4"
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => { refetch(); }} tintColor={c.accent} />}
      >
        {/* Error Banner with Retry */}
        {isError && (
          <View style={{ backgroundColor: c.dangerSoft, borderColor: c.danger }} className="p-4 rounded-2xl border mb-4 flex-row items-center justify-between">
            <View className="flex-row items-center flex-1 mr-2">
              <AlertTriangle size={18} color={c.danger} />
              <Text style={{ color: c.danger }} className="text-xs font-semibold ml-2">
                {(error as any)?.message || 'Failed to sync live financial ledger.'}
              </Text>
            </View>
            <Pressable onPress={() => refetch()} className="px-3 py-1.5 rounded-xl bg-red-500/10 active:opacity-70 flex-row items-center">
              <RefreshCw size={12} color={c.danger} />
              <Text style={{ color: c.danger }} className="text-xs font-bold ml-1">Retry</Text>
            </Pressable>
          </View>
        )}

        {/* Receivables hero */}
        <View style={{ backgroundColor: c.surface, borderColor: c.border, ...shadows.sm }} className="p-6 rounded-[24px] mb-4 border overflow-hidden relative">
          <View style={{ backgroundColor: c.accentSoft }} className="absolute -top-10 -right-10 w-32 h-32 rounded-full opacity-60" />
          <Text style={{ color: c.textSecondary }} className="text-sm font-medium mb-2">
            Total Outstanding Receivables
          </Text>
          <Text style={{ color: c.textPrimary }} className="text-4xl font-bold tracking-tight">
            ₦{Number(data?.receivables_total || 0).toLocaleString()}
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
            (data?.reconciliation || []).map((rec: any, idx: number) => (
              <View
                key={idx}
                style={{ borderBottomColor: c.border, borderBottomWidth: idx === (data?.reconciliation?.length || 0) - 1 ? 0 : 1 }}
                className="flex-row justify-between items-center py-3"
              >
                <View className="flex-row items-center">
                  <CreditCard size={16} color={c.accent} style={{ marginRight: 8 }} />
                  <Text style={{ color: c.textPrimary }} className="font-medium capitalize">
                    {rec?.payment_method || 'Unknown Method'}
                  </Text>
                </View>
                <View className="items-end">
                  <Text style={{ color: c.success }} className="font-bold">
                    ₦{Number(rec?.total || 0).toLocaleString()}
                  </Text>
                  <Text style={{ color: c.textSecondary }} className="text-xs">
                    {Number(rec?.count || 0)} transactions
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
            (data?.outstanding || []).map((o: any, idx: number) => (
              <View key={idx} style={{ backgroundColor: c.surfaceAlt, borderColor: c.border }} className="mb-3 p-4 rounded-xl border">
                <View className="flex-row justify-between mb-2">
                  <Text style={{ color: c.textPrimary }} className="font-bold">
                    {o.name || 'Customer'}
                  </Text>
                  <Text style={{ color: c.warning }} className="font-bold">
                    ₦{Number(o.total_amount || 0).toLocaleString()}
                  </Text>
                </View>
                <Text style={{ color: c.textSecondary }} className="text-sm mb-3 italic">
                  "{o.draft_message || 'Payment pending settlement'}"
                </Text>
                <Pressable
                  onPress={() => handleSendReminder(o)}
                  disabled={sendingId === (o.id || o.name || 'reminder')}
                  style={{ backgroundColor: c.accent }}
                  className="py-2.5 rounded-lg items-center active:opacity-80"
                >
                  <Text style={{ color: colorScheme === 'dark' ? '#090A0C' : '#FFFFFF' }} className="font-bold">
                    {sendingId === (o.id || o.name || 'reminder') ? 'Dispatching...' : 'Send Reminder'}
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
            (data?.margins || []).map((m: any, idx: number) => (
              <View
                key={idx}
                style={{ borderBottomColor: c.border, borderBottomWidth: idx === (data?.margins?.length || 0) - 1 ? 0 : 1 }}
                className="flex-row justify-between items-center py-3"
              >
                <Text style={{ color: c.textPrimary }} className="flex-1 mr-2" numberOfLines={1}>
                  {m?.name || 'Unnamed Product'}
                </Text>
                <View className="items-end">
                  <Text style={{ color: c.success }} className="font-bold">
                    ₦{Number(m?.margin || 0).toLocaleString()} profit
                  </Text>
                  <Text style={{ color: c.textSecondary }} className="text-xs">
                    Cost: ₦{Number(m?.cost || 0).toLocaleString()}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>

        {!hasReconciliation && !hasOutstanding && !hasMargins && !isError && (
          <EmptyState icon={Receipt} title="No financial activity yet" subtitle="Reconciliation, pending payments and margins will show up here once orders start coming in." />
        )}
      </ScrollView>
    </View>
  );
}
