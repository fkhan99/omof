import { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';
import { getMyPosts } from '@/services/firebase/posts';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { PostGrid } from '@/components/posts/PostGrid';
import { LoadingState } from '@/components/ui/LoadingState';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { FONT_SIZES, SPACING, ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/hooks/useTheme';
import { Ionicons } from '@expo/vector-icons';
import { GamificationStats } from '@/components/profile/GamificationStats';
import { useProfileFollowCounts } from '@/hooks/useProfileFollowCounts';
import { CONNECTIONS, POSTS, PROFILE } from '@/constants/copy';
import { Post } from '@/types';

export default function ProfileScreen() {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const router = useRouter();
  const profile = useAuthStore((s) => s.profile);
  const firebaseUser = useAuthStore((s) => s.firebaseUser);

  const authUid = firebaseUser?.uid;

  useProfileFollowCounts(authUid, {
    followerCount: profile?.followerCount ?? 0,
    followingCount: profile?.followingCount ?? 0,
  });

  const {
    data: postsData,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['myPosts', authUid],
    queryFn: async () => {
      if (__DEV__) console.log('[Profile] queryFn — auth uid:', authUid);
      return getMyPosts(authUid!);
    },
    enabled: !!authUid,
    staleTime: 0,
  });

  const myPosts: Post[] = useMemo(() => {
    if (!authUid || !postsData?.items) return [];
    return postsData.items.filter((post) => post.authorId === authUid);
  }, [authUid, postsData?.items]);

  const momentPosts = useMemo(
    () => myPosts.filter((post) => post.postKind !== 'growth_update'),
    [myPosts],
  );
  const growthPosts = useMemo(
    () => myPosts.filter((post) => post.postKind === 'growth_update'),
    [myPosts],
  );

  if (!profile || !authUid) {
    return <LoadingState />;
  }

  const renderListHeader = () => (
    <>
      <View style={styles.header}>
        <View style={styles.profileRow}>
          <Avatar uri={profile.photoURL} name={profile.displayName} size={88} showRing />
          <View style={styles.stats}>
            <View style={styles.stat}>
              <Text style={styles.statNumber}>{myPosts.length}</Text>
              <Text style={styles.statLabel}>{POSTS.postsLabel}</Text>
            </View>
            <TouchableOpacity
              style={styles.stat}
              onPress={() => router.push('/profile/followers')}
              accessibilityRole="button"
              accessibilityLabel={CONNECTIONS.viewFollowersA11y}
            >
              <Text style={styles.statNumber}>{PROFILE.connectionsHidden}</Text>
              <Text style={styles.statLabel}>{CONNECTIONS.followers}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.stat}
              onPress={() => router.push('/profile/following')}
              accessibilityRole="button"
              accessibilityLabel={CONNECTIONS.viewFollowingA11y}
            >
              <Text style={styles.statNumber}>{PROFILE.connectionsHidden}</Text>
              <Text style={styles.statLabel}>{CONNECTIONS.following}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.nameRow}>
          <Text style={styles.displayName}>{profile.displayName}</Text>
        </View>
        <Text style={styles.username}>@{profile.username}</Text>
        {profile.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}

        <GamificationStats user={profile} />

        <Button
          title="Edit Profile"
          variant="secondary"
          size="sm"
          onPress={() => router.push('/profile/edit')}
          style={styles.editButton}
        />
      </View>

      <View style={styles.postsHeader}>
        <Ionicons name="grid-outline" size={22} color={colors.text} />
        <Text style={styles.postsTitle}>{POSTS.postsSection}</Text>
        {growthPosts.length > 0 ? (
          <Text style={styles.postsMeta}>
            {momentPosts.length} moments · {growthPosts.length} growth
          </Text>
        ) : null}
      </View>

      {isLoading ? <LoadingState message="Loading posts..." /> : null}
      {isError ? (
        <ErrorState
          message={error instanceof Error ? error.message : 'Failed to load your posts.'}
          onRetry={() => refetch()}
        />
      ) : null}
    </>
  );

  const renderListEmpty = () => {
    if (isLoading || isError) return null;

    return (
      <EmptyState
        title={POSTS.noPosts}
        message="Share your first authentic moment."
        actionLabel="Share a moment"
        onAction={() => router.push('/(tabs)/create')}
      />
    );
  };

  const renderListFooter = () => null;

  return (
    <PostGrid
      posts={isLoading || isError ? [] : myPosts}
      ListHeaderComponent={renderListHeader}
      ListEmptyComponent={renderListEmpty}
      ListFooterComponent={renderListFooter}
      extraData={`${authUid}-${displayedFollowerCount}-${displayedFollowingCount}-${profile.stats.points}`}
    />
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      padding: SPACING.lg,
      paddingTop: SPACING.md,
      backgroundColor: colors.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    profileRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.lg,
      marginBottom: SPACING.md,
    },
    displayName: {
      fontSize: FONT_SIZES.md,
      fontWeight: '700',
      color: colors.text,
    },
    nameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
    },
    username: {
      fontSize: FONT_SIZES.sm,
      color: colors.textMuted,
      marginTop: 2,
    },
    bio: {
      fontSize: FONT_SIZES.sm,
      color: colors.text,
      marginTop: SPACING.sm,
      lineHeight: 20,
    },
    stats: {
      flex: 1,
      flexDirection: 'row',
      justifyContent: 'space-around',
    },
    stat: {
      alignItems: 'center',
    },
    statNumber: {
      fontSize: FONT_SIZES.lg,
      fontWeight: '700',
      color: colors.text,
    },
    statLabel: {
      fontSize: FONT_SIZES.xs,
      color: colors.textMuted,
      marginTop: 2,
    },
    editButton: {
      marginTop: SPACING.md,
      alignSelf: 'flex-start',
      minWidth: 140,
    },
    postsHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: SPACING.sm,
      paddingVertical: SPACING.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
      backgroundColor: colors.surface,
    },
    postsTitle: {
      fontSize: FONT_SIZES.sm,
      fontWeight: '700',
      color: colors.text,
      letterSpacing: 0.5,
      textTransform: 'uppercase',
    },
    postsMeta: {
      fontSize: FONT_SIZES.xs,
      color: colors.textMuted,
      marginLeft: SPACING.sm,
    },
  });
}
