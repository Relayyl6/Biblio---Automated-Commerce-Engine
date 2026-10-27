import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, Switch, ScrollView } from 'react-native';
import { useColorScheme } from 'nativewind';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Truck, MessageSquare, CreditCard, Building2, Check, Link2, Store, Lock, Sparkles, Crown, Star, Zap, ChevronRight } from 'lucide-react-native';
import { colors } from '../../theme';
import { PanelField } from './PanelField';
import { SegmentedControl } from './SegmentedControl';
import { InlineLoadingDots } from './PulsingSkeleton';
import {
  useStatusSettings,
  useUpdateStatusSettings,
  useStatusCandidates,
  usePostStatusNow,
  useMerchantConfig,
  useUpdateMerchantConfig,
  useMerchantIntegrations,
  useUpdateMerchantIntegrations,
  useUpdateSubscriptionTier,
  useMerchantFeatures,
  useUpdateBankAccount,
  useVendorStatus,
  type FeatureEntitlement,
  type MerchantTier,
} from '../api/client';
import { useAlert } from '../store/alertStore';

function useThemeColors() {
  const { colorScheme } = useColorScheme();
  return colorScheme === 'dark' ? colors.dark : colors.light;
}

function PanelSaveButton({ onPress, label = 'Save changes', isLoading }: { onPress: () => void; label?: string; isLoading?: boolean }) {
  const c = useThemeColors();
  const { colorScheme } = useColorScheme();
  return (
    <Pressable onPress={onPress} disabled={isLoading} style={{ backgroundColor: c.accent }} className="py-3.5 rounded-xl items-center active:opacity-80 mt-2">
      {isLoading ? (
        <InlineLoadingDots color={colorScheme === 'dark' ? '#090A0C' : '#FFFFFF'} />
      ) : (
        <Text style={{ color: colorScheme === 'dark' ? '#090A0C' : '#FFFFFF' }} className="font-bold text-sm">
          {label}
        </Text>
      )}
    </Pressable>
  );
}

function CredentialStatusBadge({
  status,
  hasCustomKey,
}: {
  status?: 'custom_override' | 'managed_pool' | 'unconfigured';
  hasCustomKey?: boolean;
}) {
  const c = useThemeColors();

  if (hasCustomKey || status === 'custom_override') {
    return (
      <View style={{ backgroundColor: c.accentSoft }} className="px-2.5 py-0.5 rounded-full flex-row items-center">
        <View className="w-1.5 h-1.5 rounded-full mr-1.5" style={{ backgroundColor: c.accent }} />
        <Text style={{ color: c.accent }} className="text-[10px] font-bold">
          Custom Override
        </Text>
      </View>
    );
  }

  if (status === 'managed_pool' || !hasCustomKey) {
    return (
      <View style={{ backgroundColor: c.successSoft }} className="px-2.5 py-0.5 rounded-full flex-row items-center">
        <View className="w-1.5 h-1.5 rounded-full mr-1.5" style={{ backgroundColor: c.success }} />
        <Text style={{ color: c.success }} className="text-[10px] font-bold">
          Biblio Managed Default
        </Text>
      </View>
    );
  }

  return (
    <View style={{ backgroundColor: c.surfaceAlt }} className="px-2.5 py-0.5 rounded-full flex-row items-center">
      <Text style={{ color: c.textTertiary }} className="text-[10px] font-bold">
        Optional
      </Text>
    </View>
  );
}

function ManagedPoolBanner({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  const c = useThemeColors();
  return (
    <View
      style={{ backgroundColor: c.surfaceAlt, borderColor: c.border }}
      className="p-3.5 rounded-2xl border mb-5 flex-row items-start"
    >
      <View style={{ backgroundColor: c.successSoft }} className="w-7 h-7 rounded-full items-center justify-center mr-3 mt-0.5">
        <Check size={14} color={c.success} />
      </View>
      <View className="flex-1">
        <Text style={{ color: c.textPrimary }} className="text-xs font-bold mb-1">
          {title}
        </Text>
        <Text style={{ color: c.textSecondary }} className="text-[11px] leading-relaxed">
          {description}
        </Text>
      </View>
    </View>
  );
}

function TierFeatureShield({
  requiredTier = 'enterprise',
  currentTier = 'starter',
  featureName = 'Custom API Key Overrides',
  onUpgrade,
  isUpgrading,
}: {
  requiredTier?: string;
  currentTier?: string;
  featureName?: string;
  onUpgrade?: () => void;
  isUpgrading?: boolean;
}) {
  const c = useThemeColors();
  return (
    <View
      style={{ backgroundColor: c.surfaceAlt, borderColor: c.border }}
      className="p-4 rounded-2xl border mb-5"
    >
      <View className="flex-row items-center mb-2">
        <View style={{ backgroundColor: c.accentSoft }} className="w-8 h-8 rounded-full items-center justify-center mr-2.5">
          <Lock size={15} color={c.accent} />
        </View>
        <View className="flex-1">
          <Text style={{ color: c.textPrimary }} className="text-xs font-bold">
            {requiredTier.toUpperCase()} Plan Required
          </Text>
          <Text style={{ color: c.textTertiary }} className="text-[10px]">
            Current: {currentTier.toUpperCase()} • Powered by Biblio Managed Pool
          </Text>
        </View>
        {onUpgrade && (
          <Pressable
            onPress={onUpgrade}
            disabled={isUpgrading}
            style={{ backgroundColor: c.accent }}
            className="px-3 py-1.5 rounded-xl flex-row items-center active:opacity-80"
          >
            {isUpgrading ? (
              <InlineLoadingDots color="#FFFFFF" />
            ) : (
              <>
                <Sparkles size={12} color="#FFFFFF" />
                <Text className="text-white text-xs font-bold ml-1">Unlock</Text>
              </>
            )}
          </Pressable>
        )}
      </View>
      <Text style={{ color: c.textSecondary }} className="text-[11px] leading-relaxed">
        {featureName} is exclusive to {requiredTier.toUpperCase()} stores with direct corporate courier contracts. Lower plans run automatically via Biblio's managed dispatch pool with zero configuration required.
      </Text>
    </View>
  );
}

/** Panel content for "Dispatch API Keys" — Gokada, Kwik, MAX credentials. */
export function DispatchApiKeysPanel({ onSave }: { onSave: () => void }) {
  const c = useThemeColors();
  const alert = useAlert();
  const { data: integrations, isLoading: isIntegrationsLoading } = useMerchantIntegrations();
  const updateIntegrations = useUpdateMerchantIntegrations();
  const updateTier = useUpdateSubscriptionTier();

  const [gokada, setGokada] = useState('');
  const [kwik, setKwik] = useState('');
  const [max, setMax] = useState('');

  const canEdit = integrations?.canEditCustomKeys ?? false;
  const currentTier = integrations?.subscriptionTier || 'starter';

  useEffect(() => {
    if (integrations?.dispatch) {
      if (integrations.dispatch.gokada) setGokada(integrations.dispatch.gokada);
      if (integrations.dispatch.kwik) setKwik(integrations.dispatch.kwik);
      if (integrations.dispatch.max) setMax(integrations.dispatch.max);
    } else {
      (async () => {
        const savedG = await AsyncStorage.getItem('dispatch_key_gokada');
        const savedK = await AsyncStorage.getItem('dispatch_key_kwik');
        const savedM = await AsyncStorage.getItem('dispatch_key_max');
        if (savedG) setGokada(savedG);
        if (savedK) setKwik(savedK);
        if (savedM) setMax(savedM);
      })();
    }
  }, [integrations]);

  const handleSave = async () => {
    try {
      await updateIntegrations.mutateAsync({
        dispatch: {
          gokada,
          kwik,
          max,
        },
      });
      await AsyncStorage.setItem('dispatch_key_gokada', gokada);
      await AsyncStorage.setItem('dispatch_key_kwik', kwik);
      await AsyncStorage.setItem('dispatch_key_max', max);
      alert.success('Keys Saved', 'Logistics rider dispatch credentials stored securely and synced with Biblio backend.');
      onSave();
    } catch (err: any) {
      alert.error('Save Failed', err?.message || 'Could not save credentials to server.');
    }
  };

  const handleUpgrade = async () => {
    try {
      await updateTier.mutateAsync('enterprise');
      alert.success('Plan Upgraded', 'Your account has been upgraded to Enterprise! Private API key overrides are now unlocked.');
    } catch (err: any) {
      alert.error('Upgrade Failed', err?.message || 'Could not upgrade tier.');
    }
  };

  const d = integrations?.dispatch;

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 }}>
      {!canEdit ? (
        <TierFeatureShield
          requiredTier="enterprise"
          currentTier={currentTier}
          featureName="Custom Dispatch API Overrides"
          onUpgrade={handleUpgrade}
          isUpgrading={updateTier.isPending}
        />
      ) : (
        <ManagedPoolBanner
          title="Enterprise BYOK Unlocked"
          description="You are on the Enterprise plan. You can use your direct corporate courier billing credentials below, or leave them empty to use Biblio's managed dispatch pool."
        />
      )}

      <View className="mb-4">
        <View className="flex-row items-center justify-between mb-1.5">
          <Text style={{ color: c.textPrimary }} className="font-semibold text-xs">Gokada</Text>
          <CredentialStatusBadge status={d?.statusGokada} hasCustomKey={!!gokada.trim()} />
        </View>
        <PanelField
          label=""
          value={gokada}
          onChangeText={setGokada}
          placeholder="gk_live_••••••••"
          secure
          helper={canEdit ? "Leave empty to use Biblio's managed dispatch pool." : "Requires Enterprise plan to override."}
        />
      </View>

      <View className="mb-4">
        <View className="flex-row items-center justify-between mb-1.5">
          <Text style={{ color: c.textPrimary }} className="font-semibold text-xs">Kwik Delivery</Text>
          <CredentialStatusBadge status={d?.statusKwik} hasCustomKey={!!kwik.trim()} />
        </View>
        <PanelField
          label=""
          value={kwik}
          onChangeText={setKwik}
          placeholder="kwk_live_••••••••"
          secure
          helper={canEdit ? "Leave empty to use Biblio's managed dispatch pool." : "Requires Enterprise plan to override."}
        />
      </View>

      <View className="mb-4">
        <View className="flex-row items-center justify-between mb-1.5">
          <Text style={{ color: c.textPrimary }} className="font-semibold text-xs">MAX.ng</Text>
          <CredentialStatusBadge status={d?.statusMax} hasCustomKey={!!max.trim()} />
        </View>
        <PanelField
          label=""
          value={max}
          onChangeText={setMax}
          placeholder="max_live_••••••••"
          secure
          helper={canEdit ? "Leave empty to use Biblio's managed dispatch pool." : "Requires Enterprise plan to override."}
        />
      </View>

      {canEdit && (
        <PanelSaveButton onPress={handleSave} isLoading={updateIntegrations.isPending || isIntegrationsLoading} label="Save Dispatch Settings" />
      )}
    </ScrollView>
  );
}

/** Panel content for "Tone & Dialect Calibration". */
export function ToneCalibrationPanel({ onSave }: { onSave: () => void }) {
  const c = useThemeColors();
  const alert = useAlert();
  const { data: config } = useMerchantConfig();
  const updateConfig = useUpdateMerchantConfig();

  const [pidginLevel, setPidginLevel] = useState('Mixed');
  const [politeMarkers, setPoliteMarkers] = useState(true);

  useEffect(() => {
    if (config?.dialect) {
      const d = config.dialect.toLowerCase();
      if (d.includes('formal') || d === 'english') setPidginLevel('Formal');
      else if (d.includes('heavy') || d === 'deep') setPidginLevel('Pidgin-heavy');
      else setPidginLevel('Mixed');
    }
  }, [config]);

  const handleSave = async () => {
    try {
      const dialectPayload = pidginLevel === 'Formal' ? 'english' : pidginLevel === 'Pidgin-heavy' ? 'pidgin' : 'mixed';
      await updateConfig.mutateAsync({
        dialect: dialectPayload,
        toneGuide: `${pidginLevel} tone with ${politeMarkers ? 'polite honorifics' : 'casual demeanor'}`,
      });
      alert.success('Tone Updated', `AI negotiator dialect calibrated to ${pidginLevel}.`);
      onSave();
    } catch (e: any) {
      alert.error('Save Failed', e?.message || 'Could not update tone calibration.');
    }
  };

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

      <PanelSaveButton onPress={handleSave} isLoading={updateConfig.isPending} />
    </View>
  );
}

/** Panel content for "Ledger & Bank Webhooks" — provider connections. */
export function LedgerWebhooksPanel({ onSave }: { onSave: () => void }) {
  const c = useThemeColors();
  const alert = useAlert();
  const [connected, setConnected] = useState<'paystack' | 'providus'>('paystack');
  const [accountNumber, setAccountNumber] = useState('');
  const [bankCode, setBankCode] = useState('058'); // 058 GTBank default
  const [accountName, setAccountName] = useState('');
  const updateBankAccount = useUpdateBankAccount();

  useEffect(() => {
    (async () => {
      const saved = await AsyncStorage.getItem('ledger_provider');
      if (saved === 'providus' || saved === 'paystack') setConnected(saved);
      const savedAcc = await AsyncStorage.getItem('ledger_acc_num');
      const savedBank = await AsyncStorage.getItem('ledger_bank_code');
      const savedName = await AsyncStorage.getItem('ledger_acc_name');
      if (savedAcc) setAccountNumber(savedAcc);
      if (savedBank) setBankCode(savedBank);
      if (savedName) setAccountName(savedName);
    })();
  }, []);

  const handleSave = async () => {
    try {
      await AsyncStorage.setItem('ledger_provider', connected);
      if (accountNumber.trim() && accountName.trim()) {
        await updateBankAccount.mutateAsync({
          accountNumber: accountNumber.trim(),
          bankCode: bankCode.trim() || '058',
          accountName: accountName.trim(),
        });
        await AsyncStorage.setItem('ledger_acc_num', accountNumber.trim());
        await AsyncStorage.setItem('ledger_bank_code', bankCode.trim() || '058');
        await AsyncStorage.setItem('ledger_acc_name', accountName.trim());
        alert.success('Bank & Provider Saved', `Real-time virtual accounts activated via ${connected === 'providus' ? 'Providus Bank' : 'Paystack'} and Paystack settlement recipient verified.`);
      } else {
        alert.success('Provider Connected', `Real-time payment virtual accounts activated via ${connected === 'providus' ? 'Providus Bank' : 'Paystack'}.`);
      }
      onSave();
    } catch (err: any) {
      alert.error('Bank Setup Failed', err?.response?.data?.error || err.message || 'Could not verify bank account with Paystack.');
    }
  };

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
    <ScrollView showsVerticalScrollIndicator={false}>
      <Text style={{ color: c.textTertiary }} className="text-xs mb-4 leading-relaxed">
        Connect a provider to generate real-time virtual accounts and auto-reconcile incoming customer transfers.
      </Text>
      <ProviderRow id="paystack" name="Paystack" />
      <ProviderRow id="providus" name="Providus Bank" />

      <Text style={{ color: c.textPrimary }} className="font-bold text-sm mt-3 mb-1">
        Escrow Settlement Bank Account
      </Text>
      <Text style={{ color: c.textTertiary }} className="text-xs mb-3">
        Where escrow balances are automatically swept once deliveries are confirmed.
      </Text>

      <PanelField
        label="NUBAN Account Number"
        value={accountNumber}
        onChangeText={setAccountNumber}
        placeholder="0123456789"
        helper="10-digit Nigerian bank account number."
      />

      <PanelField
        label="Bank Code"
        value={bankCode}
        onChangeText={setBankCode}
        placeholder="058 (GTBank) or 011, 057, 033..."
        helper="CBN 3-digit bank code (e.g. 058 for GTBank, 011 for First Bank, 057 for Zenith)."
      />

      <PanelField
        label="Account Name"
        value={accountName}
        onChangeText={setAccountName}
        placeholder="e.g. Adeola Johnson Ventures"
        helper="Exact name registered with your bank."
      />

      <PanelSaveButton onPress={handleSave} isLoading={updateBankAccount.isPending} label="Save Provider & Bank Account" />
    </ScrollView>
  );
}

/** Panel content for "Store Profile & WhatsApp API". */
export function StoreProfilePanel({ onSave }: { onSave: () => void }) {
  const c = useThemeColors();
  const alert = useAlert();
  const { data: config } = useMerchantConfig();
  const updateConfig = useUpdateMerchantConfig();
  const { data: integrations } = useMerchantIntegrations();
  const updateIntegrations = useUpdateMerchantIntegrations();
  const { data: statusSettings } = useStatusSettings();
  const { data: vendorStatus } = useVendorStatus();

  const [storeName, setStoreName] = useState('');
  const [ownerFirstName, setOwnerFirstName] = useState('');
  const [ownerLastName, setOwnerLastName] = useState('');
  const [businessPolicies, setBusinessPolicies] = useState('');
  const [address, setAddress] = useState('');
  const [supportsPickup, setSupportsPickup] = useState(true);
  const companionConnected = statusSettings?.settings?.session_status === 'connected' || vendorStatus?.dbStatus === 'connected';
  const metaConnected = Boolean(config?.whatsapp_catalog_id || companionConnected);

  useEffect(() => {
    if (config) {
      if (config.name) setStoreName(config.name);
      if (config.owner_first_name || config.ownerFirstName) {
        setOwnerFirstName(config.owner_first_name || config.ownerFirstName);
      }
      if (config.owner_last_name || config.ownerLastName) {
        setOwnerLastName(config.owner_last_name || config.ownerLastName);
      }
      if (config.business_policies || config.businessPolicies) {
        setBusinessPolicies(config.business_policies || config.businessPolicies);
      }
      if (config.delivery_info || config.deliveryInfo) {
        setAddress(config.delivery_info || config.deliveryInfo);
      }
    }
  }, [config]);

  useEffect(() => {
    if (integrations?.fulfillment) {
      if (integrations.fulfillment.supportsPickup !== undefined) {
        setSupportsPickup(integrations.fulfillment.supportsPickup);
      }
      if (integrations.fulfillment.pickupAddress && !address) {
        setAddress(integrations.fulfillment.pickupAddress);
      }
    }
  }, [integrations]);

  const handleSave = async () => {
    try {
      await Promise.all([
        updateConfig.mutateAsync({
          name: storeName.trim() || undefined,
          ownerFirstName: ownerFirstName.trim() || undefined,
          ownerLastName: ownerLastName.trim() || undefined,
          deliveryInfo: address.trim() || undefined,
          businessPolicies: businessPolicies.trim() || undefined,
        }),
        updateIntegrations.mutateAsync({
          fulfillment: {
            supportsPickup,
            pickupAddress: address.trim() || undefined,
          },
        }),
      ]);
      alert.success('Profile Saved', 'Store details, owner profile, and fulfillment policies updated successfully.');
      onSave();
    } catch (e: any) {
      alert.error('Update Failed', e?.message || 'Could not save store profile.');
    }
  };

  return (
    <View>
      <View className="flex-row items-center justify-between mb-5 p-4 rounded-2xl" style={{ backgroundColor: c.surfaceAlt }}>
        <View className="flex-row items-center flex-1 mr-2">
          <Building2 size={18} color={c.textSecondary} />
          <View className="ml-2.5">
            <Text style={{ color: c.textPrimary }} className="font-semibold text-sm">
              WhatsApp Integration
            </Text>
            <Text style={{ color: c.textTertiary }} className="text-[10px]">
              {companionConnected ? '24/7 Persistent Daemon Active' : 'Meta API / Companion Device'}
            </Text>
          </View>
        </View>
        <View style={{ backgroundColor: metaConnected ? c.successSoft : c.dangerSoft }} className="px-2.5 py-1 rounded-full flex-row items-center">
          {metaConnected && <View className="w-1.5 h-1.5 rounded-full mr-1.5" style={{ backgroundColor: c.success }} />}
          <Text style={{ color: metaConnected ? c.success : c.danger }} className="text-xs font-bold">
            {metaConnected ? 'Connected' : 'Ready'}
          </Text>
        </View>
      </View>

      <PanelField
        label="Store Name"
        value={storeName}
        onChangeText={setStoreName}
        placeholder="Biblo Fashion Store"
        helper="Display name shown across notifications and customer receipts."
      />

      <View className="flex-row gap-2.5">
        <View className="flex-1">
          <PanelField
            label="Owner First Name"
            value={ownerFirstName}
            onChangeText={setOwnerFirstName}
            placeholder="e.g. Leonard"
          />
        </View>
        <View className="flex-1">
          <PanelField
            label="Owner Last Name"
            value={ownerLastName}
            onChangeText={setOwnerLastName}
            placeholder="e.g. Oseghale"
          />
        </View>
      </View>

      <PanelField
        label="Store Pickup & Warehouse Address"
        value={address}
        onChangeText={setAddress}
        placeholder="Shop 14, Alaba International Market, Lagos"
        helper="Address used for rider dispatches and customer store pickups."
      />

      <PanelField
        label="Store Policies & Return Guidelines"
        value={businessPolicies}
        onChangeText={setBusinessPolicies}
        placeholder="e.g. 48-hour return window for unworn items with tags. Delivery within 24h in Lagos."
        helper="Shared with customers asking about return windows, delivery guarantees, or warranty."
        multiline
      />

      <View className="flex-row items-center justify-between py-3 mb-3" style={{ borderTopWidth: 1, borderTopColor: c.border }}>
        <View className="flex-1 pr-4">
          <Text style={{ color: c.textPrimary }} className="font-semibold text-sm mb-1">
            Allow In-Person Store Pickup
          </Text>
          <Text style={{ color: c.textSecondary }} className="text-xs leading-relaxed">
            Customers can choose to pick up at your shop in person (₦0 delivery fee, secret pickup code issued).
          </Text>
        </View>
        <Switch
          value={supportsPickup}
          onValueChange={setSupportsPickup}
          trackColor={{ false: c.border, true: c.accent }}
          thumbColor={c.surface}
        />
      </View>

      <PanelSaveButton onPress={handleSave} isLoading={updateConfig.isPending || updateIntegrations.isPending} />
    </View>
  );
}

export function DeveloperApiKeysPanel({ onSave }: { onSave: () => void }) {
  const c = useThemeColors();
  const alert = useAlert();
  const { data: integrations, isLoading: isIntegrationsLoading } = useMerchantIntegrations();
  const updateIntegrations = useUpdateMerchantIntegrations();
  const updateTier = useUpdateSubscriptionTier();

  const [groq, setGroq] = useState('');
  const [twilioSid, setTwilioSid] = useState('');
  const [twilioAuth, setTwilioAuth] = useState('');
  const [paystack, setPaystack] = useState('');
  const [africasTalking, setAfricasTalking] = useState('');

  const canEdit = integrations?.canEditCustomKeys ?? false;
  const currentTier = integrations?.subscriptionTier || 'starter';

  useEffect(() => {
    if (integrations?.developer) {
      if (integrations.developer.groq) setGroq(integrations.developer.groq);
      if (integrations.developer.twilioSid) setTwilioSid(integrations.developer.twilioSid);
      if (integrations.developer.twilioAuth) setTwilioAuth(integrations.developer.twilioAuth);
      if (integrations.developer.paystack) setPaystack(integrations.developer.paystack);
      if (integrations.developer.africasTalking) setAfricasTalking(integrations.developer.africasTalking);
    } else {
      (async () => {
        const g = await AsyncStorage.getItem('dev_key_groq');
        const ts = await AsyncStorage.getItem('dev_key_twilio_sid');
        const ta = await AsyncStorage.getItem('dev_key_twilio_auth');
        const p = await AsyncStorage.getItem('dev_key_paystack');
        const at = await AsyncStorage.getItem('dev_key_africas_talking');
        if (g) setGroq(g);
        if (ts) setTwilioSid(ts);
        if (ta) setTwilioAuth(ta);
        if (p) setPaystack(p);
        if (at) setAfricasTalking(at);
      })();
    }
  }, [integrations]);

  const handleSave = async () => {
    try {
      await updateIntegrations.mutateAsync({
        developer: {
          groq,
          twilioSid,
          twilioAuth,
          paystack,
          africasTalking,
        },
      });
      await AsyncStorage.setItem('dev_key_groq', groq);
      await AsyncStorage.setItem('dev_key_twilio_sid', twilioSid);
      await AsyncStorage.setItem('dev_key_twilio_auth', twilioAuth);
      await AsyncStorage.setItem('dev_key_paystack', paystack);
      await AsyncStorage.setItem('dev_key_africas_talking', africasTalking);
      alert.success('Developer Keys Saved', 'Custom API provider overrides successfully synced to Biblio backend.');
      onSave();
    } catch (e: any) {
      alert.error('Save Failed', e?.message || 'Could not save API keys to server.');
    }
  };

  const handleUpgrade = async () => {
    try {
      await updateTier.mutateAsync('enterprise');
      alert.success('Plan Upgraded', 'Your account has been upgraded to Enterprise! Developer API key overrides are now unlocked.');
    } catch (err: any) {
      alert.error('Upgrade Failed', err?.message || 'Could not upgrade tier.');
    }
  };

  const dev = integrations?.developer;

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
      {!canEdit ? (
        <TierFeatureShield
          requiredTier="enterprise"
          currentTier={currentTier}
          featureName="Developer API & Escrow Overrides"
          onUpgrade={handleUpgrade}
          isUpgrading={updateTier.isPending}
        />
      ) : (
        <ManagedPoolBanner
          title="Enterprise BYOK Unlocked"
          description="You are on the Enterprise plan. Enter private keys only if you wish to route usage through your dedicated accounts."
        />
      )}

      <Text style={{ color: c.textPrimary }} className="font-bold text-sm mb-3 mt-1">AI Intelligence</Text>
      <View className="mb-4">
        <View className="flex-row items-center justify-between mb-1.5">
          <Text style={{ color: c.textSecondary }} className="font-medium text-xs">Groq API Key (Llama 3)</Text>
          <CredentialStatusBadge status={dev?.statusGroq} hasCustomKey={!!groq.trim()} />
        </View>
        <PanelField
          label=""
          value={groq}
          onChangeText={setGroq}
          placeholder="gsk_••••••••"
          secure
          helper={canEdit ? "Leave empty to use Biblio's managed negotiator pool." : "Requires Enterprise plan to override."}
        />
      </View>

      <Text style={{ color: c.textPrimary }} className="font-bold text-sm mb-3 mt-2">Communications & SMS</Text>
      <View className="mb-4">
        <View className="flex-row items-center justify-between mb-1.5">
          <Text style={{ color: c.textSecondary }} className="font-medium text-xs">Africa's Talking API Key</Text>
          <CredentialStatusBadge status={dev?.statusAfricasTalking} hasCustomKey={!!africasTalking.trim()} />
        </View>
        <PanelField
          label=""
          value={africasTalking}
          onChangeText={setAfricasTalking}
          placeholder="atsk_••••••••"
          secure
          helper={canEdit ? "Leave empty to use Biblio's out-of-band SMS escalation line." : "Requires Enterprise plan to override."}
        />
      </View>

      <View className="mb-4">
        <View className="flex-row items-center justify-between mb-1.5">
          <Text style={{ color: c.textSecondary }} className="font-medium text-xs">Twilio SID & Auth (International)</Text>
          <CredentialStatusBadge status={dev?.statusTwilioSid} hasCustomKey={!!twilioSid.trim()} />
        </View>
        <PanelField
          label=""
          value={twilioSid}
          onChangeText={setTwilioSid}
          placeholder="AC••••••••"
          secure
          helper={canEdit ? "" : "Requires Enterprise plan to override."}
        />
        <PanelField
          label=""
          value={twilioAuth}
          onChangeText={setTwilioAuth}
          placeholder="Auth Token ••••••••"
          secure
          helper={canEdit ? "Optional Twilio fallback for international messages." : "Requires Enterprise plan to override."}
        />
      </View>

      <Text style={{ color: c.textPrimary }} className="font-bold text-sm mb-3 mt-2">Payments & Escrow</Text>
      <View className="mb-4">
        <View className="flex-row items-center justify-between mb-1.5">
          <Text style={{ color: c.textSecondary }} className="font-medium text-xs">Paystack Secret Key</Text>
          <CredentialStatusBadge status={dev?.statusPaystack} hasCustomKey={!!paystack.trim()} />
        </View>
        <PanelField
          label=""
          value={paystack}
          onChangeText={setPaystack}
          placeholder="sk_live_••••••••"
          secure
          helper={canEdit ? "Leave empty to use Biblio's automated escrow & instant bank payouts." : "Requires Enterprise plan to override."}
        />
      </View>

      {canEdit && (
        <PanelSaveButton onPress={handleSave} isLoading={updateIntegrations.isPending || isIntegrationsLoading} label="Save API Overrides" />
      )}
    </ScrollView>
  );
}

/** Panel content for "WhatsApp Status Automation & Smart Ranking". */
export function StatusAutomationPanel({ onSave }: { onSave: () => void }) {
  const c = useThemeColors();
  const { data: settingsData } = useStatusSettings();
  const updateSettings = useUpdateStatusSettings();
  const { data: candidatesData, refetch: refetchCandidates } = useStatusCandidates(3);
  const postNowMutation = usePostStatusNow();

  const settings = settingsData?.settings;
  const [autoStatus, setAutoStatus] = useState(true);
  const [strategy, setStrategy] = useState<string>('balanced');
  const [frequency, setFrequency] = useState<string>('4h');
  const [postResult, setPostResult] = useState<string | null>(null);

  React.useEffect(() => {
    if (settings) {
      if (settings.auto_status_enabled !== undefined) setAutoStatus(settings.auto_status_enabled);
      if (settings.status_strategy) setStrategy(settings.status_strategy);
      if (settings.posting_frequency_hours) setFrequency(String(settings.posting_frequency_hours) + 'h');
    }
  }, [settings]);

  const STRATEGY_OPTIONS = ['Balanced', 'High-Margin', 'Dead-Stock', 'Freshness'];
  const strategyToKey: Record<string, 'balanced' | 'margin_priority' | 'velocity_priority' | 'freshness'> = {
    'Balanced': 'balanced',
    'High-Margin': 'margin_priority',
    'Dead-Stock': 'velocity_priority',
    'Freshness': 'freshness',
  };
  const keyToStrategy: Record<string, string> = {
    'balanced': 'Balanced',
    'margin_priority': 'High-Margin',
    'velocity_priority': 'Dead-Stock',
    'freshness': 'Freshness',
  };

  const FREQ_OPTIONS = ['2h', '4h', '8h', '12h', '24h'];

  const handleSave = async () => {
    await updateSettings.mutateAsync({
      autoStatusEnabled: autoStatus,
      statusStrategy: strategyToKey[strategy] || 'balanced',
      postingFrequencyHours: parseInt(frequency) || 4,
    });
    refetchCandidates();
    onSave();
  };

  const handlePostTopNow = async () => {
    setPostResult(null);
    try {
      const topSku = candidatesData?.candidates?.[0]?.sku;
      const res = await postNowMutation.mutateAsync(topSku);
      if (res && res.ok) {
        setPostResult(`Broadcasted "${res.name}" (₦${res.price?.toLocaleString()}) to Status!`);
      } else {
        setPostResult(`Failed: ${res?.error || 'Device offline'}`);
      }
    } catch (err: any) {
      setPostResult(`Error: ${err.message}`);
    }
  };

  const topCandidate = candidatesData?.candidates?.[0];

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
      <Text style={{ color: c.textTertiary }} className="text-xs mb-4 leading-relaxed">
        Biblio uses an algorithmic ranking engine that scores products based on profit margins and low sales velocity to clear dormant inventory and maximize GMV.
      </Text>

      <View style={{ backgroundColor: c.surfaceAlt, borderColor: c.border }} className="p-4 rounded-2xl border mb-4 flex-row items-center justify-between">
        <View className="flex-1 mr-3">
          <Text style={{ color: c.textPrimary }} className="font-bold text-sm">
            Auto-Status Cron
          </Text>
          <Text style={{ color: c.textSecondary }} className="text-xs mt-0.5">
            Automatically broadcast ranked products every cycle
          </Text>
        </View>
        <Switch
          value={autoStatus}
          onValueChange={setAutoStatus}
          trackColor={{ false: c.border, true: c.accent }}
          thumbColor="#FFFFFF"
        />
      </View>

      <Text style={{ color: c.textPrimary }} className="font-bold text-sm mb-2">
        Promotion Ranking Strategy
      </Text>
      <SegmentedControl
        options={STRATEGY_OPTIONS}
        value={keyToStrategy[strategy] || 'Balanced'}
        onChange={(val) => setStrategy(strategyToKey[val] || 'balanced')}
      />
      <Text style={{ color: c.textTertiary }} className="text-[11px] mt-1.5 mb-4">
        {strategy === 'margin_priority'
          ? '💰 Maximize Margins: 85% Margin Weight, 15% Dead Stock Weight.'
          : strategy === 'velocity_priority'
          ? '📦 Clear Dead Stock: 70% Low-Velocity Weight, 30% Margin Weight.'
          : strategy === 'freshness'
          ? '🌟 Fresh Drops: Unposted and newly added products featured first.'
          : '⚖️ Balanced: 70% Margin Weight, 30% Dead Stock Weight.'}
      </Text>

      <Text style={{ color: c.textPrimary }} className="font-bold text-sm mb-2">
        Broadcast Frequency
      </Text>
      <SegmentedControl
        options={FREQ_OPTIONS}
        value={frequency}
        onChange={setFrequency}
      />

      <View className="mt-5 mb-3">
        <Text style={{ color: c.textPrimary }} className="font-bold text-sm mb-2">
          #1 Ranked Status Candidate
        </Text>
        {topCandidate ? (
          <View style={{ backgroundColor: c.surfaceAlt, borderColor: c.border }} className="p-4 rounded-2xl border">
            <View className="flex-row justify-between items-start mb-2">
              <View className="flex-1 mr-2">
                <Text style={{ color: c.textPrimary }} className="font-bold text-base" numberOfLines={1}>
                  {topCandidate.name}
                </Text>
                <Text style={{ color: c.textTertiary }} className="text-xs">
                  SKU: {topCandidate.sku}
                </Text>
              </View>
              <View style={{ backgroundColor: c.accentSoft }} className="px-2.5 py-1 rounded-full">
                <Text style={{ color: c.accent }} className="text-xs font-black">
                  Score: {topCandidate.promotion_score}
                </Text>
              </View>
            </View>
            <View className="flex-row items-center justify-between pt-2 border-t" style={{ borderColor: c.border }}>
              <Text style={{ color: c.textPrimary }} className="font-extrabold text-sm">
                ₦{Number(topCandidate.price).toLocaleString()}
              </Text>
              <Text style={{ color: '#10B981' }} className="font-bold text-xs">
                {topCandidate.margin_pct}% Margin
              </Text>
              <Text style={{ color: c.textSecondary }} className="text-xs">
                {topCandidate.recent_sales_velocity} recent orders
              </Text>
            </View>
          </View>
        ) : (
          <View style={{ backgroundColor: c.surfaceAlt, borderColor: c.border }} className="p-4 rounded-2xl border items-center">
            <Text style={{ color: c.textTertiary }} className="text-xs">
              No eligible products with images found.
            </Text>
          </View>
        )}
      </View>

      <Pressable
        onPress={handlePostTopNow}
        disabled={postNowMutation.isPending || !topCandidate}
        style={{ backgroundColor: '#22C55E' }}
        className="py-3 rounded-xl items-center active:opacity-80 mt-1 mb-3"
      >
        <Text className="text-white font-bold text-sm">
          {postNowMutation.isPending ? 'Publishing to Status...' : '⚡ Broadcast to Status Now'}
        </Text>
      </Pressable>

      {postResult && (
        <Text style={{ color: postResult.startsWith('Failed') || postResult.startsWith('Error') ? '#EF4444' : '#10B981' }} className="text-xs text-center mb-3 font-semibold">
          {postResult}
        </Text>
      )}

      <PanelSaveButton onPress={handleSave} label={updateSettings.isPending ? 'Saving...' : 'Save Strategy & Settings'} />
    </ScrollView>
  );
}

// ─── PLAN PANEL HELPERS ───────────────────────────────────────────────────────

const TIER_META: Record<MerchantTier, { label: string; emoji: string; color: string; softColor: string }> = {
  starter:    { label: 'Starter',    emoji: '🟢', color: '#22C55E', softColor: '#DCFCE7' },
  growth:     { label: 'Growth',     emoji: '🔵', color: '#3B82F6', softColor: '#DBEAFE' },
  enterprise: { label: 'Enterprise', emoji: '⭐', color: '#F59E0B', softColor: '#FEF3C7' },
};

const CATEGORY_ORDER: Array<FeatureEntitlement['category']> = ['core', 'growth', 'enterprise'];
const CATEGORY_LABEL: Record<FeatureEntitlement['category'], string> = {
  core:       'Core — All Plans',
  growth:     'Growth Plan',
  enterprise: 'Enterprise Plan',
};
const CATEGORY_ICON: Record<string, React.ComponentType<any>> = {
  core:       Zap,
  growth:     Star,
  enterprise: Crown,
};
const CATEGORY_COLOR: Record<string, string> = {
  core:       '#22C55E',
  growth:     '#3B82F6',
  enterprise: '#F59E0B',
};

function FeatureRow({ item }: { item: FeatureEntitlement }) {
  const c = useThemeColors();
  return (
    <View
      className="flex-row items-start py-3"
      style={{ borderBottomWidth: 1, borderBottomColor: c.border }}
    >
      <View className="mt-0.5 mr-3">
        {item.isAllowed ? (
          <View style={{ backgroundColor: '#DCFCE7' }} className="w-5 h-5 rounded-full items-center justify-center">
            <Check size={11} color="#22C55E" />
          </View>
        ) : (
          <View style={{ backgroundColor: c.surfaceAlt }} className="w-5 h-5 rounded-full items-center justify-center">
            <Lock size={10} color={c.textTertiary} />
          </View>
        )}
      </View>
      <View className="flex-1">
        <Text
          style={{ color: item.isAllowed ? c.textPrimary : c.textTertiary }}
          className="text-xs font-semibold mb-0.5"
        >
          {item.name}
        </Text>
        <Text style={{ color: c.textTertiary }} className="text-[10px] leading-relaxed">
          {item.description}
        </Text>
      </View>
      {!item.isAllowed && (
        <View style={{ backgroundColor: c.accentSoft }} className="ml-2 px-2 py-0.5 rounded-full self-start mt-0.5">
          <Text style={{ color: c.accent }} className="text-[9px] font-bold uppercase">
            {item.requiredTier}
          </Text>
        </View>
      )}
    </View>
  );
}

const UPGRADE_TARGETS: Record<MerchantTier, MerchantTier | null> = {
  starter:    'growth',
  growth:     'enterprise',
  enterprise: null,
};

/** Panel content for "Subscription & Features" — full entitlement matrix + passive upgrade CTA. */
export function PlanPanel({ onSave }: { onSave: () => void }) {
  const c = useThemeColors();
  const alert = useAlert();
  const { data: featuresData, isLoading } = useMerchantFeatures();
  const updateTier = useUpdateSubscriptionTier();

  const currentTier: MerchantTier = featuresData?.currentTier || 'starter';
  const meta = TIER_META[currentTier];
  const nextTier = UPGRADE_TARGETS[currentTier];
  const entitlements = featuresData?.entitlements || [];

  const grouped = CATEGORY_ORDER.reduce<Record<string, FeatureEntitlement[]>>((acc, cat) => {
    acc[cat] = entitlements.filter((f) => f.category === cat);
    return acc;
  }, {} as Record<string, FeatureEntitlement[]>);

  const handleUpgrade = async (tier: MerchantTier) => {
    try {
      await updateTier.mutateAsync(tier);
      alert.success(
        'Plan Upgraded',
        `Your account is now on the ${TIER_META[tier].label} plan. New features are unlocked immediately.`,
      );
    } catch (err: any) {
      const msg: string = err?.response?.data?.error || err?.message || 'Could not process upgrade.';
      alert.error('Upgrade Failed', msg);
    }
  };

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center py-16">
        <InlineLoadingDots color={c.accent} />
        <Text style={{ color: c.textTertiary }} className="text-xs mt-3">Loading your feature entitlements…</Text>
      </View>
    );
  }

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
      {/* ── Current plan badge ── */}
      <View
        style={{ backgroundColor: meta.softColor, borderColor: meta.color + '40' }}
        className="flex-row items-center justify-between p-4 rounded-2xl border mb-5"
      >
        <View className="flex-row items-center">
          <View style={{ backgroundColor: meta.color + '20' }} className="w-10 h-10 rounded-full items-center justify-center mr-3">
            {currentTier === 'enterprise' ? (
              <Crown size={18} color={meta.color} />
            ) : currentTier === 'growth' ? (
              <Star size={18} color={meta.color} />
            ) : (
              <Zap size={18} color={meta.color} />
            )}
          </View>
          <View>
            <Text style={{ color: meta.color }} className="font-black text-sm">
              {meta.emoji} {meta.label} Plan
            </Text>
            <Text style={{ color: c.textSecondary }} className="text-[10px] mt-0.5">
              {currentTier === 'enterprise'
                ? 'Maximum privileges — all features unlocked.'
                : `Upgrade to unlock ${TIER_META[nextTier!]?.label} features.`}
            </Text>
          </View>
        </View>
        <View style={{ backgroundColor: meta.color + '15' }} className="px-2.5 py-1 rounded-full">
          <Text style={{ color: meta.color }} className="text-[10px] font-bold">Active</Text>
        </View>
      </View>

      {/* ── Upgrade CTA (passive — no Stripe yet) ── */}
      {nextTier && (
        <Pressable
          onPress={() => handleUpgrade(nextTier)}
          disabled={updateTier.isPending}
          style={{ backgroundColor: TIER_META[nextTier].color }}
          className="flex-row items-center justify-between p-4 rounded-2xl mb-6 active:opacity-80"
        >
          <View className="flex-row items-center flex-1">
            <View style={{ backgroundColor: 'rgba(255,255,255,0.2)' }} className="w-9 h-9 rounded-full items-center justify-center mr-3">
              {updateTier.isPending ? (
                <InlineLoadingDots color="#FFFFFF" />
              ) : (
                <Sparkles size={16} color="#FFFFFF" />
              )}
            </View>
            <View className="flex-1">
              <Text className="text-white font-black text-sm">
                Upgrade to {TIER_META[nextTier].label}
              </Text>
              <Text className="text-white/70 text-[10px] mt-0.5">
                Billing integration coming soon — upgrade is free during beta.
              </Text>
            </View>
          </View>
          <ChevronRight size={16} color="rgba(255,255,255,0.8)" />
        </Pressable>
      )}

      {/* ── Feature matrix grouped by category ── */}
      {CATEGORY_ORDER.map((cat) => {
        const items = grouped[cat];
        if (!items || items.length === 0) return null;
        const CatIcon = CATEGORY_ICON[cat];
        const catColor = CATEGORY_COLOR[cat];
        return (
          <View key={cat} className="mb-5">
            <View className="flex-row items-center mb-2">
              <CatIcon size={12} color={catColor} />
              <Text style={{ color: catColor }} className="text-[10px] font-black ml-1.5 uppercase tracking-widest">
                {CATEGORY_LABEL[cat]}
              </Text>
            </View>
            <View style={{ backgroundColor: c.surface, borderColor: c.border }} className="rounded-2xl border overflow-hidden px-4">
              {items.map((f) => (
                <FeatureRow key={f.id} item={f} />
              ))}
            </View>
          </View>
        );
      })}

      {/* ── Beta caveat footer ── */}
      <View style={{ backgroundColor: c.surfaceAlt }} className="p-3.5 rounded-xl">
        <Text style={{ color: c.textTertiary }} className="text-[10px] text-center leading-relaxed">
          Tier gating is in beta. Feature restrictions are soft — full enforcement activates when Stripe billing is configured. Contact support for enterprise pricing.
        </Text>
      </View>
    </ScrollView>
  );
}

