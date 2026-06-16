import { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { forgotPasswordSchema, ForgotPasswordFormData } from '@/utils/validation';
import { resetPassword } from '@/services/firebase/auth';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { FONT_SIZES, SPACING, ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';

export default function ForgotPasswordScreen() {
  const styles = useThemedStyles(createStyles);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const { control, handleSubmit, formState: { errors, isSubmitting } } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  const onSubmit = async (data: ForgotPasswordFormData) => {
    setError(null);
    try {
      await resetPassword(data.email);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send reset email');
    }
  };

  if (success) {
    return (
      <View style={styles.container}>
        <Text style={styles.successTitle}>Check your email</Text>
        <Text style={styles.successMessage}>
          We've sent password reset instructions to your email address.
        </Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <Text style={styles.description}>
        Enter your email and we'll send you a link to reset your password.
      </Text>

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

      {error && <Text style={styles.error} accessibilityRole="alert">{error}</Text>}

      <Button title="Send Reset Link" onPress={handleSubmit(onSubmit)} loading={isSubmitting} />
    </KeyboardAvoidingView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      padding: SPACING.lg,
      backgroundColor: colors.background,
    },
    description: {
      fontSize: FONT_SIZES.md,
      color: colors.textSecondary,
      marginBottom: SPACING.lg,
      lineHeight: 22,
    },
    error: {
      color: colors.danger,
      fontSize: FONT_SIZES.sm,
      marginBottom: SPACING.md,
    },
    successTitle: {
      fontSize: FONT_SIZES.xl,
      fontWeight: '600',
      color: colors.text,
      marginBottom: SPACING.md,
    },
    successMessage: {
      fontSize: FONT_SIZES.md,
      color: colors.textSecondary,
      lineHeight: 22,
    },
  });
}
