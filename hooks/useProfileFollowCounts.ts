import { useEffect } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { useQueryClient } from '@tanstack/react-query';
import { getFirebaseDb, isFirebaseConfigured } from '@/services/firebase/config';
import { patchFollowCountsCache } from '@/utils/followCache';

/** Live follower / following counts for a profile being viewed. */
export function useProfileFollowCounts(
  userId: string | undefined,
  fallback?: { followerCount: number; followingCount: number },
) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId || !isFirebaseConfigured()) return;

    if (fallback) {
      patchFollowCountsCache(queryClient, userId, fallback);
    }

    const db = getFirebaseDb();
    let followerCount = fallback?.followerCount ?? 0;
    let followingCount = fallback?.followingCount ?? 0;

    const pushCounts = () => {
      patchFollowCountsCache(queryClient, userId, { followerCount, followingCount });
    };

    const unsubFollowers = onSnapshot(
      query(collection(db, 'follows'), where('followingId', '==', userId)),
      (snap) => {
        followerCount = snap.size;
        pushCounts();
      },
    );

    const unsubFollowing = onSnapshot(
      query(collection(db, 'follows'), where('followerId', '==', userId)),
      (snap) => {
        followingCount = snap.size;
        pushCounts();
      },
    );

    return () => {
      unsubFollowers();
      unsubFollowing();
    };
  }, [userId, queryClient, fallback?.followerCount, fallback?.followingCount]);
}
