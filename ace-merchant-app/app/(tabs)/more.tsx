import React from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import {
  MessageCircle,
  CreditCard,
  Users,
  Settings,
  ChevronRight,
  HelpCircle,
  LogOut,
  Bell,
} from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { colors } from '../../theme';

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

const SYSTEM_ITEMS: MenuItem[] = [
  { id: 'settings', title: 'Brain', subtitle: 'Agent configuration', icon: Settings, route: '/settings', tint: '#64748B' },
  { id: 'notifications', title: 'Notifications', subtitle: 'Alerts & digest preferences', icon: Bell, route: '/notifications', tint: '#F59E0B' },
  { id: 'help', title: 'Help & Support', subtitle: 'Guides and contact', icon: HelpCircle, route: '/support', tint: '#0EA5E9' },
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

  return (
    <View style={{ backgroundColor: c.bg }} className="flex-1 pt-16">
      <Animated.View entering={FadeInDown.delay(50).springify()} className="px-6 mb-2 flex-row items-center justify-between">
        <Text style={{ color: c.textPrimary }} className="text-3xl font-bold tracking-tight">
          Menu
        </Text>
      </Animated.View>

      {/* Merchant identity strip — gives the screen an anchor instead of
          dropping straight into a list of links */}
      <Animated.View entering={FadeInDown.delay(100).springify()} className="px-6 mb-6">
        <Pressable
          onPress={() => {}}
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
          Workspace
        </Text>
        {WORKSPACE_ITEMS.map((item, i) => (
          <MenuRow key={item.id} item={item} index={i} c={c} />
        ))}

        <Text style={{ color: c.textTertiary }} className="px-2 text-xs font-bold uppercase tracking-wider mb-3 mt-4">
          System
        </Text>
        {SYSTEM_ITEMS.map((item, i) => (
          <MenuRow key={item.id} item={item} index={i + WORKSPACE_ITEMS.length} c={c} />
        ))}

        <Animated.View entering={FadeInDown.delay(150 + (WORKSPACE_ITEMS.length + SYSTEM_ITEMS.length) * 60).springify()} className="mt-4">
          <Pressable
            onPress={() => {}}
            style={{ borderColor: c.border }}
            className="p-4 rounded-3xl border flex-row items-center justify-center active:opacity-70"
          >
            <LogOut size={18} color={c.danger} />
            <Text style={{ color: c.danger }} className="font-bold text-sm ml-2">
              Sign out
            </Text>
          </Pressable>
        </Animated.View>

        <Text style={{ color: c.textTertiary }} className="text-center text-xs mt-6">
          Biblo v1.0.0
        </Text>
      </ScrollView>
    </View>
  );
}
