import { useState } from 'react';
import { View, FlatList, StyleSheet, Alert } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';
import { getFollowingUsers, unfollowUser } from '@/services/firebase/follows';
import {
  invalidateFollowQueries,
  setFollowRelationshipCache,
  adjustFollowCountsOptimistically,
} from '@/utils/followCache';
import { UserListItem } from '@/components/users/UserListItem';
import { OptionsMenu } from '@/components/ui/OptionsMenu';
import { LoadingState } from '@/components/ui/LoadingState';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { User } from '@/types';
import { SPACING, ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';

export default function FollowingScreen() {
  const styles = useThemedStyles(createStyles);
  const { profile, firebaseUser } = useAuthStore();
  const queryClient = useQueryClient();
  const authUid = firebaseUser?.uid;
  const [userToUnfollow, setUserToUnfollow] = useState<User | null>(null);

  const {
    data: followingUsers = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['followingUsers', authUid],
    queryFn: () => getFollowingUsers(authUid!),
    enabled: !!authUid,
    staleTime: 0,
  });

  const unfollowMutation = useMutation({
    mutationFn: (targetUserId: string) => unfollowUser(authUid!, targetUserId),
    onMutate: (targetUserId) => {
      setUserToUnfollow(null);
      setFollowRelationshipCache(queryClient, authUid!, targetUserId, {
        following: false,
        requested: false,
      });
      adjustFollowCountsOptimistically(queryClient, authUid!, targetUserId, {
        followingDelta: -1,
        followerDelta: -1,
      });
      queryClient.setQueryData<User[]>(['followingUsers', authUid], (old) =>
        old?.filter((user) => user.id !== targetUserId) ?? [],
      );
    },
    onSuccess: (_data, targetUserId) => {
      invalidateFollowQueries(queryClient, authUid, targetUserId);
    },
    onError: (err) => {
      invalidateFollowQueries(queryClient, authUid);
      Alert.alert(
        'Could not unfollow',
        err instanceof Error ? err.message : 'Please try again.',
      );
    },
  });

  if (!profile || !authUid) return <LoadingState />;

  if (isLoading) return <LoadingState message="Loading following..." />;

  if (isError) {
    return (
      <ErrorState
        message={error instanceof Error ? error.message : 'Could not load following list.'}
        onRetry={() => refetch()}
      />
    );
  }

  if (followingUsers.length === 0) {
    return (
      <EmptyState
        icon="people-outline"
        title="Not following anyone yet"
        message="When you follow people, they'll show up here so you can manage who you follow."
      />
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={followingUsers}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <UserListItem
            user={item}
            showFollowButton
            isFollowing
            onUnfollow={() => setUserToUnfollow(item)}
          />
        )}
        contentContainerStyle={styles.list}
      />

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
    list: {
      paddingBottom: SPACING.lg,
    },
  });
}
