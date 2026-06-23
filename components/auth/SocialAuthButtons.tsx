import { View, Text, StyleSheet, Platform } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Button } from '@/components/ui/Button';
import { FONT_SIZES, SPACING, BORDER_RADIUS, ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useAuthStore } from '@/store/authStore';
import {
  isAppleSignInAvailable,
  isGoogleSignInConfigured,
  requiresEmailVerification,
  signInWithSocialProvider,
  SocialAuthProvider,
} from '@/services/firebase/socialAuth';
import { loadAuthUserProfile } from '@/services/firebase/auth';
import { SignupCompliance } from '@/store/authStore';

interface SocialAuthButtonsProps {
  mode: 'login' | 'signup';
  disabled?: boolean;
  compliance?: SignupCompliance | null;
}

export function SocialAuthButtons({ mode, disabled = false, compliance = null }: SocialAuthButtonsProps) {
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const { setPendingSignupCompliance } = useAuthStore();
  const [loadingProvider, setLoadingProvider] = useState<SocialAuthProvider | null>(null);
  const [error, setError] = useState<string | null>(null);

  const showGoogle = isGoogleSignInConfigured();
  const showApple = isAppleSignInAvailable();

  if (!showGoogle && !showApple) {
    return null;
  }

  const ensureSignupCompliance = (): boolean => {
    if (mode !== 'signup') return true;
    if (compliance?.acceptedTerms && compliance?.confirmedAge) return true;
    setError('Please confirm your age and accept the Terms before continuing.');
    return false;
  };

  const handlePress = async (provider: SocialAuthProvider) => {
    if (disabled || loadingProvider) return;
    if (!ensureSignupCompliance()) return;

    setError(null);
    setLoadingProvider(provider);

    try {
      if (mode === 'signup' && compliance) {
        setPendingSignupCompliance(compliance);
      }

      const user = await signInWithSocialProvider(provider);

      if (requiresEmailVerification(user)) {
        router.replace('/(auth)/verify-email');
        return;
      }

      const profile = await loadAuthUserProfile(user.uid);
      router.replace(profile ? '/' : '/');
    } catch (err) {
      if (mode === 'signup') {
        setPendingSignupCompliance(null);
      }
      setError(err instanceof Error ? err.message : 'Sign-in failed. Please try again.');
    } finally {
      setLoadingProvider(null);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.dividerRow}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>or</Text>
        <View style={styles.dividerLine} />
      </View>

      {showGoogle ? (
        <Button
          title="Continue with Google"
          variant="secondary"
          onPress={() => handlePress('google')}
          loading={loadingProvider === 'google'}
          disabled={disabled || loadingProvider !== null}
          style={styles.button}
        />
      ) : null}

      {showApple ? (
        <Button
          title="Continue with Apple"
          variant="secondary"
          onPress={() => handlePress('apple')}
          loading={loadingProvider === 'apple'}
          disabled={disabled || loadingProvider !== null}
          style={styles.button}
        />
      ) : null}

      {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}

      {Platform.OS === 'android' && !showGoogle ? (
        <Text style={styles.hint}>Google sign-in requires EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID in .env.</Text>
      ) : null}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      gap: SPACING.sm,
    },
    dividerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
      marginVertical: SPACING.sm,
    },
    dividerLine: {
      flex: 1,
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.border,
    },
    dividerText: {
      color: colors.textMuted,
      fontSize: FONT_SIZES.sm,
      textTransform: 'lowercase',
    },
    button: {
      marginTop: 0,
    },
    error: {
      color: colors.danger,
      fontSize: FONT_SIZES.sm,
      textAlign: 'center',
    },
    hint: {
      color: colors.textMuted,
      fontSize: FONT_SIZES.xs,
      textAlign: 'center',
    },
  });
}
