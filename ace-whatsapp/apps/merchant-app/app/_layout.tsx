// merchant-app/app/_layout.tsx — expo-router root stack.
import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: "#0b6b3a" },
          headerTintColor: "#fff",
          headerTitleStyle: { fontWeight: "700" },
        }}
      >
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
