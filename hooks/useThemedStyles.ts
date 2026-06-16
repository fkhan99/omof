import { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { ThemeColors } from '@/constants/theme';
import { useTheme } from './useTheme';

export function useThemedStyles<T extends StyleSheet.NamedStyles<T>>(
  factory: (colors: ThemeColors) => T,
): T {
  const { colors } = useTheme();
  return useMemo(() => StyleSheet.create(factory(colors)), [colors]);
}
