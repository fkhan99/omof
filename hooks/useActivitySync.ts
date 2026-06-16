import { useEffect, useRef } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { useQueryClient } from '@tanstack/react-query';
import { getFirebaseDb, isFirebaseConfigured } from '@/services/firebase/config';
import { mapFollowRequestDoc } from '@/services/firebase/mappers';
import { enrichFollowRequests } from '@/services/firebase/followRequests';
import { loadActivityFeed } from '@/services/firebase/notifications';
import { loadReadActivityKeys } from '@/services/firebase/activityReadState';
import { applyPersistedReadState } from '@/utils/activityRead';
import { computeActivityBadgeCount } from '@/utils/activityBadge';
import { useAuthStore } from '@/store/authStore';
import { useNotificationStore } from '@/store/notificationStore';
import { Notification } from '@/types';
import { FollowRequestWithRequester } from '@/services/firebase/followRequests';

const POLL_INTERVAL_MS = 8_000;

function setBadgeCount(count: number): void {
  if (useNotificationStore.getState().unreadCount !== count) {
    useNotificationStore.getState().setUnreadCount(count);
  }
}

/** Real-time sync for activity badge, notifications list, and follow requests. */
export function useActivitySync() {
  const { firebaseUser } = useAuthStore();
  const queryClient = useQueryClient();
  const authUid = firebaseUser?.uid;
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const refreshInFlight = useRef(false);

  useEffect(() => {
    if (!authUid || !isFirebaseConfigured()) {
      setBadgeCount(0);
      return;
    }

    const db = getFirebaseDb();
    let pendingFollowRequestCount = 0;

    const syncActivity = (items: Notification[]) => {
      queryClient.setQueryData(['activity', authUid], items);
      setBadgeCount(computeActivityBadgeCount(items, pendingFollowRequestCount));
    };

    const refreshActivity = async () => {
      if (refreshInFlight.current) return;
      refreshInFlight.current = true;

      try {
        const [items, readKeys] = await Promise.all([
          loadActivityFeed(authUid),
          loadReadActivityKeys(authUid),
        ]);
        syncActivity(applyPersistedReadState(items, readKeys));
      } catch (error) {
        console.warn('[ActivitySync] refresh failed', error);
      } finally {
        refreshInFlight.current = false;
      }
    };

    void refreshActivity();

    const unsubNotifications = onSnapshot(
      query(collection(db, 'notifications'), where('recipientId', '==', authUid)),
      () => {
        void refreshActivity();
      },
      (error) => {
        console.warn('[ActivitySync] notifications listener failed', error);
        void refreshActivity();
      },
    );

    const unsubRequests = onSnapshot(
      query(collection(db, 'followRequests'), where('targetId', '==', authUid)),
      async (snap) => {
        pendingFollowRequestCount = snap.size;
        const requests = snap.docs
          .map((docSnap) => mapFollowRequestDoc(docSnap.id, docSnap.data()))
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        const enriched = await enrichFollowRequests(requests);
        queryClient.setQueryData<FollowRequestWithRequester[]>(
          ['followRequests', authUid],
          enriched,
        );

        const current = queryClient.getQueryData<Notification[]>(['activity', authUid]) ?? [];
        setBadgeCount(computeActivityBadgeCount(current, pendingFollowRequestCount));
      },
      (error) => {
        console.warn('[ActivitySync] followRequests listener failed', error);
      },
    );

    const unsubPosts = onSnapshot(
      query(collection(db, 'posts'), where('authorId', '==', authUid)),
      () => {
        void refreshActivity();
      },
      (error) => {
        console.warn('[ActivitySync] posts listener failed', error);
      },
    );

    pollRef.current = setInterval(() => {
      void refreshActivity();
    }, POLL_INTERVAL_MS);

    return () => {
      unsubNotifications();
      unsubRequests();
      unsubPosts();
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [authUid, queryClient]);
}

/** @deprecated Use useActivitySync */
export const useActivityBadge = useActivitySync;
