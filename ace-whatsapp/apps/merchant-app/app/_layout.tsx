import { Stack, useRouter, useSegments } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useEffect, useState } from "react";
import * as SecureStore from "expo-secure-store";

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    async function checkAuth() {
      const token = await SecureStore.getItemAsync("ace_merchant_token");
      const inAuthGroup = segments[0] === "login";

      if (!token && !inAuthGroup) {
        router.replace("/login");
      } else if (token && inAuthGroup) {
        router.replace("/");
      }
      setIsReady(true);
    }
    checkAuth();
  }, [segments]);

  if (!isReady) return null;

  return (
    <SafeAreaProvider>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: "#0b6b3a" },
          headerTintColor: "#fff",
          headerTitleStyle: { fontWeight: "700" },
        }}
      >
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="index" options={{ title: "ACE · Command Center" }} />
        <Stack.Screen name="catalog" options={{ title: "Catalog" }} />
        <Stack.Screen name="settings" options={{ title: "Seller Voice & Settings" }} />
      </Stack>
    </SafeAreaProvider>
  );
}

// The demo merchant (matches infra/seed.sql). In a real build this comes from
// auth/session after login.
export const MERCHANT_ID = "11111111-1111-1111-1111-111111111111";
