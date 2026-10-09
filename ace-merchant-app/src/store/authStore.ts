import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface AuthState {
  merchantId: string | null;
  token: string | null;
  setAuth: (merchantId: string, token: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      merchantId: null, // No more mocks. Starts null until authenticated.
      token: null,
      setAuth: (merchantId, token) => set({ merchantId, token }),
      logout: () => set({ merchantId: null, token: null }),
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
