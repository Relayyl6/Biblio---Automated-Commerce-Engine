import React, { useState } from 'react';
import { View, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useColorScheme } from 'nativewind';
import { Bot, ShieldCheck, Truck, MessageSquare, Building2, Database, Package, Key } from 'lucide-react-native';
import { colors } from '../theme';
import { ScreenHeader } from '../src/components/ScreenHeader';
import { Section, ToggleRow, InputRow, NavigationRow } from '../src/components/SettingsRows';
import { SidePanel } from '../src/components/SidePanel';
import {
  DispatchApiKeysPanel,
  ToneCalibrationPanel,
  LedgerWebhooksPanel,
  StoreProfilePanel,
  DeveloperApiKeysPanel,
} from '../src/components/SettingsPanels';

type PanelKey = 'dispatch' | 'tone' | 'ledger' | 'profile' | 'developer' | null;

const PANEL_META: Record<Exclude<PanelKey, null>, { title: string; subtitle: string }> = {
  dispatch: { title: 'Dispatch API Keys', subtitle: 'Gokada, Kwik and MAX logistics credentials.' },
  tone: { title: 'Tone & Dialect Calibration', subtitle: "Adjust the AI's Pidgin ratio and politeness markers." },
  ledger: { title: 'Ledger & Bank Webhooks', subtitle: 'Connect a provider for real-time virtual accounts.' },
  profile: { title: 'Store Profile & WhatsApp API', subtitle: 'Pickup address and Meta OAuth status.' },
  developer: { title: 'Developer API Keys', subtitle: 'Override platform defaults with your own provider keys.' },
};

export default function SettingsScreen() {
  const router = useRouter();
  const { colorScheme } = useColorScheme();
  const c = colorScheme === 'dark' ? colors.dark : colors.light;

  const [activePanel, setActivePanel] = useState<PanelKey>(null);
  const closePanel = () => setActivePanel(null);

  const [autoDispatch, setAutoDispatch] = useState(true);
  const [autoRestock, setAutoRestock] = useState(false);
  const [smsEscalation, setSmsEscalation] = useState(true);
  const [fraudInsurance, setFraudInsurance] = useState(false);
  const [coolingPeriod, setCoolingPeriod] = useState(false);
  const [dataConsent, setDataConsent] = useState(true);

  const [maxAutoValue, setMaxAutoValue] = useState('50000');
  const [maxDiscount, setMaxDiscount] = useState('8');

  return (
    <View style={{ backgroundColor: c.bg }} className="flex-1">
      <ScreenHeader title="System Brain" variant="bar" />

      <ScrollView className="flex-1 pt-6" contentContainerStyle={{ paddingBottom: 100 }}>
        <Section title="Catalog & Pricing Floors" icon={Package} delay={50}>
          <NavigationRow
            title="Manage Inventory & Pricing"
            subtitle="Add items, set specific Absolute Pricing Floors per SKU, and track stock levels."
            icon={Package}
            onPress={() => router.push('/crm')}
            isLast
          />
        </Section>

        <Section title="Global Autonomy Boundaries" icon={Bot} delay={100}>
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

        <Section title="Logistics & Execution" icon={Truck} delay={150}>
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

        <Section title="AI Persona & Comms" icon={MessageSquare} delay={200}>
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
            isLast
          />
        </Section>

        <Section title="Payments & Security" icon={ShieldCheck} delay={250}>
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

        <Section title="Business Identity & Data" icon={Building2} delay={300}>
          <ToggleRow
            title="Federated Data Training"
            subtitle="Allow anonymized chat data to improve the ACE intelligence network."
            value={dataConsent}
            onValueChange={setDataConsent}
          />
          <NavigationRow
            title="Store Profile & WhatsApp API"
            subtitle="Edit store address (for rider pickups) and Meta OAuth status."
            icon={Database}
            onPress={() => setActivePanel('profile')}
            isLast
          />
        </Section>

        <Section title="Developer & Overrides" icon={Key} delay={350}>
          <NavigationRow
            title="Custom Provider API Keys"
            subtitle="Bring your own keys for Groq, Twilio, Paystack, and Africa's Talking."
            icon={Key}
            onPress={() => setActivePanel('developer')}
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
      </SidePanel>
    </View>
  );
}

