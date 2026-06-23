import { Stack } from 'expo-router';
import { useTheme } from '@/hooks/useTheme';
import { StackBackButton } from '@/components/navigation/StackBackButton';
import { AuthProviders } from '@/components/auth/AuthProviders';

export default function AuthLayout() {
  const { colors } = useTheme();

  return (
    <AuthProviders>
      <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        headerShadowVisible: false,
        headerBackVisible: false,
        headerLeft: () => <StackBackButton />,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="login" options={{ title: 'Sign In', headerShown: false }} />
      <Stack.Screen name="signup" options={{ title: 'Sign Up', headerShown: true }} />
      <Stack.Screen name="forgot-password" options={{ title: 'Reset Password' }} />
      <Stack.Screen name="verify-email" options={{ title: 'Verify Email', headerShown: false }} />
    </Stack>
    </AuthProviders>
  );
}
