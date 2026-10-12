import '../global.css';
import { Stack } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'nativewind';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ThemeProvider, DarkTheme, DefaultTheme } from '@react-navigation/native';
import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useThemeSync } from '../src/hooks/useThemeSync';
import { useAuthGate } from '../src/hooks/useAuthGate';
import { GlobalAlertModal } from '../src/components/GlobalAlertModal';
import { colors } from '../theme';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: 1000 * 60 * 60 * 24, // 24 hours
      staleTime: 1000 * 60 * 5, // 5 minutes fresh window
      networkMode: 'offlineFirst',
    },
    mutations: {
      networkMode: 'offlineFirst',
    },
  },
});

const asyncStoragePersister = createAsyncStoragePersister({
  storage: AsyncStorage,
});

function BootSplash() {
  const { colorScheme } = useColorScheme();
  const c = colorScheme === 'dark' ? colors.dark : colors.light;
  return (
    <View style={{ flex: 1, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator size="large" color={c.accent} />
    </View>
  );
}

function RootNavigator() {
  useThemeSync();
  const { isReady } = useAuthGate();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const c = isDark ? colors.dark : colors.light;

  const navTheme = {
    dark: isDark,
    colors: {
      primary: c.accent,
      background: c.bg,
      card: c.surface,
      text: c.textPrimary,
      border: c.border,
      notification: c.accent,
    },
    fonts: isDark ? DarkTheme.fonts : DefaultTheme.fonts,
  };

  if (!isReady) return <BootSplash />;

  return (
    <ThemeProvider value={navTheme}>
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: c.bg },
            animation: 'fade',
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="suppliers" options={{ headerShown: false }} />
          <Stack.Screen name="crm" options={{ headerShown: false }} />
          <Stack.Screen name="chats" options={{ headerShown: false }} />
          <Stack.Screen name="chat/[id]" options={{ headerShown: false }} />
          <Stack.Screen name="finance" options={{ headerShown: false }} />
          <Stack.Screen name="settings" options={{ headerShown: false }} />
          <Stack.Screen name="support" options={{ headerShown: false }} />
          <Stack.Screen name="notifications" options={{ headerShown: false }} />
          <Stack.Screen name="notification-history" options={{ headerShown: false }} />
          <Stack.Screen name="search" options={{ headerShown: false }} />
          <Stack.Screen name="login" options={{ headerShown: false }} />
        </Stack>
        <GlobalAlertModal />
      </View>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  const { colorScheme } = useColorScheme();
  const c = colorScheme === 'dark' ? colors.dark : colors.light;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: c.bg }}>
      <SafeAreaProvider style={{ flex: 1, backgroundColor: c.bg }}>
        <PersistQueryClientProvider client={queryClient} persistOptions={{ persister: asyncStoragePersister }}>
          <RootNavigator />
        </PersistQueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
