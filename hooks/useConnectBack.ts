import { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
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

  const connectBack = useCallback(
    async (targetUserId: string, options?: ConnectBackOptions) => {
      if (!authUid) return;

      setActiveTargetId(targetUserId);
      const isPrivate = options?.targetIsPrivate;
      const optimisticState = isPrivate
        ? { following: false, requested: true }
        : { following: true, requested: false };

      setFollowRelationshipCache(queryClient, authUid, targetUserId, optimisticState);
      if (!isPrivate) {
        adjustFollowCountsOptimistically(queryClient, authUid, targetUserId, {
          followingDelta: 1,
          followerDelta: 1,
        });
      }

      try {
        const result = await followUser(authUid, targetUserId);
        setFollowRelationshipCache(queryClient, authUid, targetUserId, {
          following: result === 'followed',
          requested: result === 'requested',
        });
        if (result === 'requested' && !isPrivate) {
          adjustFollowCountsOptimistically(queryClient, authUid, targetUserId, {
            followingDelta: -1,
            followerDelta: -1,
          });
        }
        invalidateFollowSideEffects(queryClient, authUid, targetUserId);
        await queryClient.invalidateQueries({ queryKey: ['followingIds', authUid] });
        await queryClient.invalidateQueries({ queryKey: ['isFollowing', authUid, targetUserId] });
        await queryClient.invalidateQueries({ queryKey: ['followsMe', targetUserId, authUid] });
      } catch (err) {
        invalidateFollowQueries(queryClient, authUid, targetUserId);
        Alert.alert(
          'Could not connect',
          err instanceof Error ? err.message : 'Please try again.',
        );
      } finally {
        setActiveTargetId(null);
      }
    },
    [authUid, queryClient],
  );

  return {
    connectBack,
    connectBackTargetId: activeTargetId,
    isConnectBackPending: activeTargetId !== null,
  };
}
