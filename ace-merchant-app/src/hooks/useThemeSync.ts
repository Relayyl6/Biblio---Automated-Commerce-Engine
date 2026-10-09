import { useEffect } from 'react';
import { useColorScheme } from 'nativewind';
import { useThemeStore } from '../store/themeStore';

/** Keeps NativeWind's color scheme in sync with the persisted theme store. */
export function useThemeSync() {
  const { theme } = useThemeStore();
  const { setColorScheme } = useColorScheme();

  useEffect(() => {
    setColorScheme(theme);
  }, [theme, setColorScheme]);
}
