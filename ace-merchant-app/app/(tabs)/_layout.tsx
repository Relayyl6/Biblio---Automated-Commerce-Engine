import React from 'react';
import { Tabs, useRouter } from 'expo-router';
import { Home, Inbox, MoreHorizontal, Search } from 'lucide-react-native';
import { View, Text, Pressable } from 'react-native';
import { useColorScheme } from 'nativewind';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import * as Haptics from 'expo-haptics';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { colors } from '../../theme';
import { useInbox } from '../../src/api/client';

// Wire this up to your actual inbox query (e.g. useInbox().data.length)
// so the dot only shows when there's something to triage.
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
  Icon: typeof Home;
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
  const inboxBadge = useInboxBadgeCount();

  const icons: Record<string, typeof Home> = {
    index: Home,
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
      {/* Pill holding the 3 primary tabs */}
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
        {state.routes.map((route, index) => {
          const isFocused = state.index === index;
          const Icon = icons[route.name] ?? Home;

          const onPress = () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params as object);
            }
          };

          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              hitSlop={10}
              accessibilityRole="tab"
              accessibilityState={{ selected: isFocused }}
              accessibilityLabel={route.name}
            >
              <TabIcon
                Icon={Icon}
                isFocused={isFocused}
                accent={c.accent}
                inactive={c.textTertiary}
                activeBg={c.accentSoft}
                badge={route.name === 'inbox' ? inboxBadge : undefined}
              />
            </Pressable>
          );
        })}
      </View>

      {/* Distinct search button, visually separated from navigation */}
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          router.push('/search');
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

export default function TabsLayout() {
  return (
    <Tabs tabBar={props => <CustomTabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" options={{ title: 'Pulse' }} />
      <Tabs.Screen name="inbox" options={{ title: 'Inbox' }} />
      <Tabs.Screen name="more" options={{ title: 'More' }} />
    </Tabs>
  );
}
