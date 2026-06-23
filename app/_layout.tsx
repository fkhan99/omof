import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AppProviders } from '@/components/providers/AppProviders';
import { DeferredAppServices } from '@/components/providers/DeferredAppServices';
import { WebBootOverlay } from '@/components/ui/WebBootOverlay';
import { StackBackButton } from '@/components/navigation/StackBackButton';
import { useAuthListener } from '@/hooks/useAuthListener';
import { useEmailActionHandler } from '@/hooks/useEmailActionHandler';
import { useActivitySync } from '@/hooks/useActivitySync';
import { useTheme } from '@/hooks/useTheme';

function RootLayoutNav() {
  useAuthListener();
  useEmailActionHandler();
  useActivitySync();
  const { colors, isDark } = useTheme();

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.text,
          headerTitleStyle: { fontWeight: '700', color: colors.text, fontSize: 18 },
          headerShadowVisible: false,
          headerBackVisible: false,
          headerLeft: () => <StackBackButton />,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="post/[id]" options={{ title: 'Post' }} />
        <Stack.Screen name="post/edit/[id]" options={{ title: 'Edit Post' }} />
        <Stack.Screen name="post/growth/[parentId]" options={{ title: 'Growth Update' }} />
        <Stack.Screen name="post/promote/[id]" options={{ title: 'Promote Post' }} />
        <Stack.Screen name="user/[username]" options={{ title: 'Profile' }} />
        <Stack.Screen name="profile/edit" options={{ title: 'Edit Profile' }} />
        <Stack.Screen name="profile/following" options={{ title: 'Connected to' }} />
        <Stack.Screen name="profile/followers" options={{ title: 'Connections' }} />
        <Stack.Screen name="settings/index" options={{ title: 'Settings' }} />
        <Stack.Screen name="settings/subscription" options={{ title: 'OMOF Plus' }} />
        <Stack.Screen name="settings/privacy" options={{ title: 'Privacy & Data' }} />
        <Stack.Screen name="settings/privacy-policy" options={{ title: 'Privacy Policy' }} />
        <Stack.Screen name="settings/terms" options={{ title: 'Terms of Service' }} />
        <Stack.Screen name="settings/blocked" options={{ title: 'Blocked Users' }} />
        <Stack.Screen
          name="settings/community-guidelines"
          options={{ title: 'Community Guidelines' }}
        />
        <Stack.Screen name="report" options={{ title: 'Report', presentation: 'modal' }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <AppProviders>
      <DeferredAppServices>
        <RootLayoutNav />
        <WebBootOverlay />
      </DeferredAppServices>
    </AppProviders>
  );
}
