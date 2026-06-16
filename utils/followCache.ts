import { QueryClient } from '@tanstack/react-query';
import { FollowCounts } from '@/services/firebase/follows';

export function setFollowRelationshipCache(
  queryClient: QueryClient,
  authUid: string,
  targetUserId: string,
  state: { following: boolean; requested: boolean },
): void {
  queryClient.setQueryData(['isFollowing', authUid, targetUserId], state.following);
  queryClient.setQueryData(['followRequested', authUid, targetUserId], state.requested);

  queryClient.setQueryData<string[]>(['followingIds', authUid], (old = []) => {
    const has = old.includes(targetUserId);
    if (state.following && !has) return [...old, targetUserId];
    if (!state.following && has) return old.filter((id) => id !== targetUserId);
    return old;
  });

  queryClient.setQueryData<string[]>(['followRequestedIds', authUid], (old = []) => {
    const has = old.includes(targetUserId);
    if (state.requested && !has) return [...old, targetUserId];
    if (!state.requested && has) return old.filter((id) => id !== targetUserId);
    return old;
  });
}

export function syncOutgoingFollowState(
  queryClient: QueryClient,
  authUid: string,
  followingIds: string[],
  requestedIds: string[],
): void {
  const followingSet = new Set(followingIds);
  const requestedSet = new Set(
    requestedIds.filter((id) => !followingSet.has(id)),
  );

  queryClient.setQueryData(['followingIds', authUid], [...followingSet]);
  queryClient.setQueryData(['followRequestedIds', authUid], [...requestedSet]);

  const affectedIds = new Set([...followingSet, ...requestedSet]);

  affectedIds.forEach((targetId) => {
    const following = followingSet.has(targetId);
    const requested = requestedSet.has(targetId);
    queryClient.setQueryData(['isFollowing', authUid, targetId], following);
    queryClient.setQueryData(['followRequested', authUid, targetId], requested);
  });
}

export function adjustFollowCountsOptimistically(
  queryClient: QueryClient,
  followerId: string,
  followingId: string,
  delta: { followingDelta?: number; followerDelta?: number },
): void {
  if (delta.followingDelta) {
    queryClient.setQueryData<FollowCounts>(['followCounts', followerId], (old) => ({
      followingCount: Math.max(0, (old?.followingCount ?? 0) + delta.followingDelta!),
      followerCount: old?.followerCount ?? 0,
    }));
  }

  if (delta.followerDelta) {
    queryClient.setQueryData<FollowCounts>(['followCounts', followingId], (old) => ({
      followingCount: old?.followingCount ?? 0,
      followerCount: Math.max(0, (old?.followerCount ?? 0) + delta.followerDelta!),
    }));
  }
}

export function patchFollowCountsCache(
  queryClient: QueryClient,
  userId: string,
  patch: Partial<FollowCounts>,
): void {
  queryClient.setQueryData<FollowCounts>(['followCounts', userId], (old) => ({
    followingCount: patch.followingCount ?? old?.followingCount ?? 0,
    followerCount: patch.followerCount ?? old?.followerCount ?? 0,
  }));
}

export function invalidateFollowSideEffects(
  queryClient: QueryClient,
  authUid?: string,
  targetUserId?: string,
): void {
  queryClient.invalidateQueries({ queryKey: ['followingUsers'] });
  queryClient.invalidateQueries({ queryKey: ['feed'] });

  if (authUid) {
    queryClient.invalidateQueries({ queryKey: ['followRequestedIds', authUid] });
  }

  if (targetUserId) {
    queryClient.invalidateQueries({ queryKey: ['user'] });
  }
}

export function invalidateFollowQueries(
  queryClient: QueryClient,
  authUid?: string,
  targetUserId?: string,
): void {
  queryClient.invalidateQueries({ queryKey: ['isFollowing'] });
  queryClient.invalidateQueries({ queryKey: ['followRequested'] });
  queryClient.invalidateQueries({ queryKey: ['followingIds'] });
  queryClient.invalidateQueries({ queryKey: ['followRequestedIds'] });
  queryClient.invalidateQueries({ queryKey: ['followingUsers'] });
  queryClient.invalidateQueries({ queryKey: ['feed'] });

  if (authUid) {
    queryClient.invalidateQueries({ queryKey: ['followCounts', authUid] });
  }

  if (targetUserId) {
    queryClient.invalidateQueries({ queryKey: ['followCounts', targetUserId] });
    queryClient.invalidateQueries({ queryKey: ['user'] });
  }
}
