import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getPost } from '@/services/firebase/posts';
import {
  createPromotion,
  getActivePromotionForPost,
  getActivePromotionsByOwner,
} from '@/services/firebase/promotions';
import { useAuthStore } from '@/store/authStore';
import {
  PROMOTION_DURATIONS,
  PROMOTION_GOALS,
  PROMOTION_GOAL_LABELS,
  PromotionDurationDays,
  PromotionGoal,
} from '@/types';
import { Button } from '@/components/ui/Button';
import { LoadingState } from '@/components/ui/LoadingState';
import { ErrorState } from '@/components/ui/ErrorState';
import { PostMedia } from '@/components/posts/PostMedia';
import { FONT_SIZES, SPACING, BORDER_RADIUS, ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/hooks/useTheme';
import { canUserPromote } from '@/services/firebase/promotions';
import { getUserProfile } from '@/services/firebase/auth';

export default function PromotePostScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { profile, firebaseUser, setProfile } = useAuthStore();
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const authUid = firebaseUser?.uid;

  const [goal, setGoal] = useState<PromotionGoal>('views');
  const [durationDays, setDurationDays] = useState<PromotionDurationDays>(3);

  const { data: post, isLoading, error, refetch } = useQuery({
    queryKey: ['post', id],
    queryFn: () => getPost(id!),
    enabled: !!id,
  });

  const { data: existingPromotion } = useQuery({
    queryKey: ['promotion', id],
    queryFn: () => getActivePromotionForPost(id!),
    enabled: !!id,
  });

  const { data: ownerActivePromotions } = useQuery({
    queryKey: ['myActivePromotions', authUid],
    queryFn: () => getActivePromotionsByOwner(authUid!),
    enabled: !!authUid && profile?.plan === 'free',
  });

  const promoteMutation = useMutation({
    mutationFn: () => createPromotion(authUid!, id!, goal, durationDays),
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['promotion', id] });
      queryClient.invalidateQueries({ queryKey: ['myActivePromotions', authUid] });
      queryClient.invalidateQueries({ queryKey: ['explore'] });
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      if (authUid) {
        const refreshed = await getUserProfile(authUid);
        if (refreshed) setProfile(refreshed);
      }
      Alert.alert('Promotion started', 'Your post will appear higher in Explore and Feed.');
      router.back();
    },
    onError: (err) => {
      Alert.alert('Promotion failed', err instanceof Error ? err.message : 'Try again.');
    },
  });

  if (isLoading) return <LoadingState />;
  if (error || !post) return <ErrorState message="Post not found." onRetry={() => refetch()} />;
  if (!profile || !authUid || post.authorId !== authUid) {
    return <ErrorState message="You can only promote your own posts." />;
  }

  if (existingPromotion) {
    return (
      <View style={styles.container}>
        <Text style={styles.activeTitle}>Already promoted</Text>
        <Text style={styles.activeMessage}>
          This post is active until {existingPromotion.expiresAt.toLocaleDateString()}.
        </Text>
        <Button title="Back" variant="secondary" onPress={() => router.back()} />
      </View>
    );
  }

  const freeLimitReached =
    profile.plan === 'free' && (ownerActivePromotions?.length ?? 0) > 0;
  const canPromote =
    canUserPromote(profile.plan, profile.promotionCredits) && !freeLimitReached;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Promote post</Text>
      <Text style={styles.description}>
        Boost visibility inside OMOF. Choose a goal and how long to run your promotion.
      </Text>

      <PostMedia post={post} mode="preview" />

      <Text style={styles.sectionTitle}>Promotion goal</Text>
      <View style={styles.options}>
        {PROMOTION_GOALS.map((option) => (
          <TouchableOpacity
            key={option}
            style={[styles.option, goal === option && styles.optionSelected]}
            onPress={() => setGoal(option)}
          >
            <Text style={[styles.optionText, goal === option && styles.optionTextSelected]}>
              {PROMOTION_GOAL_LABELS[option]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.sectionTitle}>Duration</Text>
      <View style={styles.options}>
        {PROMOTION_DURATIONS.map((days) => (
          <TouchableOpacity
            key={days}
            style={[styles.option, durationDays === days && styles.optionSelected]}
            onPress={() => setDurationDays(days)}
          >
            <Text style={[styles.optionText, durationDays === days && styles.optionTextSelected]}>
              {days} {days === 1 ? 'day' : 'days'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {profile.plan === 'plus' ? (
        <Text style={styles.creditsNote}>
          Uses 1 promotion credit · {profile.promotionCredits} remaining
        </Text>
      ) : (
        <Text style={styles.creditsNote}>Free plan: 1 active promotion at a time.</Text>
      )}

      <Button
        title={promoteMutation.isPending ? 'Starting...' : 'Start promotion'}
        onPress={() => promoteMutation.mutate()}
        loading={promoteMutation.isPending}
        disabled={!canPromote || promoteMutation.isPending}
        style={styles.submit}
      />

      {!canPromote ? (
        <Text style={[styles.creditsNote, { color: colors.danger }]}>
          {freeLimitReached
            ? 'You already have an active promotion. Free plan allows 1 at a time — wait for it to end or upgrade to OMOF Plus.'
            : 'No promotion credits left. Upgrade to OMOF Plus in Settings.'}
        </Text>
      ) : null}
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
      gap: SPACING.md,
    },
    heading: {
      fontSize: FONT_SIZES.xl,
      fontWeight: '700',
      color: colors.text,
    },
    description: {
      fontSize: FONT_SIZES.sm,
      color: colors.textMuted,
      lineHeight: 20,
    },
    sectionTitle: {
      fontSize: FONT_SIZES.sm,
      fontWeight: '700',
      color: colors.text,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    options: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: SPACING.sm,
    },
    option: {
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
      borderRadius: BORDER_RADIUS.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    optionSelected: {
      borderColor: colors.selectedBorder,
      backgroundColor: colors.selectedBackground,
      borderWidth: 2,
    },
    optionText: {
      fontSize: FONT_SIZES.sm,
      color: colors.textMuted,
      fontWeight: '600',
    },
    optionTextSelected: {
      color: colors.selected,
      fontWeight: '700',
    },
    creditsNote: {
      fontSize: FONT_SIZES.sm,
      color: colors.textMuted,
    },
    submit: {
      marginTop: SPACING.sm,
    },
    activeTitle: {
      fontSize: FONT_SIZES.lg,
      fontWeight: '700',
      color: colors.text,
      marginBottom: SPACING.sm,
    },
    activeMessage: {
      fontSize: FONT_SIZES.sm,
      color: colors.textMuted,
      marginBottom: SPACING.lg,
    },
  });
}
