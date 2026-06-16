import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { getPost, updatePost } from '@/services/firebase/posts';
import { useAuthStore } from '@/store/authStore';
import { editPostSchema, EditPostFormData } from '@/utils/validation';
import { MOOD_TAGS, MoodTag } from '@/types';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { CrisisSupportModal } from '@/components/safety/CrisisSupportModal';
import { containsCrisisLanguage } from '@/utils';
import {
  FONT_SIZES,
  SPACING,
  BORDER_RADIUS,
  CAPTION_MAX_LENGTH,
  ThemeColors,
} from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { LoadingState } from '@/components/ui/LoadingState';
import { ErrorState } from '@/components/ui/ErrorState';

export default function EditPostScreen() {
  const styles = useThemedStyles(createStyles);
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { firebaseUser } = useAuthStore();
  const queryClient = useQueryClient();
  const [showCrisisModal, setShowCrisisModal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: post, isLoading, error: loadError, refetch } = useQuery({
    queryKey: ['post', id],
    queryFn: () => getPost(id!),
    enabled: !!id,
  });

  const { control, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } =
    useForm<EditPostFormData>({
      resolver: zodResolver(editPostSchema),
      defaultValues: { caption: '', moodTag: undefined },
    });

  const caption = watch('caption');
  const selectedMood = watch('moodTag');

  useEffect(() => {
    if (!post) return;
    setValue('caption', post.caption);
    setValue('moodTag', post.moodTag);
  }, [post, setValue]);

  const saveMutation = useMutation({
    mutationFn: (data: EditPostFormData) =>
      updatePost(id!, firebaseUser!.uid, {
        caption: data.caption,
        moodTag: data.moodTag as MoodTag,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['post', id] });
      queryClient.invalidateQueries({ queryKey: ['myPosts'] });
      queryClient.invalidateQueries({ queryKey: ['authorPosts'] });
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      router.back();
    },
    onError: (err) => {
      const message = err instanceof Error ? err.message : 'Failed to update post';
      setError(message);
      Alert.alert('Could not save changes', message);
    },
  });

  const handleCrisisEdit = () => {
    setShowCrisisModal(false);
  };

  const handleCrisisDismiss = () => {
    setShowCrisisModal(false);
  };

  const onSubmit = (data: EditPostFormData) => {
    if (!firebaseUser || !post || post.authorId !== firebaseUser.uid) return;

    if (containsCrisisLanguage(data.caption)) {
      setShowCrisisModal(true);
      return;
    }

    saveMutation.mutate(data);
  };

  if (isLoading) return <LoadingState />;
  if (loadError || !post) {
    return <ErrorState message="Post not found." onRetry={() => refetch()} />;
  }

  if (!firebaseUser || post.authorId !== firebaseUser.uid) {
    return <ErrorState message="You can only edit your own posts." />;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Edit post</Text>
      <Text style={styles.subheading}>Update your caption or mood. Media cannot be changed.</Text>

      <Controller
        control={control}
        name="caption"
        render={({ field: { onChange, onBlur, value } }) => (
          <Input
            label="Caption"
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            multiline
            numberOfLines={4}
            error={errors.caption?.message}
            maxLength={CAPTION_MAX_LENGTH}
          />
        )}
      />
      <Text style={styles.charCount}>
        {caption?.length ?? 0}/{CAPTION_MAX_LENGTH}
      </Text>

      <Text style={styles.label}>How are you feeling?</Text>
      <View style={styles.moodGrid}>
        {MOOD_TAGS.map((mood) => (
          <TouchableOpacity
            key={mood}
            style={[styles.moodChip, selectedMood === mood && styles.moodChipSelected]}
            onPress={() => setValue('moodTag', mood)}
          >
            <Text
              style={[
                styles.moodChipText,
                selectedMood === mood && styles.moodChipTextSelected,
              ]}
            >
              {mood}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      {errors.moodTag ? <Text style={styles.error}>{errors.moodTag.message}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Button
        title="Save changes"
        onPress={handleSubmit(onSubmit)}
        loading={isSubmitting || saveMutation.isPending}
        style={styles.saveButton}
      />

      <CrisisSupportModal
        visible={showCrisisModal}
        onEdit={handleCrisisEdit}
        onDismiss={handleCrisisDismiss}
      />
    </ScrollView>
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
      paddingBottom: SPACING.xxl,
    },
    heading: {
      fontSize: FONT_SIZES.xl,
      fontWeight: '700',
      color: colors.text,
      marginBottom: SPACING.xs,
    },
    subheading: {
      fontSize: FONT_SIZES.sm,
      color: colors.textMuted,
      marginBottom: SPACING.lg,
      lineHeight: 20,
    },
    charCount: {
      fontSize: FONT_SIZES.xs,
      color: colors.textMuted,
      textAlign: 'right',
      marginTop: -SPACING.sm,
      marginBottom: SPACING.md,
    },
    label: {
      fontSize: FONT_SIZES.sm,
      fontWeight: '600',
      color: colors.text,
      marginBottom: SPACING.sm,
    },
    moodGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: SPACING.sm,
      marginBottom: SPACING.lg,
    },
    moodChip: {
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
      borderRadius: BORDER_RADIUS.full,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    moodChipSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.accentSoft,
    },
    moodChipText: {
      fontSize: FONT_SIZES.sm,
      color: colors.textSecondary,
    },
    moodChipTextSelected: {
      color: colors.primary,
      fontWeight: '600',
    },
    error: {
      color: colors.danger,
      fontSize: FONT_SIZES.sm,
      marginBottom: SPACING.md,
    },
    saveButton: {
      marginTop: SPACING.md,
    },
  });
}
