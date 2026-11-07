import { ClerkProvider } from '@clerk/expo';
import { tokenCache } from '@clerk/expo/token-cache';
import '../global.css';
import { Stack } from 'expo-router';
import { View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'nativewind';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useThemeSync } from '../src/hooks/useThemeSync';
import { useAuthGate } from '../src/hooks/useAuthGate';
import { GlobalAlertModal } from '../src/components/GlobalAlertModal';
import { BentoGridSkeleton } from '../src/components/PulsingSkeleton';
import { colors } from '../theme';

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY || "pk_test_placeholder_key_for_offline_runtime";

if (!process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY && !__DEV__) {
  console.warn("Missing EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY. Clerk auth will be limited in production.");
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: 1000 * 60 * 60 * 24, // 24 hours
      staleTime: 1000 * 60 * 5, // 5 minutes fresh window
      networkMode: 'offlineFirst',
      retry: (failureCount, error: any) => {
        // Do not retry on client auth or resource not found errors
        const status = error?.response?.status;
        if (status === 401 || status === 403 || status === 404) {
          return false;
        }
        return failureCount < 2;
      },
    },
    mutations: {
      networkMode: 'offlineFirst',
      retry: false,
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
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <BentoGridSkeleton />
    </View>
  );
}

function RootNavigator() {
  useThemeSync();
  const { isReady } = useAuthGate();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const c = isDark ? colors.dark : colors.light;

  if (!isReady) return <BootSplash />;

  return (
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
        <Stack.Screen name="biblio-assistant" options={{ headerShown: false }} />
        <Stack.Screen name="delete-account" options={{ headerShown: false }} />
        <Stack.Screen name="veto" options={{ headerShown: false }} />
        <Stack.Screen name="tokens" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
      </Stack>
      <GlobalAlertModal />
    </View>
  );
}

export default function RootLayout() {
  const { colorScheme } = useColorScheme();
  const c = colorScheme === 'dark' ? colors.dark : colors.light;

  return (
    <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: c.bg }}>
        <SafeAreaProvider style={{ flex: 1, backgroundColor: c.bg }}>
          <PersistQueryClientProvider client={queryClient} persistOptions={{ persister: asyncStoragePersister }}>
            <RootNavigator />
          </PersistQueryClientProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ClerkProvider>
  );
}