import { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useRouter, Link } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, LoginFormData } from '@/utils/validation';
import { signIn, logOut, loadAuthUserProfile } from '@/services/firebase/auth';
import { isFirebaseConfigured } from '@/services/firebase/config';
import { NO_PROFILE_ACCOUNT_MESSAGE } from '@/utils/authErrors';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { FirebaseSetupNotice } from '@/components/FirebaseSetupNotice';
import { FONT_SIZES, SPACING, BORDER_RADIUS, ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';

export default function LoginScreen() {
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const { control, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const firebaseReady = isFirebaseConfigured();

  const onSubmit = async (data: LoginFormData) => {
    if (!firebaseReady) {
      setError('Firebase is not configured. Add your .env keys and restart Expo.');
      return;
    }
    setError(null);
    try {
      await signIn(data.email, data.password);
      router.replace('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign in');
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
          <Text style={styles.tagline}>Because nobody's life is just the highlights.</Text>
        </View>

        {!firebaseReady && <FirebaseSetupNotice />}

        <View style={styles.formCard}>
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
              autoComplete="email"
            />
          )}
        />

        <Controller
          control={control}
          name="password"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              label="Password"
              placeholder="Your password"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={errors.password?.message}
              secureTextEntry
              autoComplete="password"
            />
          )}
        />

        {error && <Text style={styles.error} accessibilityRole="alert">{error}</Text>}

        <Button
          title="Sign In"
          onPress={handleSubmit(onSubmit)}
          loading={isSubmitting}
          disabled={!firebaseReady}
        />

        <Link href="/(auth)/forgot-password" style={styles.link}>
          <Text style={styles.linkText}>Forgot password?</Text>
        </Link>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Don't have an account? </Text>
          <Link href="/(auth)/signup">
            <Text style={styles.linkText}>Sign up</Text>
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
    },
    tagline: {
      fontSize: FONT_SIZES.sm,
      color: colors.textSecondary,
      marginTop: SPACING.sm,
      textAlign: 'center',
      lineHeight: 20,
      maxWidth: 260,
    },
    formCard: {
      backgroundColor: colors.surface,
      borderRadius: BORDER_RADIUS.lg,
      padding: SPACING.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    error: {
      color: colors.danger,
      fontSize: FONT_SIZES.sm,
      marginBottom: SPACING.md,
      textAlign: 'center',
    },
    link: {
      alignSelf: 'center',
      marginTop: SPACING.md,
    },
    linkText: {
      color: colors.primary,
      fontSize: FONT_SIZES.md,
      fontWeight: '500',
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
  });
}
