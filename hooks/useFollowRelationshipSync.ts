import { useEffect, useRef } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { useQueryClient } from '@tanstack/react-query';
import { getFirebaseDb, isFirebaseConfigured } from '@/services/firebase/config';
import { useAuthStore } from '@/store/authStore';
import { patchFollowCountsCache, syncOutgoingFollowState } from '@/utils/followCache';

function idsEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const setB = new Set(b);
  return a.every((id) => setB.has(id));
}

/** Keeps follow / requested button state and follow counts in sync via Firestore listeners. */
export function useFollowRelationshipSync() {
  const { firebaseUser, profile } = useAuthStore();
  const queryClient = useQueryClient();
  const authUid = firebaseUser?.uid;
  const followingIdsRef = useRef<string[]>([]);
  const requestedIdsRef = useRef<string[]>([]);
  const followerCountRef = useRef(0);

  useEffect(() => {
    if (!authUid || !isFirebaseConfigured()) return;

    const db = getFirebaseDb();

    const syncOwnCounts = () => {
      patchFollowCountsCache(queryClient, authUid, {
        followingCount: followingIdsRef.current.length,
        followerCount: followerCountRef.current,
      });
    };

    const applySync = () => {
      syncOutgoingFollowState(
        queryClient,
        authUid,
        followingIdsRef.current,
        requestedIdsRef.current,
      );
      syncOwnCounts();
    };

    const unsubFollowing = onSnapshot(
      query(collection(db, 'follows'), where('followerId', '==', authUid)),
      (snap) => {
        const nextIds = [
          ...new Set(snap.docs.map((docSnap) => docSnap.data().followingId as string)),
        ];
        const changed = !idsEqual(nextIds, followingIdsRef.current);
        followingIdsRef.current = nextIds;
        applySync();
        if (changed) {
          queryClient.invalidateQueries({ queryKey: ['feed'] });
          queryClient.invalidateQueries({ queryKey: ['authorPosts'] });
        }
      },
      (error) => {
        console.warn('[FollowSync] follows listener failed', error);
      },
    );

    const unsubFollowers = onSnapshot(
      query(collection(db, 'follows'), where('followingId', '==', authUid)),
      (snap) => {
        followerCountRef.current = snap.size;
        syncOwnCounts();
        queryClient.invalidateQueries({ queryKey: ['followerUsers', authUid] });
      },
      (error) => {
        console.warn('[FollowSync] followers listener failed', error);
      },
    );

    const unsubRequests = onSnapshot(
      query(collection(db, 'followRequests'), where('requesterId', '==', authUid)),
      (snap) => {
        requestedIdsRef.current = snap.docs.map(
          (docSnap) => docSnap.data().targetId as string,
        );
        applySync();
      },
      (error) => {
        console.warn('[FollowSync] followRequests listener failed', error);
      },
    );

    return () => {
      unsubFollowing();
      unsubFollowers();
      unsubRequests();
    };
  }, [authUid, queryClient]);
}
