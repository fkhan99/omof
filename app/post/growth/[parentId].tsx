import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { getPost, createGrowthUpdate } from '@/services/firebase/posts';
import { reloadCurrentUser } from '@/services/firebase/auth';
import { useAuthStore } from '@/store/authStore';
import { GrowthUpdateCard } from '@/components/posts/GrowthUpdateCard';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { LoadingState } from '@/components/ui/LoadingState';
import { ErrorState } from '@/components/ui/ErrorState';
import { POSTS } from '@/constants/copy';
import { CAPTION_MAX_LENGTH, FONT_SIZES, SPACING, ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { containsProfanity, containsCrisisLanguage } from '@/utils';
import { CrisisSupportModal } from '@/components/safety/CrisisSupportModal';

const growthSchema = z.object({
  caption: z
    .string()
    .trim()
    .min(1, 'Share what changed')
    .max(CAPTION_MAX_LENGTH, `Keep it under ${CAPTION_MAX_LENGTH} characters`),
});

type GrowthFormData = z.infer<typeof growthSchema>;

export default function GrowthUpdateScreen() {
  const styles = useThemedStyles(createStyles);
  const params = useLocalSearchParams<{ parentId: string | string[] }>();
  const parentId = Array.isArray(params.parentId) ? params.parentId[0] : params.parentId;
  const router = useRouter();
  const queryClient = useQueryClient();
  const profile = useAuthStore((s) => s.profile);
  const firebaseUser = useAuthStore((s) => s.firebaseUser);
  const [crisisVisible, setCrisisVisible] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState(false);

  const { data: parentPost, isLoading, error, refetch } = useQuery({
    queryKey: ['post', parentId],
    queryFn: () => getPost(parentId!),
    enabled: !!parentId,
  });

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<GrowthFormData>({
    resolver: zodResolver(growthSchema),
    defaultValues: { caption: '' },
  });

  const onSubmit = async (data: GrowthFormData) => {
    setSubmitError(null);
    if (!profile || !firebaseUser) {
      Alert.alert('Please wait', 'Your profile is still loading. Try again in a moment.');
      return;
    }
    if (!parentId) {
      Alert.alert('Missing post', 'Could not find the original moment.');
      return;
    }

    const refreshedUser = await reloadCurrentUser();
    if (!refreshedUser?.emailVerified) {
      Alert.alert(
        'Verify your email',
        'You need a verified email before sharing a growth update.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Verify email', onPress: () => router.push('/(auth)/verify-email') },
        ],
      );
      return;
    }

    if (containsProfanity(data.caption)) {
      Alert.alert('Please revise', 'Remove inappropriate language before sharing.');
      return;
    }
    if (containsCrisisLanguage(data.caption)) {
      setCrisisVisible(true);
      return;
    }

    setIsSharing(true);
    try {
      const post = await createGrowthUpdate(
        {
          id: profile.id,
          username: profile.username,
          displayName: profile.displayName,
          photoURL: profile.photoURL,
        },
        parentId,
        data.caption.trim(),
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['myPosts'] }),
        queryClient.invalidateQueries({ queryKey: ['authorPosts'] }),
        queryClient.invalidateQueries({ queryKey: ['feed'] }),
        queryClient.invalidateQueries({ queryKey: ['sharedExperiences'] }),
        queryClient.invalidateQueries({ queryKey: ['post', parentId] }),
      ]);
      router.replace(`/post/${post.id}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Please try again.';
      setSubmitError(message);
      Alert.alert('Could not share update', message);
    } finally {
      setIsSharing(false);
    }
  };

  const handleSharePress = () => {
    void handleSubmit(onSubmit)();
  };

  if (!parentId) {
    return <ErrorState message="Original moment not found." />;
  }

  if (isLoading) return <LoadingState />;
  if (error || !parentPost) {
    return <ErrorState message="Original moment not found." onRetry={() => refetch()} />;
  }

  if (profile?.id !== parentPost.authorId && firebaseUser?.uid !== parentPost.authorId) {
    return <ErrorState message="You can only add growth updates to your own moments." />;
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>{POSTS.growthUpdateTitle}</Text>
        <Text style={styles.hint}>{POSTS.growthUpdateHint}</Text>

        <GrowthUpdateCard post={parentPost} />

        <Controller
          control={control}
          name="caption"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              label="Your growth update"
              placeholder="What changed? What helped? What did you learn?"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              multiline
              numberOfLines={5}
              style={styles.captionInput}
              error={errors.caption?.message}
              required
            />
          )}
        />

        <Button
          title="Share growth update"
          onPress={handleSharePress}
          loading={isSubmitting || isSharing}
          disabled={!profile || !firebaseUser}
          style={styles.submit}
        />
        {submitError ? <Text style={styles.submitError}>{submitError}</Text> : null}
      </ScrollView>

      <CrisisSupportModal
        visible={crisisVisible}
        onDismiss={() => setCrisisVisible(false)}
        onEdit={() => setCrisisVisible(false)}
      />
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
      padding: SPACING.md,
      gap: SPACING.md,
    },
    title: {
      fontSize: FONT_SIZES.xl,
      fontWeight: '700',
      color: colors.text,
    },
    hint: {
      fontSize: FONT_SIZES.sm,
      color: colors.textMuted,
      lineHeight: 20,
    },
    submit: {
      marginTop: SPACING.sm,
    },
    captionInput: {
      minHeight: 120,
      textAlignVertical: 'top',
    },
    submitError: {
      fontSize: FONT_SIZES.sm,
      color: colors.danger,
      textAlign: 'center',
    },
  });
}
