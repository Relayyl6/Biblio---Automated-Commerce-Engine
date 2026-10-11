import React, { useState } from 'react';
import { View, Text, StatusBar, Pressable, ScrollView, TextInput, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import {
  MessageCircle,
  CreditCard,
  Users,
  ChevronRight,
  
  
  
} from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { colors } from '../../theme';
import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import { usePairWhatsApp } from '../../src/api/client';

type MenuItem = {
  id: string;
  title: string;
  subtitle: string;
  icon: typeof MessageCircle;
  route: string;
  tint: string;
};

const WORKSPACE_ITEMS: MenuItem[] = [
  { id: 'chats', title: 'Chats', subtitle: 'Full conversational history', icon: MessageCircle, route: '/chats', tint: '#2563EB' },
  { id: 'finance', title: 'Finance', subtitle: 'Real-time dashboards & margins', icon: CreditCard, route: '/finance', tint: '#10B981' },
  { id: 'crm', title: 'CRM', subtitle: 'Inventory & customer LTV', icon: Users, route: '/crm', tint: '#8B5CF6' },
];

function MenuRow({ item, index, c }: { item: MenuItem; index: number; c: typeof colors.light }) {
  const router = useRouter();
  const Icon = item.icon;
  return (
    <Animated.View entering={FadeInDown.delay(150 + index * 60).springify()}>
      <Pressable
        onPress={() => router.push(item.route as any)}
        style={{ backgroundColor: c.surface, borderColor: c.border }}
        className="p-4 rounded-3xl mb-3 border flex-row items-center active:opacity-70"
      >
        <View
          style={{ backgroundColor: item.tint + '1A' }}
          className="w-12 h-12 rounded-2xl items-center justify-center mr-4"
        >
          <Icon size={22} color={item.tint} />
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
  const { colorScheme } = useColorScheme();
  const c = colorScheme === 'dark' ? colors.dark : colors.light;
  const insets = useSafeAreaInsets();
  
  const [showPairing, setShowPairing] = useState(false);
  const [phoneToPair, setPhoneToPair] = useState('');
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const pairMutation = usePairWhatsApp();

  const handlePair = async () => {
    if (!phoneToPair) return;
    try {
      const res = await pairMutation.mutateAsync(phoneToPair);
      if (res.code) setPairingCode(res.code);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <View style={{ backgroundColor: c.bg, paddingTop: Math.max(insets.top, StatusBar.currentHeight || 0) + 16 }} className="flex-1 ">
      <Animated.View entering={FadeInDown.delay(50).springify()} className="px-6 mb-2 flex-row items-center justify-between">
        <Text style={{ color: c.textPrimary }} className="text-3xl font-bold tracking-tight">
          Menu
        </Text>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(100).springify()} className="px-6 mb-6">
        <Pressable
          style={{ backgroundColor: c.surface, borderColor: c.border }}
          className="p-4 rounded-3xl border flex-row items-center active:opacity-70"
        >
          <View
            style={{ backgroundColor: c.accentSoft }}
            className="w-12 h-12 rounded-full items-center justify-center mr-3"
          >
            <Text style={{ color: c.textPrimary }} className="font-bold text-base">
              B
            </Text>
          </View>
          <View className="flex-1">
            <Text style={{ color: c.textPrimary }} className="font-bold text-sm">
              Your store
            </Text>
            <Text style={{ color: c.textSecondary }} className="text-xs mt-0.5">
              View & edit profile
            </Text>
          </View>
          <ChevronRight size={16} color={c.textTertiary} />
        </Pressable>
      </Animated.View>

      <ScrollView className="flex-1 px-4" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        
        <Text style={{ color: c.textTertiary }} className="px-2 text-xs font-bold uppercase tracking-wider mb-3">
          Connections
        </Text>

        <Animated.View entering={FadeInDown.delay(125).springify()} className="mb-4">
          <Pressable
            onPress={() => setShowPairing(!showPairing)}
            style={{ backgroundColor: '#22C55E1A', borderColor: '#22C55E33' }}
            className="p-4 rounded-3xl border active:opacity-70"
          >
            <View className="flex-row items-center">
              <View className="flex-1">
                <Text style={{ color: c.textPrimary }} className="font-bold text-sm">
                  WhatsApp Web Linking
                </Text>
                <Text style={{ color: c.textSecondary }} className="text-xs mt-0.5">
                  Link Biblo as a companion device
                </Text>
              </View>
              {!showPairing && (
                <View style={{ backgroundColor: '#22C55E' }} className="px-3 py-1.5 rounded-full">
                  <Text className="text-white font-bold text-xs">Connect</Text>
                </View>
              )}
            </View>

            {showPairing && (
              <View className="mt-4 pt-4 border-t" style={{ borderColor: '#22C55E33' }}>
                {!pairingCode ? (
                  <>
                    <Text style={{ color: c.textSecondary }} className="text-xs mb-2">
                      Enter the phone number active on your WhatsApp (e.g. 2348012345678):
                    </Text>
                    <TextInput
                      style={{ backgroundColor: c.surface, color: c.textPrimary, borderColor: c.border }}
                      className="border rounded-xl p-3 mb-3 font-semibold"
                      placeholder="234..."
                      placeholderTextColor={c.textTertiary}
                      value={phoneToPair}
                      onChangeText={setPhoneToPair}
                      keyboardType="phone-pad"
                    />
                    <Pressable
                      onPress={handlePair}
                      disabled={pairMutation.isPending}
                      style={{ backgroundColor: '#22C55E' }}
                      className="rounded-xl p-3 items-center flex-row justify-center"
                    >
                      {pairMutation.isPending ? (
                        <ActivityIndicator color="white" size="small" />
                      ) : (
                        <Text className="text-white font-bold">Get Pairing Code</Text>
                      )}
                    </Pressable>
                    {pairMutation.isError && (
                      <Text className="text-red-500 text-xs mt-2 text-center">Failed to get code. Ensure backend gateway is running.</Text>
                    )}
                  </>
                ) : (
                  <View className="items-center py-2">
                    <Text style={{ color: c.textSecondary }} className="text-sm mb-3 text-center">
                      Open WhatsApp → Settings → Linked Devices → Link a Device → Link with Phone Number.
                    </Text>
                    <View style={{ backgroundColor: c.surface, borderColor: c.border }} className="px-6 py-4 rounded-2xl border mb-3">
                      <Text style={{ color: c.textPrimary, letterSpacing: 8 }} className="text-3xl font-black">
                        {pairingCode}
                      </Text>
                    </View>
                    <Text style={{ color: c.textTertiary }} className="text-xs text-center">
                      Once entered, Biblo will automatically sync in the background.
                    </Text>
                  </View>
                )}
              </View>
            )}
          </Pressable>
        </Animated.View>

        {/* Coming Soon integrations */}
        <Animated.View entering={FadeInDown.delay(135).springify()} className="mb-4">
          <View style={{ backgroundColor: c.surface, borderColor: c.border, opacity: 0.7 }} className="p-4 rounded-3xl border flex-row items-center">
             <View style={{ backgroundColor: '#E1306C1A' }} className="w-10 h-10 rounded-xl items-center justify-center mr-3">
               <FontAwesome5 name="instagram" size={20} color="#E1306C" />
             </View>
             <View className="flex-1">
               <Text style={{ color: c.textPrimary }} className="font-bold text-sm">Instagram DMs</Text>
               <Text style={{ color: c.textSecondary }} className="text-xs mt-0.5">Automate IG comments & messages</Text>
             </View>
             <View style={{ backgroundColor: c.surfaceAlt }} className="px-2 py-1 rounded-md">
               <Text style={{ color: c.textTertiary }} className="text-[10px] font-bold uppercase">Soon</Text>
             </View>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(145).springify()} className="mb-4">
          <View style={{ backgroundColor: c.surface, borderColor: c.border, opacity: 0.7 }} className="p-4 rounded-3xl border flex-row items-center">
             <View style={{ backgroundColor: '#00F2FE1A' }} className="w-10 h-10 rounded-xl items-center justify-center mr-3">
               <FontAwesome5 name="tiktok" size={20} color="#00F2FE" />
             </View>
             <View className="flex-1">
               <Text style={{ color: c.textPrimary }} className="font-bold text-sm">TikTok Shop</Text>
               <Text style={{ color: c.textSecondary }} className="text-xs mt-0.5">Sync inventory and orders</Text>
             </View>
             <View style={{ backgroundColor: c.surfaceAlt }} className="px-2 py-1 rounded-md">
               <Text style={{ color: c.textTertiary }} className="text-[10px] font-bold uppercase">Soon</Text>
             </View>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(155).springify()} className="mb-8">
          <View style={{ backgroundColor: c.surface, borderColor: c.border, opacity: 0.7 }} className="p-4 rounded-3xl border flex-row items-center">
             <View style={{ backgroundColor: '#9146FF1A' }} className="w-10 h-10 rounded-xl items-center justify-center mr-3">
               <FontAwesome5 name="twitch" size={20} color="#9146FF" />
             </View>
             <View className="flex-1">
               <Text style={{ color: c.textPrimary }} className="font-bold text-sm">Twitch Chat</Text>
               <Text style={{ color: c.textSecondary }} className="text-xs mt-0.5">Live stream commands & tipping</Text>
             </View>
             <View style={{ backgroundColor: c.surfaceAlt }} className="px-2 py-1 rounded-md">
               <Text style={{ color: c.textTertiary }} className="text-[10px] font-bold uppercase">Soon</Text>
             </View>
          </View>
        </Animated.View>

        <Text style={{ color: c.textTertiary }} className="px-2 text-xs font-bold uppercase tracking-wider mb-3">
          Workspace
        </Text>
        {WORKSPACE_ITEMS.map((item, i) => (
          <MenuRow key={item.id} item={item} index={i} c={c} />
        ))}

        <Text style={{ color: c.textTertiary }} className="text-center text-xs mt-6 mb-8">Biblo v1.0.0</Text>
      </ScrollView>
    </View>
  );
}
