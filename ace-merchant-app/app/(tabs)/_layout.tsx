import React, { useState, useEffect } from 'react';
import { Tabs, useRouter, useNavigation } from 'expo-router';
import { Home, Inbox, MoreHorizontal, Search, ArrowLeft, MessageCircle, User, Settings as SettingsIcon, Coins } from 'lucide-react-native';
import { View, Text, Pressable, Keyboard } from 'react-native';
import { useColorScheme } from 'nativewind';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import * as Haptics from 'expo-haptics';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  FadeInRight,
  FadeOutLeft,
  FadeInLeft,
  FadeOutRight
} from 'react-native-reanimated';
import { colors } from '../../theme';
import { useInbox } from '../../src/api/client';

function useInboxBadgeCount() {
  const { data: cards = [] } = useInbox();
  return cards.length;
}

function TabIcon({
  Icon,
  isFocused,
  accent,
  inactive,
  activeBg,
  badge,
}: {
  Icon: any;
  isFocused: boolean;
  accent: string;
  inactive: string;
  activeBg: string;
  badge?: number;
}) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  React.useEffect(() => {
    scale.value = withSpring(isFocused ? 1.08 : 1, { damping: 12, stiffness: 180 });
  }, [isFocused]);

  return (
    <Animated.View
      style={[animatedStyle, { backgroundColor: isFocused ? activeBg : 'transparent' }]}
      className="px-4 py-2.5 rounded-full flex-row items-center"
    >
      <Icon size={22} color={isFocused ? accent : inactive} strokeWidth={isFocused ? 2.4 : 2} />
      {badge && badge > 0 ? (
        <View
          style={{ backgroundColor: '#EF4444' }}
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
        left: 20,
        right: 20,
        height: 64,
        flexDirection: 'row',
        alignItems: 'center',
      }}
      pointerEvents="box-none"
    >
      <View
        style={{
          flex: 1,
          height: '100%',
          marginRight: 14,
          borderRadius: 32,
          backgroundColor: isDark ? 'rgba(21,23,26,0.92)' : 'rgba(255,255,255,0.96)',
          borderWidth: 1,
          borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.04)',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-around',
          paddingHorizontal: 6,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: isDark ? 0.4 : 0.12,
          shadowRadius: 20,
          elevation: 8,
        }}
      >
        {!showMore ? (
          <Animated.View entering={FadeInLeft.springify()} exiting={FadeOutLeft} style={{ flexDirection: 'row', flex: 1, justifyContent: 'space-around' }}>
            {state.routes.map((route, index) => {
              const isFocused = state.index === index;
              const Icon = icons[route.name] ?? Home;

              const onPress = () => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                if (route.name === 'more') {
                  setShowMore(true);
                  return;
                }
                const event = nav?.emit
                  ? nav.emit({ type: 'tabPress', target: route.key, canPreventDefault: true })
                  : { defaultPrevented: false };
                if (!isFocused && !event?.defaultPrevented) {
                  if (nav?.navigate) {
                    nav.navigate(route.name, route.params as object);
                  } else {
                    router.navigate(`/(tabs)/${route.name}` as any);
                  }
                }
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
                  />
                </Pressable>
              );
            })}
          </Animated.View>
        ) : (
          <Animated.View entering={FadeInRight.springify()} exiting={FadeOutRight} style={{ flexDirection: 'row', flex: 1, justifyContent: 'space-around' }}>
            <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowMore(false); }} hitSlop={10}>
              <TabIcon Icon={ArrowLeft} isFocused={false} accent={c.accent} inactive={c.textTertiary} activeBg={c.accentSoft} />
            </Pressable>
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                if (nav?.navigate) {
                  nav.navigate('more');
                } else {
                  router.navigate('/(tabs)/more' as any);
                }
              }}
              hitSlop={10}
            >
              <TabIcon Icon={User} isFocused={state.index === 3} accent={c.accent} inactive={c.textTertiary} activeBg={c.accentSoft} />
            </Pressable>
            <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/tokens' as any); }} hitSlop={10}>
              <TabIcon Icon={Coins} isFocused={false} accent={c.accent} inactive={c.textTertiary} activeBg={c.accentSoft} />
            </Pressable>
            <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/settings' as any); }} hitSlop={10}>
              <TabIcon Icon={SettingsIcon} isFocused={false} accent={c.accent} inactive={c.textTertiary} activeBg={c.accentSoft} />
            </Pressable>
          </Animated.View>
        )}
      </View>

      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          router.push('/search' as any);
        }}
        accessibilityRole="button"
        accessibilityLabel="Search"
        style={{
          width: 64,
          height: 64,
          borderRadius: 32,
          backgroundColor: c.accent,
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: c.accent,
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.35,
          shadowRadius: 15,
          elevation: 8,
        }}
      >
        <Search size={24} color={isDark ? '#090A0C' : '#FFFFFF'} />
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
      <Tabs.Screen name="index" options={{ title: 'Pulse' }} />
      <Tabs.Screen name="chats" options={{ title: 'Chats' }} />
      <Tabs.Screen name="inbox" options={{ title: 'Inbox' }} />
      <Tabs.Screen name="more" options={{ title: 'More' }} />
    </Tabs>
  );
}

