import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, AppState, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/store/authStore';
import {
  reloadCurrentUser,
  loadAuthUserProfile,
} from '@/services/firebase/auth';
import { abandonUnverifiedSignup } from '@/services/firebase/abandonUnverifiedSignup';
import { clearUserPostQueries } from '@/lib/queryClient';
import { confirmAction } from '@/utils/confirm';
import {
  completeEmailVerificationFromLink,
  isEmailVerificationLink,
  navigateAfterEmailVerification,
  stripEmailActionQueryFromUrl,
} from '@/utils/firebaseEmailActions';
import {
  FIREBASE_AUTH_FALLBACK_SENDER,
  VERIFICATION_SENDER_EMAIL,
} from '@/constants/email';
import {
  VERIFICATION_EMAIL_SENT_MESSAGE,
  VERIFICATION_RESEND_COOLDOWN_SECONDS,
} from '@/constants/emailVerification';
import {
  getVerificationEmailSentAt,
  resendCooldownRemainingSeconds,
} from '@/utils/verificationEmailSendState';
import { Button } from '@/components/ui/Button';
import { FONT_SIZES, SPACING, ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';

const POLL_INTERVAL_MS = 4000;

export default function VerifyEmailScreen() {
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const { firebaseUser, setFirebaseUser, reset, setPendingSignupCompliance } = useAuthStore();
  const email = firebaseUser?.email ?? 'your email';

  const [checking, setChecking] = useState(false);
  const [resending, setResending] = useState(false);
  const [switchingEmail, setSwitchingEmail] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isSwitchingEmailRef = useRef(false);

  useEffect(() => {
    if (
      Platform.OS === 'web' &&
      typeof window !== 'undefined' &&
      isEmailVerificationLink(window.location.search)
    ) {
      return;
    }
    if (!firebaseUser && !isSwitchingEmailRef.current) {
      router.replace('/(auth)/login');
    }
  }, [firebaseUser, router]);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const search = window.location.search;
    if (!isEmailVerificationLink(search)) return;

    void (async () => {
      try {
        const result = await completeEmailVerificationFromLink(search);
        stripEmailActionQueryFromUrl('/verify-email');
        if (result?.verified) {
          await navigateAfterEmailVerification(router, result, setFirebaseUser);
        }
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'That verification link is invalid or expired. Resend a new email.',
        );
        stripEmailActionQueryFromUrl('/verify-email');
      }
    })();
  }, [router, setFirebaseUser]);

  // Restore resend cooldown from signup send — never auto-send on mount or refresh.
  useEffect(() => {
    const uid = firebaseUser?.uid;
    if (!uid) return;

    void getVerificationEmailSentAt(uid).then((sentAt) => {
      setCooldown(resendCooldownRemainingSeconds(sentAt, VERIFICATION_RESEND_COOLDOWN_SECONDS));
      if (sentAt !== null) {
        setMessage(VERIFICATION_EMAIL_SENT_MESSAGE);
      } else {
        setMessage(
          'Check your inbox for the verification email from when you signed up. You can resend below if needed.',
        );
      }
    });
  }, [firebaseUser?.uid]);

  const proceedIfVerified = useCallback(async (): Promise<boolean> => {
    const refreshed = await reloadCurrentUser();
    if (refreshed?.emailVerified) {
      setFirebaseUser(refreshed);
      const profile = await loadAuthUserProfile(refreshed.uid);
      router.replace(profile ? '/(tabs)' : '/onboarding');
      return true;
    }
    return false;
  }, [router, setFirebaseUser]);

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

    const onVisibilityChange = () => {
      if (
        !cancelled &&
        typeof document !== 'undefined' &&
        document.visibilityState === 'visible'
      ) {
        void proceedIfVerified();
      }
    };
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibilityChange);
    }

    return () => {
      cancelled = true;
      clearInterval(interval);
      subscription.remove();
      if (Platform.OS === 'web' && typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibilityChange);
      }
    };
  }, [proceedIfVerified]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const handleCheck = async () => {
    setChecking(true);
    setError(null);
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
    if (cooldown > 0) return;

    setResending(true);
    setError(null);
    try {
      const { resendVerificationEmail } = await import('@/services/firebase/verificationEmailResend');
      await resendVerificationEmail();
      setMessage(VERIFICATION_EMAIL_SENT_MESSAGE);
      setCooldown(VERIFICATION_RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resend verification email.');
    } finally {
      setResending(false);
    }
  };

  const performSwitchEmail = async () => {
    isSwitchingEmailRef.current = true;
    setSwitchingEmail(true);
    setError(null);
    try {
      await abandonUnverifiedSignup();
      clearUserPostQueries();
      reset();
      setPendingSignupCompliance(null);
      router.replace('/(auth)/signup');
    } catch (err) {
      isSwitchingEmailRef.current = false;
      setError(err instanceof Error ? err.message : 'Could not remove this account. Please try again.');
    } finally {
      setSwitchingEmail(false);
    }
  };

  const handleUseDifferentEmail = () => {
    confirmAction(
      'Use a different email',
      "This unverified account will be deleted and you'll return to sign up. Continue?",
      () => {
        void performSwitchEmail();
      },
      'Continue',
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.logo} accessibilityRole="header">Verify your email</Text>
        <Text style={styles.subtitle}>
          Check your inbox at{'\n'}
          <Text style={styles.email}>{email}</Text>
        </Text>
        <Text style={styles.body}>
          Open the email and tap the link — you'll go straight to profile setup once
          verified. Check your spam, promotions, and All Mail — the sender is usually{' '}
          <Text style={styles.email}>{VERIFICATION_SENDER_EMAIL}</Text> if SMTP is configured,
          or <Text style={styles.email}>{FIREBASE_AUTH_FALLBACK_SENDER}</Text> otherwise.
          This screen updates automatically once you're verified.
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
          loading={switchingEmail}
          disabled={switchingEmail || checking || resending}
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
      color: colors.success,
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
