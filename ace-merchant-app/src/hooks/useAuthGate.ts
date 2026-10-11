import { useEffect, useState } from 'react';
import { useRouter, useSegments } from 'expo-router';
import { useAuthStore } from '../store/authStore';

/**
 * Redirects to /login when logged out and back to / when logged in,
 * same behavior as before — but now returns `isReady` so the root
 * layout can hold a splash frame instead of flashing the wrong
 * screen for one tick while segments/auth settle on cold start.
 */
export function useAuthGate() {
  const merchantId = useAuthStore(state => state.merchantId);
  const segments = useSegments();
  const router = useRouter();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const inAuthGroup = segments[0] === 'login';
    if (!merchantId && !inAuthGroup) {
      router.replace('/login');
    } else if (merchantId && inAuthGroup) {
      router.replace('/');
    }
    setIsReady(true);
  }, [merchantId, segments]);

  return { isReady };
}
