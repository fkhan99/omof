import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { reportSchema, ReportFormData } from '@/utils/validation';
import { reportContent } from '@/services/firebase/safety';
import { useAuthStore } from '@/store/authStore';
import { REPORT_REASONS, REPORT_REASON_LABELS, ReportReason } from '@/types';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { FONT_SIZES, SPACING, BORDER_RADIUS, ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';

export default function ReportScreen() {
  const styles = useThemedStyles(createStyles);
  const { targetType, targetId } = useLocalSearchParams<{
    targetType: 'post' | 'comment';
    targetId: string;
  }>();
  const router = useRouter();
  const { profile } = useAuthStore();
  const [error, setError] = useState<string | null>(null);

  const { control, handleSubmit, setValue, watch, formState: { errors, isSubmitting } } = useForm<ReportFormData>({
    resolver: zodResolver(reportSchema),
    defaultValues: { reason: undefined, details: '' },
  });

  const selectedReason = watch('reason');

  const onSubmit = async (data: ReportFormData) => {
    if (!profile) return;
    setError(null);

    try {
      await reportContent(
        profile.id,
        targetType as 'post' | 'comment',
        targetId!,
        data.reason as ReportReason,
        data.details,
      );
      Alert.alert('Report submitted', "Thank you. We'll review this content.", [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit report');
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>Report {targetType}</Text>
      <Text style={styles.subtitle}>Why are you reporting this content?</Text>

      {REPORT_REASONS.map((reason) => (
        <TouchableOpacity
          key={reason}
          style={[styles.reasonItem, selectedReason === reason && styles.reasonSelected]}
          onPress={() => setValue('reason', reason)}
          accessibilityRole="radio"
          accessibilityState={{ selected: selectedReason === reason }}
        >
          <Text style={styles.reasonText}>{REPORT_REASON_LABELS[reason]}</Text>
        </TouchableOpacity>
      ))}
      {errors.reason && <Text style={styles.error}>{errors.reason.message}</Text>}

      <Controller
        control={control}
        name="details"
        render={({ field: { onChange, onBlur, value } }) => (
          <Input
            label="Additional details (optional)"
            placeholder="Tell us more..."
            value={value ?? ''}
            onChangeText={onChange}
            onBlur={onBlur}
            multiline
            numberOfLines={3}
          />
        )}
      />

      {error && <Text style={styles.error}>{error}</Text>}

      <Button title="Submit Report" onPress={handleSubmit(onSubmit)} loading={isSubmitting} />
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
    content: {
      padding: SPACING.lg,
    },
    title: {
      fontSize: FONT_SIZES.xl,
      fontWeight: '600',
      color: colors.text,
      marginBottom: SPACING.sm,
    },
    subtitle: {
      fontSize: FONT_SIZES.md,
      color: colors.textSecondary,
      marginBottom: SPACING.lg,
    },
    reasonItem: {
      padding: SPACING.md,
      backgroundColor: colors.surface,
      borderRadius: BORDER_RADIUS.md,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: SPACING.sm,
      minHeight: 48,
      justifyContent: 'center',
    },
    reasonSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.accentSoft,
    },
    reasonText: {
      fontSize: FONT_SIZES.md,
      color: colors.text,
    },
    error: {
      color: colors.danger,
      fontSize: FONT_SIZES.sm,
      marginBottom: SPACING.md,
    },
  });
}
