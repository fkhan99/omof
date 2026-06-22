import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, AppState } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/store/authStore';
import {
  logOut,
  reloadCurrentUser,
  sendVerificationEmail,
} from '@/services/firebase/auth';
import { Button } from '@/components/ui/Button';
import { FONT_SIZES, SPACING, ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';

const RESEND_COOLDOWN_SECONDS = 30;
const POLL_INTERVAL_MS = 4000;

export default function VerifyEmailScreen() {
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const { firebaseUser, setFirebaseUser } = useAuthStore();
  const email = firebaseUser?.email ?? 'your email';

  const [checking, setChecking] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const autoSentRef = useRef(false);

  // If there is no signed-in user (e.g. opened directly), go back to login.
  useEffect(() => {
    if (!firebaseUser) {
      router.replace('/(auth)/login');
    }
  }, [firebaseUser, router]);

  // Send the verification email once when the screen first opens. This covers
  // both fresh signups and existing unverified accounts that now must verify.
  useEffect(() => {
    if (!firebaseUser || autoSentRef.current) return;
    autoSentRef.current = true;

    void sendVerificationEmail()
      .then(() => {
        setMessage(`Verification email sent to ${firebaseUser.email ?? 'your email'}.`);
        setCooldown(RESEND_COOLDOWN_SECONDS);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to send verification email.');
      });
  }, [firebaseUser]);

  const proceedIfVerified = useCallback(async (): Promise<boolean> => {
    const refreshed = await reloadCurrentUser();
    if (refreshed?.emailVerified) {
      setFirebaseUser(refreshed);
      router.replace('/');
      return true;
    }
    return false;
  }, [router, setFirebaseUser]);

  // Poll for verification and re-check whenever the app returns to foreground
  // (e.g. after the user taps the link in their email app).
  useEffect(() => {
    let cancelled = false;

    const interval = setInterval(() => {
      void proceedIfVerified();
    }, POLL_INTERVAL_MS);

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' && !cancelled) {
        void proceedIfVerified();
      }
    });

    return () => {
      cancelled = true;
      clearInterval(interval);
      subscription.remove();
    };
  }, [proceedIfVerified]);

  // Resend cooldown timer.
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const handleCheck = async () => {
    setChecking(true);
    setError(null);
    setMessage(null);
    try {
      const verified = await proceedIfVerified();
      if (!verified) {
        setError("We haven't received your verification yet. Tap the link in your email, then try again.");
      }
    } catch {
      setError('Could not check verification status. Please try again.');
    } finally {
      setChecking(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    setError(null);
    setMessage(null);
    try {
      await sendVerificationEmail();
      setMessage(`Verification email sent to ${email}.`);
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resend verification email.');
    } finally {
      setResending(false);
    }
  };

  const handleUseDifferentEmail = async () => {
    try {
      await logOut();
    } finally {
      router.replace('/(auth)/signup');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.logo} accessibilityRole="header">Verify your email</Text>
        <Text style={styles.subtitle}>
          We sent a verification link to{'\n'}
          <Text style={styles.email}>{email}</Text>
        </Text>
        <Text style={styles.body}>
          Open the email and tap the link to confirm it's really you. This screen updates
          automatically once you're verified.
        </Text>

        {message ? <Text style={styles.success} accessibilityRole="alert">{message}</Text> : null}
        {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}

        <Button
          title="I've verified — continue"
          onPress={handleCheck}
          loading={checking}
          style={styles.primaryButton}
        />

        <Button
          title={cooldown > 0 ? `Resend email (${cooldown}s)` : 'Resend email'}
          onPress={handleResend}
          loading={resending}
          disabled={cooldown > 0 || resending}
          variant="secondary"
          style={styles.secondaryButton}
        />

        <Button
          title="Use a different email"
          onPress={handleUseDifferentEmail}
          variant="ghost"
        />
      </View>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      flex: 1,
      justifyContent: 'center',
      padding: SPACING.lg,
      gap: SPACING.md,
    },
    logo: {
      fontSize: 28,
      fontWeight: '800',
      color: colors.text,
      textAlign: 'center',
    },
    subtitle: {
      fontSize: FONT_SIZES.md,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 24,
    },
    email: {
      fontWeight: '700',
      color: colors.text,
    },
    body: {
      fontSize: FONT_SIZES.sm,
      color: colors.textMuted,
      textAlign: 'center',
      lineHeight: 20,
      marginBottom: SPACING.sm,
    },
    success: {
      color: colors.primary,
      fontSize: FONT_SIZES.sm,
      textAlign: 'center',
    },
    error: {
      color: colors.danger,
      fontSize: FONT_SIZES.sm,
      textAlign: 'center',
    },
    primaryButton: {
      marginTop: SPACING.sm,
    },
    secondaryButton: {
      marginTop: SPACING.xs,
    },
  });
}
