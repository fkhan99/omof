import { useState } from 'react';
import { View, FlatList, StyleSheet, Alert, Text } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { searchUsers } from '@/services/firebase/users';
import { getPromotedPosts } from '@/services/firebase/promotions';
import { useAuthStore } from '@/store/authStore';
import { getBlockedUserIds } from '@/services/firebase/safety';
import {
  getFollowingIds,
  followUser,
  unfollowUser,
} from '@/services/firebase/follows';
import { getOutgoingFollowRequestIds } from '@/services/firebase/followRequests';
import {
  invalidateFollowQueries,
  invalidateFollowSideEffects,
  setFollowRelationshipCache,
  adjustFollowCountsOptimistically,
} from '@/utils/followCache';
import { Input } from '@/components/ui/Input';
import { UserListItem } from '@/components/users/UserListItem';
import { PostCard } from '@/components/posts/PostCard';
import { OptionsMenu } from '@/components/ui/OptionsMenu';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import { SPACING, FONT_SIZES, ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { User } from '@/types';

export default function SearchScreen() {
  const styles = useThemedStyles(createStyles);
  const profile = useAuthStore((s) => s.profile);
  const firebaseUser = useAuthStore((s) => s.firebaseUser);
  const queryClient = useQueryClient();
  const authUid = firebaseUser?.uid;
  const [searchTerm, setSearchTerm] = useState('');
  const [userToUnfollow, setUserToUnfollow] = useState<User | null>(null);

  const { data: followingIds = [] } = useQuery({
    queryKey: ['followingIds', authUid],
    queryFn: () => getFollowingIds(authUid!),
    enabled: !!authUid,
    staleTime: 0,
  });

  const { data: requestedIds = [] } = useQuery({
    queryKey: ['followRequestedIds', authUid],
    queryFn: () => getOutgoingFollowRequestIds(authUid!),
    enabled: !!authUid,
    staleTime: 0,
  });

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['search', searchTerm],
    queryFn: async () => {
      if (!searchTerm.trim() || searchTerm.length < 2) return [];
      const results = await searchUsers(searchTerm);
      if (!profile) return results;
      const blockedIds = await getBlockedUserIds(profile.id);
      return results.filter((u) => !blockedIds.includes(u.id) && u.id !== profile.id);
    },
    enabled: searchTerm.length >= 2,
  });

  const { data: explorePosts = [], isLoading: exploreLoading } = useQuery({
    queryKey: ['explore', authUid],
    queryFn: async () => {
      if (!profile) return [];
      const blockedIds = await getBlockedUserIds(profile.id);
      return getPromotedPosts([profile.id], blockedIds);
    },
    enabled: !!authUid && searchTerm.length < 2,
  });

  const followMutation = useMutation({
    mutationFn: async (targetUser: User) => followUser(authUid!, targetUser.id),
    onMutate: (targetUser) => {
      const nextState = targetUser.isPrivate
        ? { following: false, requested: true }
        : { following: true, requested: false };
      setFollowRelationshipCache(queryClient, authUid!, targetUser.id, nextState);
      if (!targetUser.isPrivate) {
        adjustFollowCountsOptimistically(queryClient, authUid!, targetUser.id, {
          followingDelta: 1,
          followerDelta: 1,
        });
      }
    },
    onSuccess: (result, targetUser) => {
      setFollowRelationshipCache(queryClient, authUid!, targetUser.id, {
        following: result === 'followed',
        requested: result === 'requested',
      });
      invalidateFollowSideEffects(queryClient, authUid, targetUser.id);
    },
    onError: (_err, targetUser) => {
      invalidateFollowQueries(queryClient, authUid, targetUser.id);
    },
  });

  const unfollowMutation = useMutation({
    mutationFn: (targetUserId: string) => unfollowUser(authUid!, targetUserId),
    onMutate: (targetUserId) => {
      setUserToUnfollow(null);
      const wasFollowing = followingIds.includes(targetUserId);
      setFollowRelationshipCache(queryClient, authUid!, targetUserId, {
        following: false,
        requested: false,
      });
      if (wasFollowing) {
        adjustFollowCountsOptimistically(queryClient, authUid!, targetUserId, {
          followingDelta: -1,
          followerDelta: -1,
        });
      }
    },
    onSuccess: (_data, targetUserId) => {
      invalidateFollowSideEffects(queryClient, authUid, targetUserId);
    },
    onError: (err) => {
      invalidateFollowQueries(queryClient, authUid);
      Alert.alert(
        'Could not unfollow',
        err instanceof Error ? err.message : 'Please try again.',
      );
    },
  });

  const handleFollowPress = (user: User) => {
    if (followingIds.includes(user.id)) {
      setUserToUnfollow(user);
      return;
    }

    if (requestedIds.includes(user.id)) {
      unfollowMutation.mutate(user.id);
      return;
    }

    followMutation.mutate(user);
  };

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <Input
          placeholder="Search people"
          value={searchTerm}
          onChangeText={setSearchTerm}
          autoCapitalize="none"
          autoCorrect={false}
          leftIcon="search"
        />
      </View>

      {searchTerm.length < 2 ? (
        exploreLoading ? (
          <LoadingState message="Loading explore..." />
        ) : explorePosts.length === 0 ? (
          <EmptyState
            icon="compass-outline"
            title="Explore"
            message="Promoted posts from the community will appear here. Promote your own posts to get started."
          />
        ) : (
          <FlatList
            data={explorePosts}
            keyExtractor={(item) => item.id}
            ListHeaderComponent={
              <View style={styles.exploreHeader}>
                <Text style={styles.exploreTitle}>Explore</Text>
                <Text style={styles.exploreSubtitle}>Promoted posts from the community</Text>
              </View>
            }
            renderItem={({ item }) => <PostCard post={item} variant="card" />}
            contentContainerStyle={styles.exploreList}
            keyboardShouldPersistTaps="handled"
          />
        )
      ) : isLoading ? (
        <LoadingState message="Searching..." />
      ) : users.length === 0 ? (
        <EmptyState icon="person-outline" title="No results" message="Try a different search term." />
      ) : (
        <FlatList
          data={users}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <UserListItem
              user={item}
              showFollowButton
              isFollowing={followingIds.includes(item.id)}
              isRequested={requestedIds.includes(item.id)}
              onFollow={() => handleFollowPress(item)}
              onUnfollow={() => handleFollowPress(item)}
            />
          )}
          keyboardShouldPersistTaps="handled"
          extraData={`${followingIds.join(',')}-${requestedIds.join(',')}`}
        />
      )}

      <OptionsMenu
        visible={!!userToUnfollow}
        title={userToUnfollow ? `@${userToUnfollow.username}` : undefined}
        onClose={() => setUserToUnfollow(null)}
        options={
          userToUnfollow
            ? [
                {
                  label: `Unfollow ${userToUnfollow.username}`,
                  destructive: true,
                  onPress: () => unfollowMutation.mutate(userToUnfollow.id),
                },
              ]
            : []
        }
      />
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    searchContainer: {
      padding: SPACING.md,
      paddingBottom: SPACING.sm,
      backgroundColor: colors.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    exploreHeader: {
      paddingHorizontal: SPACING.md,
      paddingTop: SPACING.md,
      paddingBottom: SPACING.sm,
    },
    exploreTitle: {
      fontSize: FONT_SIZES.lg,
      fontWeight: '700',
      color: colors.text,
    },
    exploreSubtitle: {
      fontSize: FONT_SIZES.sm,
      color: colors.textMuted,
      marginTop: SPACING.xs,
    },
    exploreList: {
      paddingHorizontal: SPACING.md,
      paddingBottom: SPACING.lg,
    },
  });
}
