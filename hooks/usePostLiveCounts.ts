import { useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { useQueryClient } from '@tanstack/react-query';
import { getFirebaseDb, isFirebaseConfigured } from '@/services/firebase/config';
import { mapPostDoc } from '@/services/firebase/mappers';
import { patchPostInCaches } from '@/lib/postQueryCache';

/** Sync post reaction/comment counts from Firestore in real time. */
export function usePostLiveCounts(postId: string | undefined): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!postId || !isFirebaseConfigured()) return;

    const db = getFirebaseDb();
    return onSnapshot(doc(db, 'posts', postId), (snap) => {
      if (!snap.exists()) return;
      const live = mapPostDoc(snap.id, snap.data()!);
      patchPostInCaches(queryClient, postId, (post) => ({
        ...post,
        reactionCounts: live.reactionCounts,
        commentCount: live.commentCount,
      }));
    });
  }, [postId, queryClient]);
}
