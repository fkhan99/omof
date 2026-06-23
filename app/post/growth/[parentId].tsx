import { useEffect, useState } from 'react';
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
import { getEmailVerificationStatus } from '@/services/firebase/auth';
import { requiresEmailVerification } from '@/services/firebase/socialAuth';
import { useAuthStore } from '@/store/authStore';
import { OriginalMomentPreview } from '@/components/posts/OriginalMomentPreview';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { LoadingState } from '@/components/ui/LoadingState';
import { ErrorState } from '@/components/ui/ErrorState';
import { POSTS } from '@/constants/copy';
import { CAPTION_MAX_LENGTH, FONT_SIZES, SPACING, ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import {
  ModerationBlockedModal,
  ModerationGrowthModal,
  ModerationSupportModal,
} from '@/components/moderation/ModerationModals';
import {
  applyReflectionToCaption,
  evaluatePrePublish,
} from '@/services/moderation/prePublish';

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
  const setFirebaseUser = useAuthStore((s) => s.setFirebaseUser);
  const [showBlockedModal, setShowBlockedModal] = useState(false);
  const [blockedMessage, setBlockedMessage] = useState<string | undefined>();
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [showGrowthModal, setShowGrowthModal] = useState(false);
  const [pendingCaption, setPendingCaption] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [needsEmailVerification, setNeedsEmailVerification] = useState(false);
  const [checkingVerification, setCheckingVerification] = useState(false);

  useEffect(() => {
    if (!firebaseUser) {
      setNeedsEmailVerification(false);
      return;
    }

    void getEmailVerificationStatus().then((status) => {
      if (status.user) {
        setFirebaseUser(status.user);
      }
      setNeedsEmailVerification(
        requiresEmailVerification(status.user ?? firebaseUser)
          && (!status.authVerified || !status.tokenVerified),
      );
    });
  }, [firebaseUser, setFirebaseUser]);

  const { data: parentPost, isLoading, error, refetch } = useQuery({
    queryKey: ['post', parentId],
    queryFn: () => getPost(parentId!),
    enabled: !!parentId,
  });

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<GrowthFormData>({
    resolver: zodResolver(growthSchema),
    defaultValues: { caption: '' },
  });

  useEffect(() => {
    if (parentPost?.growthCaption) {
      reset({ caption: parentPost.growthCaption });
    }
  }, [parentPost?.growthCaption, reset]);

  const handleCheckVerification = async () => {
    setCheckingVerification(true);
    setSubmitError(null);
    try {
      const status = await getEmailVerificationStatus();
      if (status.user) {
        setFirebaseUser(status.user);
      }
      const pending = requiresEmailVerification(status.user ?? firebaseUser!)
        && (!status.authVerified || !status.tokenVerified);
      setNeedsEmailVerification(pending);
      if (pending) {
        Alert.alert(
          'Email not verified yet',
          'Open the verification link in your email, then tap this button again.',
          [
            { text: 'Go to verify screen', onPress: () => router.push('/(auth)/verify-email') },
            { text: 'OK', style: 'cancel' },
          ],
        );
      } else {
        Alert.alert('Email verified', 'You can share your growth update now.');
      }
    } finally {
      setCheckingVerification(false);
    }
  };

  const shareGrowth = async (caption: string) => {
    if (!profile || !firebaseUser || !parentId) return;

    setIsSharing(true);
    try {
      await createGrowthUpdate(
        {
          id: profile.id,
          username: profile.username,
          displayName: profile.displayName,
          photoURL: profile.photoURL,
        },
        parentId,
        caption.trim(),
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['myPosts'] }),
        queryClient.invalidateQueries({ queryKey: ['authorPosts'] }),
        queryClient.invalidateQueries({ queryKey: ['feed'] }),
        queryClient.invalidateQueries({ queryKey: ['sharedExperiences'] }),
        queryClient.invalidateQueries({ queryKey: ['post', parentId] }),
      ]);
      router.replace(`/post/${parentId}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Please try again.';
      setSubmitError(message);
      Alert.alert('Could not share update', message);
    } finally {
      setIsSharing(false);
    }
  };

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

    const status = await getEmailVerificationStatus();
    if (status.user) {
      setFirebaseUser(status.user);
    }

    const evaluation = evaluatePrePublish(data.caption);
    if (!evaluation.canPublish) {
      if (evaluation.blockedMessage) {
        setBlockedMessage(evaluation.blockedMessage);
        setShowBlockedModal(true);
        return;
      }
      if (evaluation.requiresSupportFlow) {
        setPendingCaption(data.caption);
        setShowSupportModal(true);
        return;
      }
      if (evaluation.requiresGrowthFlow) {
        setPendingCaption(data.caption);
        setShowGrowthModal(true);
        return;
      }
      return;
    }

    await shareGrowth(evaluation.caption);
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

        <OriginalMomentPreview post={parentPost} />

        {needsEmailVerification ? (
          <View style={styles.verifyBanner}>
            <Text style={styles.verifyText}>
              Verify your email to share growth updates. Open the link we sent you, then check status below.
            </Text>
            <Button
              title="Check verification status"
              variant="secondary"
              size="sm"
              onPress={() => void handleCheckVerification()}
              loading={checkingVerification}
            />
            <Button
              title="Open verify screen"
              variant="ghost"
              size="sm"
              onPress={() => router.push('/(auth)/verify-email')}
            />
          </View>
        ) : null}

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
          title={parentPost.growthCaption ? POSTS.editGrowthUpdate : 'Share growth update'}
          onPress={handleSharePress}
          loading={isSubmitting || isSharing}
          disabled={!profile || !firebaseUser}
          style={styles.submit}
        />
        {submitError ? <Text style={styles.submitError}>{submitError}</Text> : null}
      </ScrollView>

      <ModerationBlockedModal
        visible={showBlockedModal}
        message={blockedMessage}
        onClose={() => setShowBlockedModal(false)}
      />
      <ModerationSupportModal
        visible={showSupportModal}
        onEdit={() => {
          setShowSupportModal(false);
          setPendingCaption(null);
        }}
        onSubmitForReview={() => {
          setShowSupportModal(false);
          if (pendingCaption) {
            void shareGrowth(pendingCaption);
          }
          setPendingCaption(null);
        }}
      />
      <ModerationGrowthModal
        visible={showGrowthModal}
        onCancel={() => {
          setShowGrowthModal(false);
          setPendingCaption(null);
        }}
        onContinue={(reflection) => {
          setShowGrowthModal(false);
          if (!pendingCaption) return;
          void shareGrowth(applyReflectionToCaption(pendingCaption, reflection));
          setPendingCaption(null);
        }}
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
    verifyBanner: {
      gap: SPACING.sm,
      padding: SPACING.md,
      borderRadius: 12,
      backgroundColor: colors.accentSoft + '66',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    verifyText: {
      fontSize: FONT_SIZES.sm,
      color: colors.textSecondary,
      lineHeight: 20,
    },
    submitError: {
      fontSize: FONT_SIZES.sm,
      color: colors.danger,
      textAlign: 'center',
    },
  });
}
