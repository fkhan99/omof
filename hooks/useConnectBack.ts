import { useState } from 'react';
import { Alert } from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { followUser } from '@/services/firebase/follows';
import {
  adjustFollowCountsOptimistically,
  invalidateFollowQueries,
  invalidateFollowSideEffects,
  setFollowRelationshipCache,
} from '@/utils/followCache';

interface ConnectBackOptions {
  targetIsPrivate?: boolean;
}

export function useConnectBack(authUid: string | undefined) {
  const queryClient = useQueryClient();
  const [activeTargetId, setActiveTargetId] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (targetUserId: string) => followUser(authUid!, targetUserId),
    onMutate: (targetUserId, context) => {
      setActiveTargetId(targetUserId);
      const isPrivate = (context as { meta?: ConnectBackOptions } | undefined)?.meta?.targetIsPrivate;
      const nextState = isPrivate
        ? { following: false, requested: true }
        : { following: true, requested: false };
      setFollowRelationshipCache(queryClient, authUid!, targetUserId, nextState);
      if (!isPrivate) {
        adjustFollowCountsOptimistically(queryClient, authUid!, targetUserId, {
          followingDelta: 1,
          followerDelta: 1,
        });
      }
    },
    onSuccess: (result, targetUserId) => {
      setFollowRelationshipCache(queryClient, authUid!, targetUserId, {
        following: result === 'followed',
        requested: result === 'requested',
      });
      if (result === 'requested') {
        adjustFollowCountsOptimistically(queryClient, authUid!, targetUserId, {
          followingDelta: 0,
          followerDelta: 0,
        });
      }
      invalidateFollowSideEffects(queryClient, authUid, targetUserId);
      queryClient.invalidateQueries({ queryKey: ['followingIds', authUid] });
      queryClient.invalidateQueries({ queryKey: ['isFollowing', authUid, targetUserId] });
    },
    onError: (err, targetUserId) => {
      invalidateFollowQueries(queryClient, authUid, targetUserId);
      Alert.alert(
        'Could not connect',
        err instanceof Error ? err.message : 'Please try again.',
      );
    },
    onSettled: () => {
      setActiveTargetId(null);
    },
  });

  const connectBack = (targetUserId: string, options?: ConnectBackOptions) => {
    if (!authUid) return;
    mutation.mutate(targetUserId, { meta: options });
  };

  return {
    connectBack,
    connectBackTargetId: activeTargetId,
    isConnectBackPending: mutation.isPending,
  };
}
