import React, { useState } from 'react';
import { View, Text, Pressable, Switch, ScrollView } from 'react-native';
import { useColorScheme } from 'nativewind';
import { Truck, MessageSquare, CreditCard, Building2, Check, Link2 } from 'lucide-react-native';
import { colors } from '../../theme';
import { PanelField } from './PanelField';
import { SegmentedControl } from './SegmentedControl';

function useThemeColors() {
  const { colorScheme } = useColorScheme();
  return colorScheme === 'dark' ? colors.dark : colors.light;
}

function PanelSaveButton({ onPress, label = 'Save changes' }: { onPress: () => void; label?: string }) {
  const c = useThemeColors();
  const { colorScheme } = useColorScheme();
  return (
    <Pressable onPress={onPress} style={{ backgroundColor: c.accent }} className="py-3.5 rounded-xl items-center active:opacity-80 mt-2">
      <Text style={{ color: colorScheme === 'dark' ? '#090A0C' : '#FFFFFF' }} className="font-bold text-sm">
        {label}
      </Text>
    </Pressable>
  );
}

/** Panel content for "Dispatch API Keys" — Gokada, Kwik, MAX credentials. */
export function DispatchApiKeysPanel({ onSave }: { onSave: () => void }) {
  const c = useThemeColors();
  const [gokada, setGokada] = useState('');
  const [kwik, setKwik] = useState('');
  const [max, setMax] = useState('');

  return (
    <View>
      <View className="flex-row items-center mb-5">
        <Truck size={16} color={c.textTertiary} />
        <Text style={{ color: c.textTertiary }} className="text-xs ml-2 flex-1 leading-relaxed">
          Keys are stored encrypted and used only to auto-book riders on your behalf.
        </Text>
      </View>
      <PanelField label="Gokada API Key" value={gokada} onChangeText={setGokada} placeholder="gk_live_••••••••" secure />
      <PanelField label="Kwik API Key" value={kwik} onChangeText={setKwik} placeholder="kwk_live_••••••••" secure />
      <PanelField label="MAX API Key" value={max} onChangeText={setMax} placeholder="max_live_••••••••" secure />
      <PanelSaveButton onPress={onSave} />
    </View>
  );
}

/** Panel content for "Tone & Dialect Calibration". */
export function ToneCalibrationPanel({ onSave }: { onSave: () => void }) {
  const c = useThemeColors();
  const [pidginLevel, setPidginLevel] = useState('Mixed');
  const [politeMarkers, setPoliteMarkers] = useState(true);

  return (
    <View>
      <View className="flex-row items-center mb-4">
        <MessageSquare size={16} color={c.textTertiary} />
        <Text style={{ color: c.textTertiary }} className="text-xs ml-2 flex-1 leading-relaxed">
          Controls how the AI phrases WhatsApp replies to your customers.
        </Text>
      </View>

      <Text style={{ color: c.textPrimary }} className="font-semibold text-sm mb-2">
        Pidgin Ratio
      </Text>
      <SegmentedControl options={['Formal', 'Mixed', 'Pidgin-heavy']} value={pidginLevel} onChange={setPidginLevel} />
      <Text style={{ color: c.textTertiary }} className="text-xs mt-2 mb-6 leading-relaxed">
        {pidginLevel === 'Formal' && '"Your order has been confirmed and will arrive shortly."'}
        {pidginLevel === 'Mixed' && '"Your order don confirm, e go reach you soon."'}
        {pidginLevel === 'Pidgin-heavy' && '"Na so e be — order don land, e dey come your side now now."'}
      </Text>

      <View className="flex-row items-center justify-between py-3" style={{ borderTopWidth: 1, borderTopColor: c.border }}>
        <View className="flex-1 pr-4">
          <Text style={{ color: c.textPrimary }} className="font-semibold text-sm mb-1">
            Politeness Markers
          </Text>
          <Text style={{ color: c.textSecondary }} className="text-xs leading-relaxed">
            Adds "please" / "ma" / "sir" to requests and corrections.
          </Text>
        </View>
        <Switch value={politeMarkers} onValueChange={setPoliteMarkers} trackColor={{ false: c.border, true: c.accent }} thumbColor={c.surface} />
      </View>

      <PanelSaveButton onPress={onSave} />
    </View>
  );
}

/** Panel content for "Ledger & Bank Webhooks" — provider connections. */
export function LedgerWebhooksPanel({ onSave }: { onSave: () => void }) {
  const c = useThemeColors();
  const [connected, setConnected] = useState<'paystack' | 'providus' | null>(null);

  const ProviderRow = ({ id, name }: { id: 'paystack' | 'providus'; name: string }) => {
    const isConnected = connected === id;
    return (
      <Pressable
        onPress={() => setConnected(id)}
        style={{ backgroundColor: c.surface, borderColor: isConnected ? c.accent : c.border }}
        className="flex-row items-center justify-between p-4 rounded-2xl border mb-3 active:opacity-80"
      >
        <View className="flex-row items-center flex-1">
          <View style={{ backgroundColor: c.accentSoft }} className="w-10 h-10 rounded-full items-center justify-center mr-3">
            <CreditCard size={18} color={c.accent} />
          </View>
          <Text style={{ color: c.textPrimary }} className="font-bold">
            {name}
          </Text>
        </View>
        {isConnected ? (
          <View style={{ backgroundColor: c.successSoft }} className="flex-row items-center px-2.5 py-1 rounded-full">
            <Check size={12} color={c.success} />
            <Text style={{ color: c.success }} className="text-xs font-bold ml-1">
              Connected
            </Text>
          </View>
        ) : (
          <Link2 size={16} color={c.textTertiary} />
        )}
      </Pressable>
    );
  };

  return (
    <View>
      <Text style={{ color: c.textTertiary }} className="text-xs mb-5 leading-relaxed">
        Connect a provider to generate real-time virtual accounts and auto-reconcile incoming transfers.
      </Text>
      <ProviderRow id="paystack" name="Paystack" />
      <ProviderRow id="providus" name="Providus Bank" />
      <PanelSaveButton onPress={onSave} label="Confirm connection" />
    </View>
  );
}

/** Panel content for "Store Profile & WhatsApp API". */
export function StoreProfilePanel({ onSave }: { onSave: () => void }) {
  const c = useThemeColors();
  const [address, setAddress] = useState('');
  const [metaConnected] = useState(true); // read-only status from your Meta OAuth flow

  return (
    <View>
      <View className="flex-row items-center justify-between mb-5 p-4 rounded-2xl" style={{ backgroundColor: c.surfaceAlt }}>
        <View className="flex-row items-center">
          <Building2 size={18} color={c.textSecondary} />
          <Text style={{ color: c.textPrimary }} className="font-semibold text-sm ml-2">
            Meta WhatsApp API
          </Text>
        </View>
        <View style={{ backgroundColor: metaConnected ? c.successSoft : c.dangerSoft }} className="px-2.5 py-1 rounded-full">
          <Text style={{ color: metaConnected ? c.success : c.danger }} className="text-xs font-bold">
            {metaConnected ? 'Connected' : 'Disconnected'}
          </Text>
        </View>
      </View>

      <PanelField
        label="Pickup Address"
        value={address}
        onChangeText={setAddress}
        placeholder="Shop 14, Alaba International Market"
        helper="Riders use this address for every auto-dispatched pickup."
      />
      <PanelSaveButton onPress={onSave} />
    </View>
  );
}

/** Panel content for "Developer API Keys" — overriding platform defaults. */
export function DeveloperApiKeysPanel({ onSave }: { onSave: () => void }) {
  const c = useThemeColors();
  const [groq, setGroq] = useState('');
  const [twilioSid, setTwilioSid] = useState('');
  const [twilioAuth, setTwilioAuth] = useState('');
  const [paystack, setPaystack] = useState('');
  const [africasTalking, setAfricasTalking] = useState('');

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
      <Text style={{ color: c.textTertiary }} className="text-xs mb-5 leading-relaxed">
        Leave these blank to use the default Biblio platform keys. If you enter your own keys, your account will use your dedicated billing instances.
      </Text>

      <Text style={{ color: c.textPrimary }} className="font-bold text-sm mb-3 mt-2">AI Intelligence</Text>
      <PanelField label="Groq API Key" value={groq} onChangeText={setGroq} placeholder="gsk_••••••••" secure helper="Used for Llama 3 Negotiator." />

      <Text style={{ color: c.textPrimary }} className="font-bold text-sm mb-3 mt-4">Communications & SMS</Text>
      <PanelField label="Twilio Account SID" value={twilioSid} onChangeText={setTwilioSid} placeholder="AC••••••••" secure />
      <PanelField label="Twilio Auth Token" value={twilioAuth} onChangeText={setTwilioAuth} placeholder="••••••••" secure />
      <PanelField label="Africa's Talking API Key" value={africasTalking} onChangeText={setAfricasTalking} placeholder="atsk_••••••••" secure helper="Used for out-of-band SMS escalation." />

      <Text style={{ color: c.textPrimary }} className="font-bold text-sm mb-3 mt-4">Payments</Text>
      <PanelField label="Paystack Secret Key" value={paystack} onChangeText={setPaystack} placeholder="sk_live_••••••••" secure helper="Bypasses Biblio's escrow and settles directly to your account." />

      <PanelSaveButton onPress={onSave} label="Save API Overrides" />
    </ScrollView>
  );
}

