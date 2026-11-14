import React, { useState, useEffect } from 'react';
import { Tabs, useRouter, useNavigation } from 'expo-router';
import { Home, Inbox, MoreHorizontal, Search, ArrowLeft, MessageCircle, User, Settings as SettingsIcon, Coins } from 'lucide-react-native';
import { View, Text, Pressable, Keyboard } from 'react-native';
import { useColorScheme } from 'nativewind';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { safeHaptics } from '../../src/utils/sanitizers';

export type BottomTabBarProps = {
  state: any;
  descriptors?: any;
  navigation: any;
  insets?: any;
};
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  FadeInRight,
  FadeOutLeft,
  FadeInLeft,
  FadeOutRight
} from 'react-native-reanimated';
import { colors, radius, shadows } from '../../theme';
import { useInbox } from '../../src/api/client';

function useInboxBadgeCount() {
  const { data: cards } = useInbox();
  return Array.isArray(cards) ? cards.length : 0;
}

function TabIcon({
  Icon,
  isFocused,
  accent,
  inactive,
  activeBg,
  badge,
  badgeBg,
}: {
  Icon: any;
  isFocused: boolean;
  accent: string;
  inactive: string;
  activeBg: string;
  badge?: number;
  badgeBg?: string;
}) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  React.useEffect(() => {
    scale.value = withSpring(isFocused ? 1.08 : 1, { damping: 14, stiffness: 220 });
  }, [isFocused]);

  return (
    <Animated.View
      style={[animatedStyle, { backgroundColor: isFocused ? activeBg : 'transparent' }]}
      className="px-4 py-2.5 rounded-full flex-row items-center"
    >
      <Icon size={22} color={isFocused ? accent : inactive} strokeWidth={isFocused ? 2.4 : 2} />
      {badge && badge > 0 ? (
        <View
          style={{ backgroundColor: badgeBg || colors.light.review }}
          className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 rounded-full items-center justify-center px-1"
        >
          <Text className="text-white text-[9px] font-bold">{badge > 9 ? '9+' : badge}</Text>
        </View>
      ) : null}
    </Animated.View>
  );
}

function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const c = isDark ? colors.dark : colors.light;
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const fallbackNav = useNavigation();
  const nav: any = navigation || fallbackNav;
  const inboxBadge = useInboxBadgeCount();
  const [showMore, setShowMore] = useState(false);
  const [kbVisible, setKbVisible] = useState(false);

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKbVisible(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKbVisible(false));
    return () => { show.remove(); hide.remove(); };
  }, []);

  if (kbVisible) return null;

  const icons: Record<string, typeof Home> = {
    index: Home,
    chats: MessageCircle,
    inbox: Inbox,
    more: MoreHorizontal,
  };

  return (
    <View
      style={{
        position: 'absolute',
        bottom: Math.max(insets.bottom, 16),
        left: 16,
        right: 16,
        height: 64,
        flexDirection: 'row',
        alignItems: 'center',
      }}
      pointerEvents="box-none"
    >
      {/* Floating glass pill (DESIGN.md Section 9.6 & 5.2) */}
      <View
        style={{
          flex: 1,
          height: '100%',
          marginRight: 12,
          borderRadius: radius.pill,
          backgroundColor: isDark ? 'rgba(21,23,28,0.92)' : 'rgba(255,255,255,0.92)',
          borderWidth: 1,
          borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.65)',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-around',
          paddingHorizontal: 8,
          shadowColor: '#0F1115',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: isDark ? 0.45 : 0.10,
          shadowRadius: 24,
          elevation: 6,
        }}
      >
        {!showMore ? (
          <Animated.View entering={FadeInLeft.springify()} exiting={FadeOutLeft} style={{ flexDirection: 'row', flex: 1, justifyContent: 'space-around' }}>
            {state.routes.filter((r: any) => r.name !== 'tokens').map((route: any, index: number) => {
              const isFocused = state.index === index;
              const Icon = icons[route.name] ?? Home;

              const onPress = () => {
                safeHaptics.impact();
                if (route.name === 'more') {
                  setShowMore(true);
                  return;
                }
                try {
                  nav?.emit?.({ type: 'tabPress', target: route.key, canPreventDefault: true });
                } catch (_) {}
                const targetPath = route.name === 'index' ? '/(tabs)' : `/(tabs)/${route.name}`;
                router.navigate(targetPath as any);
              };

              return (
                <Pressable
                  key={route.key}
                  onPress={onPress}
                  hitSlop={10}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: isFocused }}
                >
                  <TabIcon
                    Icon={Icon}
                    isFocused={isFocused && route.name !== 'more'}
                    accent={c.accent}
                    inactive={c.textTertiary}
                    activeBg={c.accentSoft}
                    badge={route.name === 'inbox' ? inboxBadge : undefined}
                    badgeBg={c.review}
                  />
                </Pressable>
              );
            })}
          </Animated.View>
        ) : (
          <Animated.View entering={FadeInRight.springify()} exiting={FadeOutRight} style={{ flexDirection: 'row', flex: 1, justifyContent: 'space-around' }}>
            <Pressable onPress={() => { safeHaptics.impact(); setShowMore(false); }} hitSlop={10}>
              <TabIcon Icon={ArrowLeft} isFocused={false} accent={c.accent} inactive={c.textTertiary} activeBg={c.accentSoft} />
            </Pressable>
            <Pressable
              onPress={() => {
                safeHaptics.impact();
                router.navigate('/(tabs)/more' as any);
              }}
              hitSlop={10}
            >
              <TabIcon Icon={User} isFocused={state.index === 3} accent={c.accent} inactive={c.textTertiary} activeBg={c.accentSoft} />
            </Pressable>
            <Pressable onPress={() => { safeHaptics.impact(); router.navigate('/(tabs)/tokens' as any); }} hitSlop={10}>
              <TabIcon Icon={Coins} isFocused={false} accent={c.accent} inactive={c.textTertiary} activeBg={c.accentSoft} />
            </Pressable>
            <Pressable onPress={() => { safeHaptics.impact(); router.push('/settings' as any); }} hitSlop={10}>
              <TabIcon Icon={SettingsIcon} isFocused={false} accent={c.accent} inactive={c.textTertiary} activeBg={c.accentSoft} />
            </Pressable>
          </Animated.View>
        )}
      </View>

      {/* Floating search pill */}
      <Pressable
        onPress={() => {
          safeHaptics.impact();
          router.push('/search' as any);
        }}
        accessibilityRole="button"
        accessibilityLabel="Search"
        style={{
          width: 56,
          height: 56,
          borderRadius: radius.pill,
          backgroundColor: c.accent,
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: c.accent,
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.35,
          shadowRadius: 16,
          elevation: 6,
        }}
      >
        <Search size={22} color="#FFFFFF" />
      </Pressable>
    </View>
  );
}

const renderTabBar = (props: any) => <CustomTabBar {...props} />;

export default function TabsLayout() {
  const { colorScheme } = useColorScheme();
  const c = colorScheme === 'dark' ? colors.dark : colors.light;

  return (
    <Tabs
      tabBar={renderTabBar}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: c.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="chats" options={{ title: 'Chats' }} />
      <Tabs.Screen name="inbox" options={{ title: 'Inbox' }} />
      <Tabs.Screen name="more" options={{ title: 'More' }} />
      <Tabs.Screen name="tokens" options={{ title: 'Tokens' }} />
    </Tabs>
  );
}
