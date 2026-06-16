import { useColorScheme } from 'react-native';
import { useMemo } from 'react';
import { DARK_COLORS, LIGHT_COLORS, ThemeColors } from '@/constants/theme';
import { useThemeStore, ThemeMode } from '@/store/themeStore';

export function useTheme() {
  const systemScheme = useColorScheme();
  const mode = useThemeStore((state) => state.mode);
  const setMode = useThemeStore((state) => state.setMode);

  const isDark = mode === 'dark' || (mode === 'system' && systemScheme === 'dark');

  const colors = useMemo<ThemeColors>(
    () => (isDark ? DARK_COLORS : LIGHT_COLORS),
    [isDark],
  );

  return { colors, isDark, mode, setMode };
}

export type { ThemeMode };
