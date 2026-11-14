import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Linking, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useColorScheme } from 'nativewind';
import {
  Bot,
  ShieldCheck,
  Truck,
  MessageSquare,
  Building2,
  Database,
  Package,
  Key,
  Bell,
  HelpCircle,
  LogOut,
  History,
  Crown,
  Coins,
  ShieldAlert,
  Trash2,
  Sun,
  FileText,
  PhoneCall,
  PauseCircle,
  PlayCircle,
  CheckCircle2,
} from 'lucide-react-native';
import { useThemeStore } from '../src/store/themeStore';
import { colors, radius, shadows, typography } from '../theme';
import { useAuthStore } from '../src/store/authStore';
import { useAlert } from '../src/store/alertStore';
import { useMerchantConfig, useUpdateMerchantConfig } from '../src/api/client';
import { ScreenHeader } from '../src/components/ScreenHeader';
import { Section, ToggleRow, InputRow, NavigationRow } from '../src/components/SettingsRows';
import { SidePanel } from '../src/components/SidePanel';
import { StatusPill } from '../src/components/StatusPill';
import {
  DispatchApiKeysPanel,
  ToneCalibrationPanel,
  LedgerWebhooksPanel,
  StoreProfilePanel,
  DeveloperApiKeysPanel,
  StatusAutomationPanel,
  PlanPanel,
  VoiceCallSettingsPanel,
} from '../src/components/SettingsPanels';

type PanelKey = 'dispatch' | 'tone' | 'ledger' | 'profile' | 'developer' | 'status' | 'plan' | 'voice_calls' | null;

const PANEL_META: Record<Exclude<PanelKey, null>, { title: string; subtitle: string }> = {
  dispatch: { title: 'Dispatch API Keys', subtitle: 'Gokada, Kwik and MAX logistics credentials.' },
  tone: { title: 'Tone & Dialect Calibration', subtitle: "Adjust the AI's Pidgin ratio and politeness markers." },
  ledger: { title: 'Ledger & Bank Webhooks', subtitle: 'Connect a provider for real-time virtual accounts.' },
  profile: { title: 'Store & Business Profile', subtitle: 'Store identity, owner details, warehouse address & policies.' },
  developer: { title: 'Developer API Keys', subtitle: 'Override platform defaults with your own provider keys.' },
  status: { title: 'WhatsApp Status Engine', subtitle: 'Smart ranking strategy, auto-broadcast cycles & instant pushes.' },
  plan: { title: 'Subscription & Features', subtitle: 'Your active plan and unlocked platform capabilities.' },
  voice_calls: { title: 'Autonomous Voice Calling', subtitle: 'Call triggers, vendor pre-approval & speech previews.' },
};

export default function SettingsScreen() {
  const router = useRouter();
  const { colorScheme, setColorScheme } = useColorScheme();
  const { theme, setTheme } = useThemeStore();
  const c = colorScheme === 'dark' ? colors.dark : colors.light;
  const alert = useAlert();
  const logout = useAuthStore(state => state.logout);
  const { data: config } = useMerchantConfig();
  const updateConfigMutation = useUpdateMerchantConfig();

  const [activePanel, setActivePanel] = useState<PanelKey>(null);
  const closePanel = () => setActivePanel(null);

  const [isAcePaused, setIsAcePaused] = useState(false);
  const [autoDispatch, setAutoDispatch] = useState(true);
  const [autoRestock, setAutoRestock] = useState(false);
  const [smsEscalation, setSmsEscalation] = useState(true);
  const [fraudInsurance, setFraudInsurance] = useState(false);
  const [coolingPeriod, setCoolingPeriod] = useState(false);
  const [dataConsent, setDataConsent] = useState(true);

  const [maxAutoValue, setMaxAutoValue] = useState('50000');
  const [maxDiscount, setMaxDiscount] = useState('8');

  useEffect(() => {
    if (config) {
      if (config.max_discount_percentage !== undefined) {
        setMaxDiscount(String(config.max_discount_percentage));
      }
      if (config.auto_dispatch_riders !== undefined) {
        setAutoDispatch(Boolean(config.auto_dispatch_riders));
      }
    }
  }, [config]);

  const togglePauseAce = () => {
    const nextState = !isAcePaused;
    setIsAcePaused(nextState);
    if (nextState) {
      alert.warning('ACE Paused', 'Autonomous actions are paused. Incoming inquiries will hold for your manual reply.');
    } else {
      alert.success('ACE Resumed', 'Autonomous actions active. ACE is answering inquiries, reconciling payments, and booking riders.');
    }
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
    <View style={{ backgroundColor: c.bg }} className="flex-1">
      <ScreenHeader title="Autonomous Settings" variant="bar" />

      <ScrollView className="flex-1 pt-3" contentContainerStyle={{ paddingBottom: 100 }}>
        {/* ── 1. Trust Surface: What ACE can do without asking (DESIGN.md Section 10.5) ── */}
        <View
          style={{
            backgroundColor: c.surface,
            borderColor: c.border,
            borderRadius: radius.lg,
            ...shadows.sm,
          }}
          className="mx-4 mb-4 p-5 border"
        >
          <View className="flex-row items-center justify-between mb-3">
            <View className="flex-row items-center">
              <Bot size={18} color={c.signal} />
              <Text style={{ color: c.textPrimary }} className="font-bold text-sm ml-2">
                What ACE does without asking
              </Text>
            </View>
            <StatusPill label={isAcePaused ? 'Paused' : 'Active'} tone={isAcePaused ? 'review' : 'signal'} />
          </View>

          <View style={{ gap: 8 }} className="mb-4">
            <View className="flex-row items-start">
              <CheckCircle2 size={14} color={c.settled} style={{ marginTop: 2, marginRight: 8 }} />
              <Text style={{ color: c.textSecondary }} className="text-xs flex-1 leading-relaxed">
                Replies to customer WhatsApp inquiries in real time with calibrated Nigerian Pidgin.
              </Text>
            </View>
            <View className="flex-row items-start">
              <CheckCircle2 size={14} color={c.settled} style={{ marginTop: 2, marginRight: 8 }} />
              <Text style={{ color: c.textSecondary }} className="text-xs flex-1 leading-relaxed">
                Auto-approves verified purchases under <Text style={{ color: c.textPrimary, fontWeight: 'bold' }}>₦{Number(maxAutoValue).toLocaleString()}</Text>.
              </Text>
            </View>
            <View className="flex-row items-start">
              <CheckCircle2 size={14} color={c.settled} style={{ marginTop: 2, marginRight: 8 }} />
              <Text style={{ color: c.textSecondary }} className="text-xs flex-1 leading-relaxed">
                Applies loyalty discounts up to <Text style={{ color: c.textPrimary, fontWeight: 'bold' }}>{maxDiscount}%</Text> for returning VIP customers.
              </Text>
            </View>
            <View className="flex-row items-start">
              <CheckCircle2 size={14} color={c.settled} style={{ marginTop: 2, marginRight: 8 }} />
              <Text style={{ color: c.textSecondary }} className="text-xs flex-1 leading-relaxed">
                Reconciles Providus virtual accounts and books verified dispatch riders.
              </Text>
            </View>
          </View>

          {/* Quick Pause ACE button (DESIGN.md Section 10.5) */}
          <Pressable
            onPress={togglePauseAce}
            style={{
              backgroundColor: isAcePaused ? c.settled : c.review,
              borderRadius: radius.pill,
            }}
            className="h-11 items-center justify-center flex-row active:opacity-85"
          >
            {isAcePaused ? (
              <>
                <PlayCircle size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={{ color: '#FFFFFF' }} className="font-bold text-xs">
                  Resume ACE Autopilot
                </Text>
              </>
            ) : (
              <>
                <PauseCircle size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={{ color: '#FFFFFF' }} className="font-bold text-xs">
                  Pause ACE (Hold for Manual Replies)
                </Text>
              </>
            )}
          </Pressable>
        </View>

        {/* ── 2. Global Autonomy Boundaries ── */}
        <Section title="Global Autonomy Boundaries" icon={Bot} delay={60}>
          <InputRow
            title="Max Autonomous Order Value"
            subtitle="Orders above this amount require your manual Inbox swipe to approve."
            prefix="₦"
            value={maxAutoValue}
            onChangeText={setMaxAutoValue}
            placeholder="50000"
          />
          <InputRow
            title="Max Auto-Loyalty Discount"
            subtitle="The highest percentage discount the AI can grant returning VIPs."
            prefix="%"
            value={maxDiscount}
            onChangeText={setMaxDiscount}
            placeholder="8"
            isLast
          />
        </Section>

        {/* ── 3. Store & Business Profile ── */}
        <Section title="Store & Business Profile" icon={Building2} delay={80}>
          <NavigationRow
            title="Edit Store Profile & Warehouse"
            subtitle={config?.name ? `${config.name} • ${config.delivery_info || 'Pickup address & details'}` : 'Store name, owner identity, warehouse address & fulfillment options.'}
            icon={Building2}
            onPress={() => setActivePanel('profile')}
          />
          <NavigationRow
            title="Store Policies & Return Guidelines"
            subtitle={config?.business_policies ? (config.business_policies.length > 50 ? config.business_policies.substring(0, 50) + '...' : config.business_policies) : 'Returns, warranty, customer policies & SLAs.'}
            icon={ShieldCheck}
            onPress={() => setActivePanel('profile')}
            isLast
          />
        </Section>

        {/* ── 4. Appearance & Display (Battery / OLED) ── */}
        <Section title="Appearance & Display" icon={Sun} delay={100}>
          <ToggleRow
            title="Dark Mode"
            subtitle={colorScheme === 'dark' ? 'Dark theme active (optimized for OLED battery savings)' : 'Light warm paper theme active'}
            value={colorScheme === 'dark'}
            onValueChange={(enableDark) => {
              const next = enableDark ? 'dark' : 'light';
              setTheme(next);
              setColorScheme(next);
            }}
            isLast
          />
        </Section>

        {/* ── 5. Catalog & Pricing Floors ── */}
        <Section title="Catalog & Pricing Floors" icon={Package} delay={120}>
          <NavigationRow
            title="Manage Inventory & Pricing"
            subtitle="Add items, set specific Absolute Pricing Floors per SKU, and track stock levels."
            icon={Package}
            onPress={() => router.push('/crm')}
          />
          <NavigationRow
            title="Tokens & Spend Caps"
            subtitle="Compute balance, 7-day velocity, and autonomous spend ceilings."
            icon={Coins}
            onPress={() => router.push('/tokens')}
          />
          <NavigationRow
            title="Operator Veto & 6-Layer Guardrails"
            subtitle="Review hold queue, live barge-in rules, and global kill switch."
            icon={ShieldAlert}
            onPress={() => router.push('/veto')}
            isLast
          />
        </Section>

        {/* ── 6. Logistics & Execution ── */}
        <Section title="Logistics & Execution" icon={Truck} delay={140}>
          <ToggleRow
            title="Auto-Dispatch Riders"
            subtitle="Instantly ping Kwik/Gokada APIs to book a rider the second payment clears."
            value={autoDispatch}
            onValueChange={setAutoDispatch}
          />
          <ToggleRow
            title="Predictive Auto-Restock"
            subtitle="Automatically draft Purchase Orders to verified suppliers on low stock."
            value={autoRestock}
            onValueChange={setAutoRestock}
          />
          <NavigationRow
            title="Manage Procurement Nodes"
            subtitle="Connect WA Groups, Broadcast lists, and IG channels for Auto-Restock."
            icon={Bot}
            onPress={() => router.push('/suppliers')}
          />
          <NavigationRow
            title="Dispatch API Keys"
            subtitle="Manage Gokada, Kwik, and MAX logistics credentials."
            icon={Truck}
            onPress={() => setActivePanel('dispatch')}
            isLast
          />
        </Section>

        {/* ── 7. AI Persona & Comms ── */}
        <Section title="AI Persona & Comms" icon={MessageSquare} delay={160}>
          <ToggleRow
            title="Out-of-Band SMS Escalation"
            subtitle="Use Africa's Talking offline SMS for high-value WhatsApp abandoned carts."
            value={smsEscalation}
            onValueChange={setSmsEscalation}
          />
          <NavigationRow
            title="Tone & Dialect Calibration"
            subtitle="Adjust the AI's Pidgin ratio and politeness markers."
            icon={MessageSquare}
            onPress={() => setActivePanel('tone')}
          />
          <NavigationRow
            title="Autonomous Voice Calling"
            subtitle="Configure call triggers, vendor approval thresholds, and speech scripts."
            icon={PhoneCall}
            onPress={() => setActivePanel('voice_calls')}
            isLast
          />
        </Section>

        {/* ── 8. Payments & Security ── */}
        <Section title="Payments & Security" icon={ShieldCheck} delay={180}>
          <ToggleRow
            title="New Customer Cooling Period"
            subtitle="First-time customers face a 24-hour hold before logistics are dispatched."
            value={coolingPeriod}
            onValueChange={setCoolingPeriod}
          />
          <ToggleRow
            title="Fraud Protection Insurance"
            subtitle="Opt-in to ₦1,500/mo platform insurance covering up to ₦100K of spoofed transfers."
            value={fraudInsurance}
            onValueChange={setFraudInsurance}
          />
          <NavigationRow
            title="Ledger & Bank Webhooks"
            subtitle="Connect Providus or Paystack for real-time virtual account generation."
            icon={ShieldCheck}
            onPress={() => setActivePanel('ledger')}
            isLast
          />
        </Section>

        {/* ── 9. Data & Privacy Controls ── */}
        <Section title="Data & Privacy Controls" icon={Database} delay={200}>
          <ToggleRow
            title="Commercial AI Training & Research"
            subtitle="Authorizes anonymized commerce data to train frontier AI models and power enterprise market intelligence."
            value={dataConsent}
            onValueChange={setDataConsent}
          />
          <NavigationRow
            title="Privacy Policy"
            subtitle="NDPA 2023 statutory compliance & data rights"
            icon={ShieldCheck}
            onPress={() => {
              const base = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.1.149:3004';
              Linking.openURL(`${base}/legal/privacy`);
            }}
          />
          <NavigationRow
            title="Terms of Service"
            subtitle="Commercial terms, 6-layer veto & acceptable use"
            icon={FileText}
            onPress={() => {
              const base = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.1.149:3004';
              Linking.openURL(`${base}/legal/terms`);
            }}
            isLast
          />
        </Section>

        {/* ── 10. Subscription & Plan ── */}
        <Section title="Subscription & Plan" icon={Crown} delay={220}>
          <NavigationRow
            title="Subscription & Features"
            subtitle="View current plan tier, feature entitlements, and upgrade options."
            icon={Crown}
            onPress={() => setActivePanel('plan')}
            isLast
          />
        </Section>

        {/* ── 11. System & Support ── */}
        <Section title="System & Support" icon={Bell} delay={240}>
          <NavigationRow
            title="Notifications"
            subtitle="Alerts & digest preferences"
            icon={Bell}
            onPress={() => router.push('/notifications')}
          />
          <NavigationRow
            title="Notification History"
            subtitle="Delivery audit trail for SMS and WhatsApp"
            icon={History}
            onPress={() => router.push('/notification-history')}
          />
          <NavigationRow
            title="Help & Support"
            subtitle="Guides and contact"
            icon={HelpCircle}
            onPress={() => router.push('/support')}
          />
          <NavigationRow
            title="Sign out"
            subtitle="Disconnect this device"
            icon={LogOut}
            onPress={handleSignOut}
          />
          <NavigationRow
            title="Delete Account"
            subtitle="Permanently erase account and data (App Store 5.1.1(v) & NDPA 2023)"
            icon={Trash2}
            onPress={() => router.push('/delete-account')}
            isLast
          />
        </Section>
      </ScrollView>

      <SidePanel
        visible={activePanel !== null}
        onClose={closePanel}
        title={activePanel ? PANEL_META[activePanel].title : ''}
        subtitle={activePanel ? PANEL_META[activePanel].subtitle : undefined}
      >
        {activePanel === 'dispatch' && <DispatchApiKeysPanel onSave={closePanel} />}
        {activePanel === 'tone' && <ToneCalibrationPanel onSave={closePanel} />}
        {activePanel === 'ledger' && <LedgerWebhooksPanel onSave={closePanel} />}
        {activePanel === 'profile' && <StoreProfilePanel onSave={closePanel} />}
        {activePanel === 'developer' && <DeveloperApiKeysPanel onSave={closePanel} />}
        {activePanel === 'status' && <StatusAutomationPanel onSave={closePanel} />}
        {activePanel === 'plan' && <PlanPanel onSave={closePanel} />}
        {activePanel === 'voice_calls' && <VoiceCallSettingsPanel onSave={closePanel} />}
      </SidePanel>
    </View>
  );
}
