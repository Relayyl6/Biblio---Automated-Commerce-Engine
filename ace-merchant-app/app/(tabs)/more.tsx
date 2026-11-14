import React, { useState } from 'react';
import { View, Text, StatusBar, Pressable, ScrollView, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import {
  CreditCard,
  Users,
  ChevronRight,
  Package,
  Bell,
  History,
  HelpCircle,
  Settings,
  LogOut,
  Building2,
  Sparkles,
  CheckCircle2,
  Bot,
  ShieldCheck,
  RefreshCw,
  Coins,
  ShieldAlert,
  Camera,
  Video,
  Tv,
} from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { colors, radius, shadows } from '../../theme';
import { usePairWhatsApp, useMerchantConfig, useStatusSettings, useVendorStatus } from '../../src/api/client';
import { useAuthStore } from '../../src/store/authStore';
import { useAlert } from '../../src/store/alertStore';
import { InlineLoadingDots } from '../../src/components/PulsingSkeleton';
import { safeHaptics, normalizePhoneNumber } from '../../src/utils/sanitizers';

type MenuItem = {
  id: string;
  title: string;
  subtitle: string;
  icon: any;
  route: string;
  semantic: 'signal' | 'accent' | 'review' | 'settled' | 'textSecondary';
};

const WORKSPACE_ITEMS: MenuItem[] = [
  { id: 'biblio-assistant', title: 'Biblio Assistant', subtitle: 'Live autonomous AI chat & WhatsApp parity', icon: Bot, route: '/biblio-assistant', semantic: 'signal' },
  { id: 'tokens', title: 'Tokens & Spend Caps', subtitle: 'Compute balance, burn velocity & top-ups', icon: Coins, route: '/tokens', semantic: 'accent' },
  { id: 'veto', title: 'Veto & Operator Override', subtitle: 'Six-layer safety guardrails & hold queue', icon: ShieldAlert, route: '/veto', semantic: 'review' },
  { id: 'finance', title: 'Finance & Margins', subtitle: 'Real-time revenue, escrow & payment follow-ups', icon: CreditCard, route: '/finance', semantic: 'settled' },
  { id: 'crm', title: 'CRM & Inventory', subtitle: 'Stock levels, floor pricing & product sync', icon: Package, route: '/crm', semantic: 'accent' },
  { id: 'suppliers', title: 'Suppliers & Restock', subtitle: 'Automated procurement channels & groups', icon: Users, route: '/suppliers', semantic: 'accent' },
  { id: 'notifications', title: 'Notifications', subtitle: 'Push alerts, channels & quiet hours', icon: Bell, route: '/notifications', semantic: 'signal' },
  { id: 'notification-history', title: 'Carrier Logs', subtitle: 'WhatsApp & SMS delivery audit trail', icon: History, route: '/notification-history', semantic: 'textSecondary' },
  { id: 'settings', title: 'Store & Brain Settings', subtitle: 'Store profile, warehouse, autonomy & policies', icon: Settings, route: '/settings', semantic: 'accent' },
  { id: 'support', title: 'Help & Support', subtitle: 'Knowledge base, status & live tickets', icon: HelpCircle, route: '/support', semantic: 'settled' },
];

function MenuRow({ item, index, c }: { item: MenuItem; index: number; c: typeof colors.light }) {
  const router = useRouter();
  const Icon = item.icon;
  const colorMap = {
    signal: c.signal,
    accent: c.accent,
    review: c.review,
    settled: c.settled,
    textSecondary: c.textSecondary,
  };
  const tint = colorMap[item.semantic] || c.accent;

  return (
    <Animated.View entering={FadeInDown.delay(130 + index * 40).springify()}>
      <Pressable
        onPress={() => {
          safeHaptics.impact();
          router.push(item.route as any);
        }}
        style={{
          backgroundColor: c.surface,
          borderColor: c.border,
          borderRadius: radius.md,
          ...shadows.sm,
        }}
        className="p-4 mb-3 border flex-row items-center active:opacity-70"
      >
        <View
          style={{ backgroundColor: tint + '1A' }}
          className="w-12 h-12 rounded-2xl items-center justify-center mr-4"
        >
          <Icon size={22} color={tint} />
        </View>
        <View className="flex-1">
          <Text style={{ color: c.textPrimary }} className="font-bold text-base mb-0.5">
            {item.title}
          </Text>
          <Text style={{ color: c.textSecondary }} className="text-xs">
            {item.subtitle}
          </Text>
        </View>
        <ChevronRight size={18} color={c.textTertiary} />
      </Pressable>
    </Animated.View>
  );
}

export default function MoreScreen() {
  const router = useRouter();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const c = isDark ? colors.dark : colors.light;
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const alert = useAlert();
  const logout = useAuthStore(state => state.logout);
  const merchantId = useAuthStore(state => state.merchantId);
  const { data: merchantConfig } = useMerchantConfig();
  const { data: statusSettings } = useStatusSettings();
  const { data: vendorStatus } = useVendorStatus();

  const [showPairing, setShowPairing] = useState(false);
  const [phoneToPair, setPhoneToPair] = useState('');
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [pairingSecondsLeft, setPairingSecondsLeft] = useState(120);
  const pairMutation = usePairWhatsApp();

  const isWhatsAppConnected =
    statusSettings?.settings?.session_status === 'connected' ||
    vendorStatus?.dbStatus === 'connected' ||
    vendorStatus?.connected === true;

  // Auto-dismiss code when pairing completes
  React.useEffect(() => {
    if (isWhatsAppConnected && pairingCode) {
      setPairingCode(null);
      alert.success('WhatsApp Connected', 'Your business line is now active and monitored 24/7 by Biblio.');
    }
  }, [isWhatsAppConnected, pairingCode]);

  // 120-second pairing countdown timer
  React.useEffect(() => {
    if (!pairingCode) return;
    setPairingSecondsLeft(120);
    const interval = setInterval(() => {
      setPairingSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [pairingCode]);

  const connectedPhoneNumber =
    vendorStatus?.businessLineNumber ||
    statusSettings?.settings?.business_line_number ||
    (isWhatsAppConnected ? merchantConfig?.phone_number_id : null);

  React.useEffect(() => {
    if (!phoneToPair && merchantConfig?.phone_number_id) {
      setPhoneToPair(merchantConfig.phone_number_id.replace(/^\+/, ''));
    }
  }, [merchantConfig?.phone_number_id]);

  const storeName = merchantConfig?.name || 'Your Store';
  const storeDialect = merchantConfig?.dialect ? `${merchantConfig.dialect.charAt(0).toUpperCase() + merchantConfig.dialect.slice(1)} Pidgin` : 'Mixed Pidgin';

  const handlePair = async () => {
    if (!phoneToPair) return;
    const cleanPhone = normalizePhoneNumber(phoneToPair);
    if (!cleanPhone) {
      alert.warning('Invalid Phone Number', 'Please enter a valid phone number for WhatsApp pairing.');
      return;
    }
    try {
      const res = await pairMutation.mutateAsync(cleanPhone);
      if (res.code) {
        setPairingCode(res.code);
        queryClient.invalidateQueries({ queryKey: ['vendorStatus', merchantId] });
      }
    } catch (e: any) {
      alert.error('Pairing Error', e?.message || 'Could not initiate WhatsApp device pairing.');
    }
  };

  const handleWaitlist = (channel: string) => {
    safeHaptics.notification();
    alert.info(
      `${channel} Waitlist`,
      `Your store is enrolled in the early access beta for ${channel}. We will notify you via push and WhatsApp when automated indexing is active.`
    );
  };

  const handleSignOut = () => {
    alert.showConfirm({
      title: 'Sign Out',
      message: 'Are you sure you want to disconnect this device from your Biblio merchant account?',
      confirmLabel: 'Sign Out',
      destructive: true,
      onConfirm: () => {
        logout();
        router.replace('/login');
      },
    });
  };

  return (
    <View
      style={{
        backgroundColor: c.bg,
        paddingTop: Math.max(insets.top, StatusBar.currentHeight || 0) + 2,
      }}
      className="flex-1"
    >
      {/* Merchant Profile Header */}
      <Animated.View entering={FadeInDown.delay(100).springify()} className="px-4 mb-3">
        <Pressable
          onPress={() => router.push('/settings')}
          style={{
            backgroundColor: c.surface,
            borderColor: c.border,
            borderRadius: radius.md,
            ...shadows.sm,
          }}
          className="p-4 border flex-row items-center active:opacity-70"
        >
          <View
            style={{ backgroundColor: c.accentSoft }}
            className="w-12 h-12 rounded-full items-center justify-center mr-3"
          >
            <Text style={{ color: c.accent }} className="font-extrabold text-lg">
              {storeName.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View className="flex-1">
            <View className="flex-row items-center">
              <Text style={{ color: c.textPrimary }} className="font-bold text-base mr-1.5" numberOfLines={1}>
                {storeName}
              </Text>
              <CheckCircle2 size={15} color={c.settled} />
            </View>
            <Text style={{ color: c.textSecondary }} className="text-xs mt-0.5">
              {storeDialect} • Tap to edit store profile & settings
            </Text>
          </View>
          <ChevronRight size={16} color={c.textTertiary} />
        </Pressable>
      </Animated.View>

      <ScrollView className="flex-1 px-4" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        <Text style={{ color: c.textTertiary }} className="px-2 text-xs font-bold uppercase tracking-wider mb-3">
          Connections
        </Text>

        <Animated.View entering={FadeInDown.delay(115).springify()} className="mb-4">
          <Pressable
            onPress={() => setShowPairing(!showPairing)}
            style={{
              backgroundColor: isWhatsAppConnected ? c.settledTint : c.accentTint,
              borderColor: isWhatsAppConnected ? c.settled : c.accent,
              borderRadius: radius.md,
            }}
            className="p-4 border active:opacity-70"
          >
            <View className="flex-row items-center">
              <View className="flex-1">
                <View className="flex-row items-center">
                  <Text style={{ color: c.textPrimary }} className="font-bold text-sm mr-2">
                    WhatsApp Companion Linking
                  </Text>
                  {isWhatsAppConnected && <ShieldCheck size={14} color={c.settled} />}
                </View>
                <Text style={{ color: c.textSecondary }} className="text-xs mt-0.5">
                  {isWhatsAppConnected
                    ? `Linked: +${connectedPhoneNumber || 'Active'} • 24/7 background session`
                    : 'Not Linked • Tap to link your WhatsApp phone'}
                </Text>
              </View>
              {!showPairing && (
                <View
                  style={{
                    backgroundColor: isWhatsAppConnected ? c.settled : c.accent,
                    borderRadius: radius.pill,
                  }}
                  className="px-3 py-1.5 flex-row items-center"
                >
                  <Text style={{ color: '#FFFFFF' }} className="font-bold text-xs">
                    {isWhatsAppConnected ? 'Live & Persistent' : 'Link Phone'}
                  </Text>
                </View>
              )}
            </View>

            {showPairing && (
              <View className="mt-4 pt-4 border-t" style={{ borderColor: c.border }}>
                {isWhatsAppConnected && (
                  <View style={{ backgroundColor: c.surface, borderColor: c.border, borderRadius: radius.sm }} className="p-3.5 border mb-3">
                    <View className="flex-row items-center justify-between mb-1.5">
                      <Text style={{ color: c.textPrimary }} className="font-bold text-xs">
                        Persistent Background Session
                      </Text>
                      <View className="flex-row items-center">
                        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c.settled, marginRight: 4 }} />
                        <Text style={{ color: c.settled }} className="font-bold text-[10px] uppercase">
                          Durable (PostgreSQL)
                        </Text>
                      </View>
                    </View>
                    <Text style={{ color: c.textSecondary }} className="text-xs leading-relaxed">
                      Your WhatsApp session is stored in PostgreSQL and managed 24/7 by the Baileys server daemon. Exiting or closing the mobile app will not terminate customer negotiations or incoming order alerts.
                    </Text>
                    {connectedPhoneNumber && (
                      <Text style={{ color: c.accent }} className="font-bold text-xs mt-2">
                        Active WhatsApp Line: +{connectedPhoneNumber}
                      </Text>
                    )}
                  </View>
                )}

                {/* Live Error Banner if session failed */}
                {vendorStatus?.lastError && !isWhatsAppConnected && (
                  <View style={{ backgroundColor: c.alertTint, borderColor: c.alert, borderRadius: radius.sm }} className="p-3 border mb-3 flex-row items-center justify-between">
                    <View className="flex-1 mr-2">
                      <Text style={{ color: c.alert }} className="font-bold text-xs">
                        WhatsApp Link Notice
                      </Text>
                      <Text style={{ color: c.alert }} className="text-[11px] mt-0.5">
                        {vendorStatus.lastError}
                      </Text>
                    </View>
                    <Pressable
                      onPress={handlePair}
                      style={{ backgroundColor: c.alert, borderRadius: radius.sm }}
                      className="px-2.5 py-1.5 active:opacity-70"
                    >
                      <Text className="text-white text-[10px] font-bold">Retry</Text>
                    </Pressable>
                  </View>
                )}

                {!pairingCode ? (
                  <>
                    <Text style={{ color: c.textSecondary }} className="text-xs mb-2">
                      {isWhatsAppConnected
                        ? 'Want to switch or re-pair another WhatsApp number? Enter it below:'
                        : 'Enter the phone number active on your WhatsApp (e.g. 2348012345678):'}
                    </Text>
                    <TextInput
                      style={{ backgroundColor: c.wellBg, color: c.textPrimary, borderColor: c.border, borderRadius: radius.sm }}
                      className="border p-3 mb-3 font-semibold"
                      placeholder="234..."
                      placeholderTextColor={c.textTertiary}
                      value={phoneToPair}
                      onChangeText={setPhoneToPair}
                      keyboardType="phone-pad"
                    />
                    <Pressable
                      onPress={handlePair}
                      disabled={pairMutation.isPending}
                      style={{ backgroundColor: c.accent, borderRadius: radius.pill }}
                      className="h-12 items-center flex-row justify-center active:opacity-80"
                    >
                      {pairMutation.isPending ? (
                        <InlineLoadingDots color="white" />
                      ) : (
                        <Text className="text-white font-bold">
                          {isWhatsAppConnected ? 'Generate Re-Pairing Code' : 'Get Pairing Code'}
                        </Text>
                      )}
                    </Pressable>
                    {pairMutation.isError && (
                      <Text style={{ color: c.alert }} className="text-xs mt-2 text-center">
                        Failed to get code. Ensure backend gateway is running.
                      </Text>
                    )}
                  </>
                ) : (
                  <View className="items-center py-2">
                    <Text style={{ color: c.textSecondary }} className="text-sm mb-2 text-center font-medium">
                      Open WhatsApp → Settings → Linked Devices → Link a Device → Link with Phone Number.
                    </Text>

                    <View style={{ backgroundColor: c.surface, borderColor: c.border, borderRadius: radius.md }} className="px-5 py-4 border mb-2 items-center">
                      <Text style={{ color: c.textPrimary, letterSpacing: 8 }} className="text-3xl font-black">
                        {pairingCode}
                      </Text>
                      <View className="flex-row items-center mt-2">
                        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: pairingSecondsLeft > 20 ? c.settled : c.alert, marginRight: 5 }} />
                        <Text style={{ color: pairingSecondsLeft > 20 ? c.textSecondary : c.alert }} className="text-xs font-semibold">
                          {pairingSecondsLeft > 0 ? `Code expires in ${Math.floor(pairingSecondsLeft / 60)}:${(pairingSecondsLeft % 60).toString().padStart(2, '0')}` : 'Pairing code expired'}
                        </Text>
                      </View>
                    </View>

                    <Text style={{ color: c.textTertiary }} className="text-xs text-center mb-3">
                      Once entered on your phone, Biblio automatically finalizes the connection and persists credentials.
                    </Text>

                    <View className="flex-row gap-2 w-full justify-center">
                      <Pressable
                        onPress={handlePair}
                        disabled={pairMutation.isPending}
                        style={{ backgroundColor: c.accent, borderRadius: radius.pill }}
                        className="px-4 py-2.5 active:opacity-80 flex-row items-center"
                      >
                        {pairMutation.isPending ? (
                          <InlineLoadingDots color="white" />
                        ) : (
                          <Text className="text-white font-bold text-xs">Regenerate Fresh Code</Text>
                        )}
                      </Pressable>
                      <Pressable
                        onPress={() => setPairingCode(null)}
                        style={{ backgroundColor: c.surfaceAlt, borderColor: c.border, borderRadius: radius.pill }}
                        className="px-4 py-2.5 border active:opacity-80"
                      >
                        <Text style={{ color: c.textSecondary }} className="font-semibold text-xs">Cancel</Text>
                      </Pressable>
                    </View>
                  </View>
                )}
              </View>
            )}
          </Pressable>
        </Animated.View>

        {/* Coming Soon integrations */}
        <Animated.View entering={FadeInDown.delay(125).springify()} className="mb-3">
          <Pressable
            onPress={() => handleWaitlist('Instagram DMs')}
            style={{ backgroundColor: c.surface, borderColor: c.border, borderRadius: radius.md, opacity: 0.9 }}
            className="p-4 border flex-row items-center active:opacity-60"
          >
            <View style={{ backgroundColor: c.accentSoft }} className="w-10 h-10 rounded-xl items-center justify-center mr-3">
              <Camera size={20} color={c.accent} />
            </View>
            <View className="flex-1">
              <Text style={{ color: c.textPrimary }} className="font-bold text-sm">Instagram DMs</Text>
              <Text style={{ color: c.textSecondary }} className="text-xs mt-0.5">Automate IG comments & messages</Text>
            </View>
            <View style={{ backgroundColor: c.surfaceAlt, borderRadius: radius.xs }} className="px-2.5 py-1">
              <Text style={{ color: c.textTertiary }} className="text-[10px] font-bold uppercase">Early Access</Text>
            </View>
          </Pressable>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(135).springify()} className="mb-3">
          <Pressable
            onPress={() => handleWaitlist('TikTok Shop')}
            style={{ backgroundColor: c.surface, borderColor: c.border, borderRadius: radius.md, opacity: 0.9 }}
            className="p-4 border flex-row items-center active:opacity-60"
          >
            <View style={{ backgroundColor: c.signalTint }} className="w-10 h-10 rounded-xl items-center justify-center mr-3">
              <Video size={20} color={c.signal} />
            </View>
            <View className="flex-1">
              <Text style={{ color: c.textPrimary }} className="font-bold text-sm">TikTok Shop</Text>
              <Text style={{ color: c.textSecondary }} className="text-xs mt-0.5">Sync inventory and orders</Text>
            </View>
            <View style={{ backgroundColor: c.surfaceAlt, borderRadius: radius.xs }} className="px-2.5 py-1">
              <Text style={{ color: c.textTertiary }} className="text-[10px] font-bold uppercase">Early Access</Text>
            </View>
          </Pressable>
        </Animated.View>

        <Text style={{ color: c.textTertiary }} className="px-2 text-xs font-bold uppercase tracking-wider mb-3 mt-3">
          Workspace
        </Text>
        {WORKSPACE_ITEMS.map((item, i) => (
          <MenuRow key={item.id} item={item} index={i} c={c} />
        ))}

        {/* Account & Session Section */}
        <Text style={{ color: c.textTertiary }} className="px-2 text-xs font-bold uppercase tracking-wider mb-3 mt-4">
          Account & Device
        </Text>
        <Animated.View entering={FadeInDown.delay(450).springify()}>
          <Pressable
            onPress={handleSignOut}
            style={{ backgroundColor: c.surface, borderColor: c.border, borderRadius: radius.md }}
            className="p-4 mb-6 border flex-row items-center active:opacity-70"
          >
            <View style={{ backgroundColor: c.alertTint }} className="w-12 h-12 rounded-2xl items-center justify-center mr-4">
              <LogOut size={22} color={c.alert} />
            </View>
            <View className="flex-1">
              <Text style={{ color: c.alert }} className="font-bold text-base mb-0.5">
                Sign Out
              </Text>
              <Text style={{ color: c.textSecondary }} className="text-xs">
                Disconnect account from this device
              </Text>
            </View>
            <ChevronRight size={18} color={c.textTertiary} />
          </Pressable>
        </Animated.View>

        <Text style={{ color: c.textTertiary }} className="text-center text-xs mt-2 mb-8">Biblio Platform v1.0.0</Text>
      </ScrollView>
    </View>
  );
}
