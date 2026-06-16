import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AppProviders } from '@/components/providers/AppProviders';
import { useAuthListener } from '@/hooks/useAuthListener';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useFollowRelationshipSync } from '@/hooks/useFollowRelationshipSync';
import { useActivitySync } from '@/hooks/useActivitySync';
import { useTheme } from '@/hooks/useTheme';

function RootLayoutNav() {
  useAuthListener();
  usePushNotifications();
  useFollowRelationshipSync();
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
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(onboarding)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="post/[id]" options={{ title: 'Post' }} />
        <Stack.Screen name="post/edit/[id]" options={{ title: 'Edit Post' }} />
        <Stack.Screen name="post/promote/[id]" options={{ title: 'Promote Post' }} />
        <Stack.Screen name="user/[username]" options={{ title: 'Profile' }} />
        <Stack.Screen name="profile/edit" options={{ title: 'Edit Profile' }} />
        <Stack.Screen name="profile/following" options={{ title: 'Following' }} />
        <Stack.Screen name="profile/followers" options={{ title: 'Followers' }} />
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
      <RootLayoutNav />
    </AppProviders>
  );
}
