import { useState } from 'react';
import { Alert } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { followUser, unfollowUser, getFollowingIds } from '@/services/firebase/follows';
import { getOutgoingFollowRequestIds } from '@/services/firebase/followRequests';
import {
  invalidateFollowQueries,
  invalidateFollowSideEffects,
  setFollowRelationshipCache,
  adjustFollowCountsOptimistically,
} from '@/utils/followCache';
import { User } from '@/types';

export function useDiscoverFollowActions(authUid: string | undefined) {
  const queryClient = useQueryClient();
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
    onSuccess: (_data, targetUser) => {
      invalidateFollowSideEffects(queryClient, authUid, targetUser.id);
    },
    onError: (err) => {
      invalidateFollowQueries(queryClient, authUid);
      Alert.alert(
        'Could not connect',
        err instanceof Error ? err.message : 'Please try again.',
      );
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
        'Could not disconnect',
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

  return {
    followingIds,
    requestedIds,
    userToUnfollow,
    setUserToUnfollow,
    handleFollowPress,
    unfollowMutation,
  };
}
