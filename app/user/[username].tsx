import { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { getUserByUsername } from '@/services/firebase/users';
import { getPostsByAuthor } from '@/services/firebase/posts';
import { isFollowing, followUser, unfollowUser, getActualFollowCounts } from '@/services/firebase/follows';
import { getOutgoingFollowRequestIds } from '@/services/firebase/followRequests';
import {
  invalidateFollowQueries,
  invalidateFollowSideEffects,
  setFollowRelationshipCache,
  adjustFollowCountsOptimistically,
} from '@/utils/followCache';
import { blockUser, isUserBlocked } from '@/services/firebase/safety';
import { useAuthStore } from '@/store/authStore';
import { Avatar } from '@/components/ui/Avatar';
import { PlusBadge } from '@/components/users/PlusBadge';
import { Button } from '@/components/ui/Button';
import { PostGrid } from '@/components/posts/PostGrid';
import { LoadingState } from '@/components/ui/LoadingState';
import { ErrorState } from '@/components/ui/ErrorState';
import { EmptyState } from '@/components/ui/EmptyState';
import { OptionsMenu } from '@/components/ui/OptionsMenu';
import { FONT_SIZES, SPACING, ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/hooks/useTheme';
import { canViewUserPosts } from '@/utils/users';
import { useProfileFollowCounts } from '@/hooks/useProfileFollowCounts';

export default function UserProfileScreen() {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const { username } = useLocalSearchParams<{ username: string }>();
  const router = useRouter();
  const { profile, firebaseUser } = useAuthStore();
  const queryClient = useQueryClient();
  const [showFollowMenu, setShowFollowMenu] = useState(false);
  const authUid = firebaseUser?.uid;

  const { data: user, isLoading, error, refetch } = useQuery({
    queryKey: ['user', username],
    queryFn: () => getUserByUsername(username!),
    enabled: !!username,
  });

  const isOwnProfile = profile?.id === user?.id;

  const { data: following = false } = useQuery({
    queryKey: ['isFollowing', authUid, user?.id],
    queryFn: () => isFollowing(authUid!, user!.id),
    enabled: !!authUid && !!user && !isOwnProfile,
    staleTime: 0,
  });

  const { data: outgoingRequestIds = [] } = useQuery({
    queryKey: ['followRequestedIds', authUid],
    queryFn: () => getOutgoingFollowRequestIds(authUid!),
    enabled: !!authUid && !isOwnProfile,
    staleTime: 0,
  });

  const isRequestPending = !!user?.id && outgoingRequestIds.includes(user.id);

  const { data: viewedUserCounts } = useQuery({
    queryKey: ['followCounts', user?.id],
    queryFn: () => getActualFollowCounts(user!.id),
    enabled: !!user?.id,
    staleTime: Infinity,
  });

  useProfileFollowCounts(
    user?.id,
    user
      ? { followerCount: user.followerCount, followingCount: user.followingCount }
      : undefined,
  );

  const { data: blocked = false } = useQuery({
    queryKey: ['isBlocked', authUid, user?.id],
    queryFn: () => isUserBlocked(authUid!, user!.id),
    enabled: !!authUid && !!user && !isOwnProfile,
  });

  const canViewPosts = user
    ? canViewUserPosts(user, authUid, following)
    : false;

  const {
    data: postsData,
    isLoading: postsLoading,
    isError: postsError,
    error: postsQueryError,
    refetch: refetchPosts,
  } = useQuery({
    queryKey: ['authorPosts', user?.id],
    queryFn: async () => getPostsByAuthor(user!.id),
    enabled: !!user?.id && canViewPosts,
    staleTime: 0,
  });

  const authorPosts = useMemo(() => {
    if (!user?.id || !postsData?.items) return [];
    return postsData.items.filter((post) => post.authorId === user.id);
  }, [user?.id, postsData?.items]);

  const followMutation = useMutation({
    mutationFn: () => followUser(authUid!, user!.id),
    onMutate: () => {
      const nextState = user!.isPrivate
        ? { following: false, requested: true }
        : { following: true, requested: false };
      setFollowRelationshipCache(queryClient, authUid!, user!.id, nextState);
      if (!user!.isPrivate) {
        adjustFollowCountsOptimistically(queryClient, authUid!, user!.id, {
          followingDelta: 1,
          followerDelta: 1,
        });
      }
    },
    onSuccess: (result) => {
      setFollowRelationshipCache(queryClient, authUid!, user!.id, {
        following: result === 'followed',
        requested: result === 'requested',
      });
      invalidateFollowSideEffects(queryClient, authUid, user?.id);
    },
    onError: (err) => {
      invalidateFollowQueries(queryClient, authUid, user?.id);
      Alert.alert(
        'Could not update follow',
        err instanceof Error ? err.message : 'Please try again.',
      );
    },
  });

  const unfollowMutation = useMutation({
    mutationFn: () => unfollowUser(authUid!, user!.id),
    onMutate: () => {
      setShowFollowMenu(false);
      const wasFollowing = following;
      setFollowRelationshipCache(queryClient, authUid!, user!.id, {
        following: false,
        requested: false,
      });
      if (wasFollowing) {
        adjustFollowCountsOptimistically(queryClient, authUid!, user!.id, {
          followingDelta: -1,
          followerDelta: -1,
        });
      }
    },
    onSuccess: () => {
      invalidateFollowSideEffects(queryClient, authUid, user?.id);
    },
    onError: (err) => {
      invalidateFollowQueries(queryClient, authUid, user?.id);
      Alert.alert(
        'Could not unfollow',
        err instanceof Error ? err.message : 'Please try again.',
      );
    },
  });

  const blockMutation = useMutation({
    mutationFn: () =>
      blockUser(authUid!, {
        id: user!.id,
        username: user!.username,
        displayName: user!.displayName,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['isBlocked'] });
      Alert.alert('User blocked', 'You will no longer see their content.');
      router.back();
    },
  });

  const handleBlock = () => {
    Alert.alert('Block user', `Block @${user?.username}? You won't see their posts or comments.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Block', style: 'destructive', onPress: () => blockMutation.mutate() },
    ]);
  };

  const getFollowButtonTitle = () => {
    if (following) return 'Following';
    if (isRequestPending) return 'Requested';
    return user?.isPrivate ? 'Request' : 'Follow';
  };

  const handleFollowPress = () => {
    if (following) {
      setShowFollowMenu(true);
      return;
    }
    if (isRequestPending) {
      unfollowMutation.mutate();
      return;
    }
    followMutation.mutate();
  };

  if (isLoading) return <LoadingState />;
  if (error || !user) return <ErrorState message="User not found." onRetry={() => refetch()} />;

  const renderListHeader = () => (
    <>
      <View style={styles.header}>
        <View style={styles.profileRow}>
          <Avatar uri={user.photoURL} name={user.displayName} size={88} showRing />
          <View style={styles.stats}>
            <View style={styles.stat}>
              <Text style={styles.statNumber}>
                {canViewPosts ? authorPosts.length : '—'}
              </Text>
              <Text style={styles.statLabel}>posts</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statNumber}>{viewedUserCounts?.followerCount ?? user.followerCount}</Text>
              <Text style={styles.statLabel}>followers</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statNumber}>{viewedUserCounts?.followingCount ?? user.followingCount}</Text>
              <Text style={styles.statLabel}>following</Text>
            </View>
          </View>
        </View>

        <View style={styles.nameRow}>
          <Text style={styles.displayName}>{user.displayName}</Text>
          {user.plan === 'plus' ? <PlusBadge compact /> : null}
          {user.isPrivate ? (
            <Ionicons name="lock-closed" size={16} color={colors.textMuted} />
          ) : null}
        </View>
        <Text style={styles.username}>@{user.username}</Text>
        {user.bio ? <Text style={styles.bio}>{user.bio}</Text> : null}

        {!isOwnProfile && !blocked && (
          <View style={styles.actions}>
            <Button
              title={getFollowButtonTitle()}
              variant={following || isRequestPending ? 'secondary' : 'primary'}
              size="sm"
              onPress={handleFollowPress}
              style={styles.actionButton}
            />
            <Button title="Block" variant="ghost" size="sm" onPress={handleBlock} />
          </View>
        )}
      </View>

      {!canViewPosts ? (
        <View style={styles.privateNotice}>
          <Ionicons name="lock-closed-outline" size={40} color={colors.textMuted} />
          <Text style={styles.privateTitle}>This account is private</Text>
          <Text style={styles.privateMessage}>
            Follow this account to see their posts.
          </Text>
        </View>
      ) : (
        <View style={styles.postsHeader}>
          <Ionicons name="grid-outline" size={22} color={colors.text} />
          <Text style={styles.postsTitle}>Posts</Text>
        </View>
      )}

      {canViewPosts && postsLoading ? <LoadingState message="Loading posts..." /> : null}
      {canViewPosts && postsError ? (
        <ErrorState
          message={
            postsQueryError instanceof Error ? postsQueryError.message : 'Failed to load posts.'
          }
          onRetry={() => refetchPosts()}
        />
      ) : null}
    </>
  );

  const renderListEmpty = () => {
    if (!canViewPosts || postsLoading || postsError) return null;

    return (
      <EmptyState title="No posts yet" message="This user hasn't shared anything yet." />
    );
  };

  return (
    <>
      <PostGrid
        posts={canViewPosts && !postsLoading && !postsError ? authorPosts : []}
        ListHeaderComponent={renderListHeader}
        ListEmptyComponent={renderListEmpty}
        extraData={`${user.id}-${following}-${isRequestPending}-${viewedUserCounts?.followerCount}`}
      />

      <OptionsMenu
        visible={showFollowMenu}
        title={`@${user.username}`}
        onClose={() => setShowFollowMenu(false)}
        options={[
          {
            label: `Unfollow ${user.username}`,
            destructive: true,
            onPress: () => unfollowMutation.mutate(),
          },
        ]}
      />
    </>
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
    nameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.xs,
    },
    displayName: {
      fontSize: FONT_SIZES.md,
      fontWeight: '700',
      color: colors.text,
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
    actions: {
      marginTop: SPACING.md,
      flexDirection: 'row',
      gap: SPACING.sm,
    },
    actionButton: {
      flex: 1,
    },
    privateNotice: {
      alignItems: 'center',
      padding: SPACING.xxl,
      gap: SPACING.sm,
      backgroundColor: colors.surface,
    },
    privateTitle: {
      fontSize: FONT_SIZES.md,
      fontWeight: '700',
      color: colors.text,
    },
    privateMessage: {
      fontSize: FONT_SIZES.sm,
      color: colors.textMuted,
      textAlign: 'center',
      lineHeight: 20,
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
  });
}
