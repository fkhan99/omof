import { View, Text, StyleSheet, Platform } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { User as FirebaseUser } from 'firebase/auth';
import { Button } from '@/components/ui/Button';
import { GoogleSignInButton } from '@/components/auth/GoogleSignInButton';
import { FONT_SIZES, SPACING, ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useAuthStore } from '@/store/authStore';
import {
  isAppleSignInAvailable,
  isGoogleSignInConfigured,
  requiresEmailVerification,
  signInWithApple,
  signInWithGoogleIdToken,
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
  const [loadingApple, setLoadingApple] = useState(false);
  const [loadingGoogle, setLoadingGoogle] = useState(false);
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

  const finishSignIn = async (user: FirebaseUser) => {
    if (requiresEmailVerification(user)) {
      router.replace('/(auth)/verify-email');
      return;
    }

    const profile = await loadAuthUserProfile(user.uid);
    router.replace(profile ? '/' : '/');
  };

  const handleGoogleSuccess = async (userOrToken: FirebaseUser | string) => {
    if (disabled || loadingGoogle || loadingApple) return;
    if (!ensureSignupCompliance()) return;

    setError(null);
    setLoadingGoogle(true);

    try {
      if (mode === 'signup' && compliance) {
        setPendingSignupCompliance(compliance);
      }

      const user =
        typeof userOrToken === 'string'
          ? await signInWithGoogleIdToken(userOrToken)
          : userOrToken;

      await finishSignIn(user);
    } catch (err) {
      if (mode === 'signup') {
        setPendingSignupCompliance(null);
      }
      setError(err instanceof Error ? err.message : 'Google sign-in failed. Please try again.');
    } finally {
      setLoadingGoogle(false);
    }
  };

  const handleApplePress = async () => {
    if (disabled || loadingGoogle || loadingApple) return;
    if (!ensureSignupCompliance()) return;

    setError(null);
    setLoadingApple(true);

    try {
      if (mode === 'signup' && compliance) {
        setPendingSignupCompliance(compliance);
      }

      const user = await signInWithApple();
      await finishSignIn(user);
    } catch (err) {
      if (mode === 'signup') {
        setPendingSignupCompliance(null);
      }
      setError(err instanceof Error ? err.message : 'Apple sign-in failed. Please try again.');
    } finally {
      setLoadingApple(false);
    }
  };

  const isBusy = disabled || loadingGoogle || loadingApple;

  return (
    <View style={styles.container}>
      {showGoogle ? (
        Platform.OS === 'web' ? (
          <GoogleSignInButton
            disabled={isBusy}
            onSuccess={(idToken) => {
              void handleGoogleSuccess(idToken);
            }}
            onError={setError}
          />
        ) : (
          <GoogleSignInButton
            disabled={isBusy}
            loading={loadingGoogle}
            onSuccess={(user) => {
              void handleGoogleSuccess(user);
            }}
            onError={setError}
          />
        )
      ) : null}

      {showApple ? (
        <Button
          title="Continue with Apple"
          variant="secondary"
          onPress={handleApplePress}
          loading={loadingApple}
          disabled={isBusy}
          style={styles.button}
        />
      ) : null}

      {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}

      <View style={styles.dividerRow}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>or</Text>
        <View style={styles.dividerLine} />
      </View>
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
  });
}
