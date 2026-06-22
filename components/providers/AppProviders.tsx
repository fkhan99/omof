import { QueryClientProvider } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useFonts } from 'expo-font';
import { ReactNode } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';
import { queryClient } from '@/lib/queryClient';
import { useTheme } from '@/hooks/useTheme';

function FontLoadingGate({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  const [fontsLoaded, fontError] = useFonts(Ionicons.font);

  if (fontError) {
    console.error('Failed to load icon font', fontError);
  }

  if (!fontsLoaded && !fontError) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.background,
        }}
      >
        {Platform.OS === 'web' ? null : <ActivityIndicator color={colors.primary} />}
      </View>
    );
  }

  return <>{children}</>;
}

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <FontLoadingGate>{children}</FontLoadingGate>
    </QueryClientProvider>
  );
}
