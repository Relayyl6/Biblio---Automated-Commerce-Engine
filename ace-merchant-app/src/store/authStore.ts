import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface AuthState {
  merchantId: string | null;
  token: string | null;
  _hasHydrated: boolean;
  setAuth: (merchantId: string, token: string) => void;
  logout: () => void;
  setHasHydrated: (state: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      merchantId: null, // No more mocks. Starts null until authenticated.
      token: null,
      _hasHydrated: false,
      setAuth: (merchantId, token) => set({ merchantId, token }),
      logout: () => set({ merchantId: null, token: null }),
      setHasHydrated: (state) => set({ _hasHydrated: state }),
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ merchantId: state.merchantId, token: state.token }),
      onRehydrateStorage: () => (state, error) => {
        if (error) {
          console.error('Auth storage rehydration failed:', error);
        }
        useAuthStore.getState().setHasHydrated(true);
      },
    }
  )
);
