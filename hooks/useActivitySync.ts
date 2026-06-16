import { useEffect, useRef } from 'react';
import { collection, onSnapshot, query, where, DocumentChange } from 'firebase/firestore';
import { useQueryClient } from '@tanstack/react-query';
import { getFirebaseDb, isFirebaseConfigured } from '@/services/firebase/config';
import { mapFollowRequestDoc, mapNotificationDoc } from '@/services/firebase/mappers';
import { enrichFollowRequests } from '@/services/firebase/followRequests';
import { loadActivityFeed } from '@/services/firebase/notifications';
import { loadReadActivityKeys } from '@/services/firebase/activityReadState';
import {
  reactionDocToNotification,
  upsertActivityNotification,
} from '@/services/firebase/activityFeed';
import { applyPersistedReadState } from '@/utils/activityRead';
import { computeActivityBadgeCount } from '@/utils/activityBadge';
import { useAuthStore } from '@/store/authStore';
import { useNotificationStore } from '@/store/notificationStore';
import { Notification } from '@/types';
import { FollowRequestWithRequester } from '@/services/firebase/followRequests';

const POLL_INTERVAL_MS = 30_000;
const REFRESH_DEBOUNCE_MS = 400;

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
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const readKeysRef = useRef(new Set<string>());
  const pendingFollowRequestCountRef = useRef(0);

  useEffect(() => {
    if (!authUid || !isFirebaseConfigured()) {
      setBadgeCount(0);
      return;
    }

    const db = getFirebaseDb();

    const syncActivity = (items: Notification[]) => {
      queryClient.setQueryData(['activity', authUid], items);
      setBadgeCount(
        computeActivityBadgeCount(items, pendingFollowRequestCountRef.current),
      );
    };

    const upsertActivity = (incoming: Notification) => {
      queryClient.setQueryData<Notification[]>(['activity', authUid], (old) => {
        const merged = upsertActivityNotification(old ?? [], incoming);
        const withReadState = applyPersistedReadState(merged, readKeysRef.current);
        setBadgeCount(
          computeActivityBadgeCount(withReadState, pendingFollowRequestCountRef.current),
        );
        return withReadState;
      });
    };

    const refreshActivity = async () => {
      try {
        const [items, readKeys] = await Promise.all([
          loadActivityFeed(authUid),
          loadReadActivityKeys(authUid),
        ]);
        readKeysRef.current = readKeys;
        syncActivity(applyPersistedReadState(items, readKeys));
      } catch (error) {
        console.warn('[ActivitySync] refresh failed', error);
      }
    };

    const scheduleRefresh = () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = setTimeout(() => {
        void refreshActivity();
      }, REFRESH_DEBOUNCE_MS);
    };

    void loadReadActivityKeys(authUid).then((keys) => {
      readKeysRef.current = keys;
    });
    void refreshActivity();

    const handleReactionChange = async (change: DocumentChange) => {
      if (change.type !== 'added' && change.type !== 'modified') return;

      const item = await reactionDocToNotification(
        change.doc.id,
        change.doc.data(),
        authUid,
      );
      if (item) upsertActivity(item);
    };

    const unsubReactions = onSnapshot(
      query(collection(db, 'reactions'), where('postAuthorId', '==', authUid)),
      (snap) => {
        snap.docChanges().forEach((change) => {
          void handleReactionChange(change);
        });
        scheduleRefresh();
      },
      (error) => {
        console.warn('[ActivitySync] reactions listener failed', error);
        scheduleRefresh();
      },
    );

    const unsubNotifications = onSnapshot(
      query(collection(db, 'notifications'), where('recipientId', '==', authUid)),
      (snap) => {
        snap.docChanges().forEach((change) => {
          if (change.type !== 'added' && change.type !== 'modified') return;
          const item = mapNotificationDoc(change.doc.id, change.doc.data());
          upsertActivity(item);
        });
        scheduleRefresh();
      },
      (error) => {
        console.warn('[ActivitySync] notifications listener failed', error);
        scheduleRefresh();
      },
    );

    const unsubRequests = onSnapshot(
      query(collection(db, 'followRequests'), where('targetId', '==', authUid)),
      async (snap) => {
        pendingFollowRequestCountRef.current = snap.size;
        const requests = snap.docs
          .map((docSnap) => mapFollowRequestDoc(docSnap.id, docSnap.data()))
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        const enriched = await enrichFollowRequests(requests);
        queryClient.setQueryData<FollowRequestWithRequester[]>(
          ['followRequests', authUid],
          enriched,
        );

        const current = queryClient.getQueryData<Notification[]>(['activity', authUid]) ?? [];
        setBadgeCount(
          computeActivityBadgeCount(current, pendingFollowRequestCountRef.current),
        );
      },
      (error) => {
        console.warn('[ActivitySync] followRequests listener failed', error);
      },
    );

    pollRef.current = setInterval(() => {
      void refreshActivity();
    }, POLL_INTERVAL_MS);

    return () => {
      unsubReactions();
      unsubNotifications();
      unsubRequests();
      if (pollRef.current) clearInterval(pollRef.current);
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
  }, [authUid, queryClient]);
}

/** @deprecated Use useActivitySync */
export const useActivityBadge = useActivitySync;
