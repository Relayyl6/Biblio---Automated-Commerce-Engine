import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { useColorScheme } from 'nativewind';
import {
  AlertTriangle,
  Trash2,
  ShieldAlert,
  Lock,
  Mail,
  User,
  CheckCircle2,
  XCircle,
} from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { colors, shadows } from '../theme';
import { ScreenHeader } from '../src/components/ScreenHeader';
import { useDeleteAccount } from '../src/api/client';
import { useAuthStore } from '../src/store/authStore';
import { useAlert } from '../src/store/alertStore';
import { InlineLoadingDots } from '../src/components/PulsingSkeleton';

export default function DeleteAccountScreen() {
  const router = useRouter();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const c = isDark ? colors.dark : colors.light;
  const merchantId = useAuthStore(state => state.merchantId);
  const logout = useAuthStore(state => state.logout);
  const alert = useAlert();

  const [confirmationInput, setConfirmationInput] = useState('');
  const deleteMutation = useDeleteAccount();

  const isConfirmed = confirmationInput.trim() === 'DELETE';

  const handleDelete = async () => {
    if (!isConfirmed) {
      alert.warning('Confirmation Required', "Please type 'DELETE' in capital letters to confirm account closure.");
      return;
    }

    alert.showConfirm({
      title: 'Permanent Account Deletion',
      message: 'This action cannot be undone. All WhatsApp session keys, catalog items, and customer conversation records will be scrubbed immediately.',
      confirmLabel: 'Permanently Scrub Data',
      destructive: true,
      onConfirm: async () => {
        try {
          await deleteMutation.mutateAsync({
            merchantId: merchantId || '',
            confirmation: 'DELETE',
          });
          alert.success(
            'Account Deleted',
            'Your account and all associated personal data have been scrubbed in compliance with NDPA 2023 & App Store Guidelines.'
          );
          logout();
          router.replace('/login');
        } catch (e: any) {
          alert.error('Deletion Failed', e?.response?.data?.error || e?.message || 'Could not delete account.');
        }
      },
    });
  };

  return (
    <View style={{ backgroundColor: c.bg }} className="flex-1">
      <ScreenHeader title="Delete Account" variant="bar" />

      <ScrollView className="flex-1 px-4 pt-2" contentContainerStyle={{ paddingBottom: 120 }}>
        {/* Warning Hero Banner */}
        <Animated.View entering={FadeInDown.delay(50).springify()}>
          <View
            style={{ backgroundColor: c.dangerSoft, borderColor: c.danger }}
            className="p-5 rounded-[24px] border mb-4 flex-row items-start"
          >
            <View style={{ backgroundColor: c.danger }} className="w-10 h-10 rounded-2xl items-center justify-center mr-3 mt-0.5">
              <AlertTriangle size={20} color="#FFFFFF" />
            </View>
            <View className="flex-1">
              <Text style={{ color: c.danger }} className="font-extrabold text-base mb-1">
                Irreversible Action
              </Text>
              <Text style={{ color: c.textPrimary }} className="text-xs leading-relaxed">
                In compliance with App Store Review Guideline 5.1.1(v) and the Nigeria Data Protection Act (NDPA 2023), you have the absolute right to delete your Biblio Merchant Account and all personal telemetry.
              </Text>
            </View>
          </View>
        </Animated.View>

        {/* Consequences Checklist */}
        <Animated.View entering={FadeInDown.delay(100).springify()}>
          <View style={{ backgroundColor: c.surface, borderColor: c.border, ...shadows.sm }} className="p-5 rounded-[24px] border mb-4">
            <Text style={{ color: c.textPrimary }} className="text-base font-bold mb-3">
              What happens when you delete:
            </Text>

            <ConsequenceItem
              title="Persistent WhatsApp Daemon Terminated"
              desc="Your Baileys keys and session tokens stored in PostgreSQL will be purged immediately. Biblio will immediately cease replying to customers."
              c={c}
            />
            <ConsequenceItem
              title="Chat History & Quarantine Scrubbed"
              desc="All raw messages, conversation logs, and quarantined uncertain chats will be permanently deleted."
              c={c}
            />
            <ConsequenceItem
              title="Identity & Bank Vanity Unlinked"
              desc="Your date of birth, name, phone, and Providus VAN records will be scrubbed from active systems."
              c={c}
            />
            <ConsequenceItem
              title="Tokens & Subscriptions Forfeited"
              desc="Any remaining token equity or active tier entitlements will be cancelled."
              isLast
              c={c}
            />
          </View>
        </Animated.View>

        {/* Legal Controller Info */}
        <Animated.View entering={FadeInDown.delay(150).springify()}>
          <View style={{ backgroundColor: c.surface, borderColor: c.border, ...shadows.sm }} className="p-5 rounded-[24px] border mb-6">
            <Text style={{ color: c.textPrimary }} className="text-sm font-bold mb-2">
              Data Controller Contact
            </Text>
            <Text style={{ color: c.textSecondary }} className="text-xs leading-relaxed mb-3">
              Per NDPA 2023 statutory obligations, your deletion request is processed by the nominated controller:
            </Text>
            <View className="gap-2">
              <View className="flex-row items-center">
                <User size={14} color={c.accent} style={{ marginRight: 8 }} />
                <Text style={{ color: c.textPrimary }} className="text-xs font-semibold">
                  Data Controller: Yemuel Oseghale (Operating Biblio)
                </Text>
              </View>
              <View className="flex-row items-center">
                <Mail size={14} color={c.accent} style={{ marginRight: 8 }} />
                <Text style={{ color: c.textPrimary }} className="text-xs font-semibold">
                  Privacy Contact: oseghaleleonard39@gmail.com
                </Text>
              </View>
            </View>
          </View>
        </Animated.View>

        {/* Confirmation Input & Action */}
        <Animated.View entering={FadeInDown.delay(200).springify()}>
          <View style={{ backgroundColor: c.surface, borderColor: c.border, ...shadows.sm }} className="p-5 rounded-[24px] border mb-4">
            <Text style={{ color: c.textPrimary }} className="text-sm font-bold mb-1">
              Confirm Account Closure
            </Text>
            <Text style={{ color: c.textSecondary }} className="text-xs mb-3">
              Type <Text style={{ color: c.danger }} className="font-bold">DELETE</Text> in the box below to authorize permanent data deletion:
            </Text>

            <TextInput
              style={{ backgroundColor: c.surfaceAlt, color: c.textPrimary, borderColor: isConfirmed ? c.danger : c.border }}
              className="border-2 rounded-2xl p-3.5 mb-4 font-mono text-center text-lg font-bold tracking-widest uppercase"
              value={confirmationInput}
              onChangeText={setConfirmationInput}
              placeholder="DELETE"
              placeholderTextColor={c.textTertiary}
              autoCapitalize="characters"
            />

            <Pressable
              onPress={handleDelete}
              disabled={!isConfirmed || deleteMutation.isPending}
              style={{
                backgroundColor: isConfirmed ? c.danger : c.surfaceAlt,
                opacity: isConfirmed ? 1 : 0.6,
              }}
              className="py-3.5 rounded-2xl items-center flex-row justify-center active:opacity-80"
            >
              {deleteMutation.isPending ? (
                <InlineLoadingDots color="#FFFFFF" />
              ) : (
                <>
                  <Trash2 size={18} color={isConfirmed ? '#FFFFFF' : c.textTertiary} style={{ marginRight: 8 }} />
                  <Text style={{ color: isConfirmed ? '#FFFFFF' : c.textTertiary }} className="font-bold text-base">
                    Delete My Account Forever
                  </Text>
                </>
              )}
            </Pressable>
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

function ConsequenceItem({
  title,
  desc,
  isLast,
  c,
}: {
  title: string;
  desc: string;
  isLast?: boolean;
  c: typeof colors.light;
}) {
  return (
    <View
      style={{
        borderBottomColor: c.border,
        borderBottomWidth: isLast ? 0 : 1,
      }}
      className="py-3 flex-row items-start"
    >
      <View style={{ backgroundColor: c.dangerSoft }} className="w-5 h-5 rounded-full items-center justify-center mr-3 mt-0.5">
        <XCircle size={14} color={c.danger} />
      </View>
      <View className="flex-1">
        <Text style={{ color: c.textPrimary }} className="font-bold text-xs">
          {title}
        </Text>
        <Text style={{ color: c.textSecondary }} className="text-[11px] mt-0.5 leading-relaxed">
          {desc}
        </Text>
      </View>
    </View>
  );
}
