import { useEffect, useRef } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { useQueryClient } from '@tanstack/react-query';
import { getFirebaseDb, isFirebaseConfigured } from '@/services/firebase/config';
import { mapNotificationDoc, mapFollowRequestDoc } from '@/services/firebase/mappers';
import { enrichFollowRequests } from '@/services/firebase/followRequests';
import { getUnreadCount } from '@/services/firebase/notifications';
import { loadReadActivityKeys } from '@/services/firebase/activityReadState';
import { applyPersistedReadState } from '@/utils/activityRead';
import { computeActivityBadgeCount } from '@/utils/activityBadge';
import { useAuthStore } from '@/store/authStore';
import { useNotificationStore } from '@/store/notificationStore';
import { Notification } from '@/types';
import { FollowRequestWithRequester } from '@/services/firebase/followRequests';

const POLL_INTERVAL_MS = 12_000;

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

  useEffect(() => {
    if (!authUid || !isFirebaseConfigured()) {
      setBadgeCount(0);
      return;
    }

    const db = getFirebaseDb();
    let notificationItems: Notification[] = [];
    let pendingFollowRequestCount = 0;
    let readKeys = new Set<string>();

    const updateBadge = () => {
      const itemsWithRead = applyPersistedReadState(notificationItems, readKeys);
      setBadgeCount(computeActivityBadgeCount(itemsWithRead, pendingFollowRequestCount));
    };

    const syncNotifications = (items: Notification[]) => {
      notificationItems = items;
      const itemsWithRead = applyPersistedReadState(items, readKeys);
      queryClient.setQueryData(['activity', authUid], itemsWithRead);
      updateBadge();
    };

    loadReadActivityKeys(authUid).then((keys) => {
      readKeys = keys;
      updateBadge();
    });

    const refreshFromServer = async () => {
      try {
        const count = await getUnreadCount(authUid);
        setBadgeCount(count);
      } catch (error) {
        console.warn('[ActivitySync] poll failed', error);
      }
    };

    const unsubNotifications = onSnapshot(
      query(collection(db, 'notifications'), where('recipientId', '==', authUid)),
      (snap) => {
        const items = snap.docs
          .map((docSnap) => mapNotificationDoc(docSnap.id, docSnap.data()))
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        syncNotifications(items);
      },
      (error) => {
        console.warn('[ActivitySync] notifications listener failed', error);
        refreshFromServer();
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
        updateBadge();
      },
      (error) => {
        console.warn('[ActivitySync] followRequests listener failed', error);
        refreshFromServer();
      },
    );

    refreshFromServer();
    pollRef.current = setInterval(refreshFromServer, POLL_INTERVAL_MS);

    return () => {
      unsubNotifications();
      unsubRequests();
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [authUid, queryClient]);
}

/** @deprecated Use useActivitySync */
export const useActivityBadge = useActivitySync;
