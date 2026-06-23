import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useRouter, Link, useLocalSearchParams } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { signupSchema, SignupFormData } from '@/utils/validation';
import { signUp } from '@/services/firebase/auth';
import { useAuthStore } from '@/store/authStore';
import { SocialAuthButtons } from '@/components/auth/SocialAuthButtons';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { MINIMUM_AGE } from '@/constants/legal';
import { NO_ACCOUNT_SIGNUP_PROMPT } from '@/utils/authErrors';
import { FONT_SIZES, SPACING, BORDER_RADIUS, ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';

export default function SignupScreen() {
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const { email: emailParam, reason } = useLocalSearchParams<{
    email?: string;
    reason?: string;
  }>();
  const { setPendingSignupCompliance } = useAuthStore();
  const [error, setError] = useState<string | null>(null);
  const showNoAccountPrompt = reason === 'no_account';

  const { control, handleSubmit, setValue, watch, formState: { errors, isSubmitting } } = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      email: '',
      password: '',
      confirmPassword: '',
      acceptedTerms: false,
      confirmedAge: false,
    },
  });

  useEffect(() => {
    if (typeof emailParam === 'string' && emailParam.trim()) {
      setValue('email', emailParam.trim());
    }
  }, [emailParam, setValue]);

  const acceptedTerms = watch('acceptedTerms');
  const confirmedAge = watch('confirmedAge');

  const onSubmit = async (data: SignupFormData) => {
    setError(null);
    try {
      setPendingSignupCompliance({
        acceptedTerms: data.acceptedTerms,
        confirmedAge: data.confirmedAge,
      });
      await signUp(data.email, data.password);
      router.replace('/(auth)/verify-email');
    } catch (err) {
      setPendingSignupCompliance(null);
      setError(err instanceof Error ? err.message : 'Failed to create account');
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.logo} accessibilityRole="header">OMOF</Text>
          <Text style={styles.subtitle}>Join a community that values authenticity.</Text>
        </View>

        <View style={styles.formCard}>
        {showNoAccountPrompt && (
          <View style={styles.promptBanner} accessibilityRole="text">
            <Text style={styles.promptText}>{NO_ACCOUNT_SIGNUP_PROMPT}</Text>
          </View>
        )}

        <SocialAuthButtons
          mode="signup"
          compliance={{ acceptedTerms, confirmedAge }}
        />

        <Controller
          control={control}
          name="email"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              label="Email"
              placeholder="you@example.com"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={errors.email?.message}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          )}
        />

        <Controller
          control={control}
          name="password"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              label="Password"
              placeholder="At least 6 characters"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={errors.password?.message}
              secureTextEntry
            />
          )}
        />

        <Controller
          control={control}
          name="confirmPassword"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              label="Confirm Password"
              placeholder="Repeat your password"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={errors.confirmPassword?.message}
              secureTextEntry
            />
          )}
        />

        <Controller
          control={control}
          name="confirmedAge"
          render={({ field: { value, onChange } }) => (
            <Checkbox
              checked={value}
              onToggle={() => onChange(!value)}
              error={errors.confirmedAge?.message}
              label={`I confirm I am at least ${MINIMUM_AGE} years old.`}
            />
          )}
        />

        <Controller
          control={control}
          name="acceptedTerms"
          render={({ field: { value, onChange } }) => (
            <Checkbox
              checked={value}
              onToggle={() => onChange(!value)}
              error={errors.acceptedTerms?.message}
              label={
                <Text style={styles.legalText}>
                  I agree to the{' '}
                  <Link href="/settings/terms" style={styles.linkText}>Terms of Service</Link>
                  {' '}and{' '}
                  <Link href="/settings/privacy-policy" style={styles.linkText}>Privacy Policy</Link>.
                </Text>
              }
            />
          )}
        />

        {error && <Text style={styles.error} accessibilityRole="alert">{error}</Text>}

        <Button title="Create Account" onPress={handleSubmit(onSubmit)} loading={isSubmitting} />
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account? </Text>
          <Link href="/(auth)/login">
            <Text style={styles.linkText}>Sign in</Text>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scroll: {
      flexGrow: 1,
      justifyContent: 'center',
      padding: SPACING.lg,
    },
    header: {
      alignItems: 'center',
      marginBottom: SPACING.xl,
    },
    logo: {
      fontSize: 44,
      fontWeight: '800',
      color: colors.text,
      letterSpacing: 3,
      marginBottom: SPACING.sm,
    },
    subtitle: {
      fontSize: FONT_SIZES.sm,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
      maxWidth: 280,
    },
    formCard: {
      backgroundColor: colors.surface,
      borderRadius: BORDER_RADIUS.lg,
      padding: SPACING.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    promptBanner: {
      backgroundColor: colors.background,
      borderRadius: BORDER_RADIUS.md,
      padding: SPACING.md,
      marginBottom: SPACING.md,
      borderWidth: 1,
      borderColor: colors.primary,
    },
    promptText: {
      fontSize: FONT_SIZES.sm,
      color: colors.text,
      textAlign: 'center',
      lineHeight: 20,
    },
    legalText: {
      fontSize: FONT_SIZES.sm,
      color: colors.textSecondary,
      lineHeight: 20,
    },
    error: {
      color: colors.danger,
      fontSize: FONT_SIZES.sm,
      marginBottom: SPACING.md,
    },
    footer: {
      flexDirection: 'row',
      justifyContent: 'center',
      marginTop: SPACING.xl,
    },
    footerText: {
      color: colors.textSecondary,
      fontSize: FONT_SIZES.md,
    },
    linkText: {
      color: colors.link,
      fontSize: FONT_SIZES.sm,
      fontWeight: '700',
      textDecorationLine: 'underline',
      textDecorationColor: colors.link,
    },
  });
}
