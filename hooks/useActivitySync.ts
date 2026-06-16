import { useEffect, useRef } from 'react';
import { collection, onSnapshot, query, where, DocumentChange, DocumentData } from 'firebase/firestore';
import { useQueryClient } from '@tanstack/react-query';
import { getFirebaseDb, isFirebaseConfigured } from '@/services/firebase/config';
import { mapFollowRequestDoc, mapNotificationDoc } from '@/services/firebase/mappers';
import { enrichFollowRequests } from '@/services/firebase/followRequests';
import { loadActivityFeed } from '@/services/firebase/notifications';
import { loadReadActivityKeys } from '@/services/firebase/activityReadState';
import {
  deriveReactionsForRecipient,
  reactionDocToNotification,
  upsertActivityNotification,
} from '@/services/firebase/activityFeed';
import { applyPersistedReadState, getActivityReadKey } from '@/utils/activityRead';
import { computeActivityBadgeCount } from '@/utils/activityBadge';
import { useAuthStore } from '@/store/authStore';
import { useNotificationStore } from '@/store/notificationStore';
import { Notification } from '@/types';
import { FollowRequestWithRequester } from '@/services/firebase/followRequests';
import { getPost } from '@/services/firebase/posts';

const POLL_INTERVAL_MS = 30_000;

function publishActivity(
  authUid: string,
  items: Notification[],
  pendingFollowRequestCount: number,
  queryClient: ReturnType<typeof useQueryClient>,
): void {
  useNotificationStore.getState().setActivityItems(items);
  queryClient.setQueryData(['activity', authUid], items);
  useNotificationStore.getState().setUnreadCount(
    computeActivityBadgeCount(items, pendingFollowRequestCount),
  );
}

/** Real-time sync for activity badge, notifications list, and follow requests. */
export function useActivitySync() {
  const { firebaseUser } = useAuthStore();
  const queryClient = useQueryClient();
  const authUid = firebaseUser?.uid;
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const readKeysRef = useRef(new Set<string>());
  const pendingFollowRequestCountRef = useRef(0);

  useEffect(() => {
    if (!authUid || !isFirebaseConfigured()) {
      useNotificationStore.getState().setActivityItems([]);
      useNotificationStore.getState().setUnreadCount(0);
      return;
    }

    const db = getFirebaseDb();

    const upsertActivity = (incoming: Notification) => {
      const current = useNotificationStore.getState().activityItems;
      const merged = upsertActivityNotification(current, incoming);
      const withReadState = applyPersistedReadState(merged, readKeysRef.current);
      publishActivity(authUid, withReadState, pendingFollowRequestCountRef.current, queryClient);
    };

    const refreshActivity = async () => {
      try {
        const [items, readKeys] = await Promise.all([
          loadActivityFeed(authUid),
          loadReadActivityKeys(authUid),
        ]);
        readKeysRef.current = readKeys;
        publishActivity(
          authUid,
          applyPersistedReadState(items, readKeys),
          pendingFollowRequestCountRef.current,
          queryClient,
        );
      } catch (error) {
        console.warn('[ActivitySync] refresh failed', error);
      }
    };

    const ingestReaction = async (reactionId: string, data: DocumentData) => {
      const postAuthorId =
        data.postAuthorId ?? (data.postId ? (await getPost(data.postId))?.authorId : null);
      if (postAuthorId !== authUid) return;

      const item = await reactionDocToNotification(reactionId, data, authUid);
      if (item) upsertActivity(item);
    };

    const removeReactionActivity = async (data: DocumentData) => {
      if (data.userId === authUid) return;

      const postAuthorId =
        data.postAuthorId ?? (data.postId ? (await getPost(data.postId))?.authorId : null);
      if (postAuthorId !== authUid) return;

      const key = `reaction:${data.userId}:${data.postId}`;
      const next = useNotificationStore
        .getState()
        .activityItems.filter((item) => getActivityReadKey(item) !== key);
      publishActivity(
        authUid,
        applyPersistedReadState(next, readKeysRef.current),
        pendingFollowRequestCountRef.current,
        queryClient,
      );
    };

    const handleReactionChange = async (change: DocumentChange) => {
      if (change.type === 'removed') {
        await removeReactionActivity(change.doc.data());
        return;
      }

      if (change.type !== 'added' && change.type !== 'modified') return;
      await ingestReaction(change.doc.id, change.doc.data());
    };

    void loadReadActivityKeys(authUid).then((keys) => {
      readKeysRef.current = keys;
    });
    void refreshActivity();

    const unsubReactionsByAuthor = onSnapshot(
      query(collection(db, 'reactions'), where('postAuthorId', '==', authUid)),
      (snap) => {
        snap.docChanges().forEach((change) => {
          void handleReactionChange(change);
        });
      },
      (error) => {
        console.warn('[ActivitySync] reactions listener failed', error);
      },
    );

    const unsubPosts = onSnapshot(
      query(collection(db, 'posts'), where('authorId', '==', authUid)),
      (snap) => {
        snap.docChanges().forEach((change) => {
          if (change.type !== 'modified') return;
          void deriveReactionsForRecipient(authUid).then((reactionItems) => {
            let next = useNotificationStore.getState().activityItems;
            for (const item of reactionItems) {
              next = upsertActivityNotification(next, item);
            }
            publishActivity(
              authUid,
              applyPersistedReadState(next, readKeysRef.current),
              pendingFollowRequestCountRef.current,
              queryClient,
            );
          });
        });
      },
      (error) => {
        console.warn('[ActivitySync] posts listener failed', error);
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
      },
      (error) => {
        console.warn('[ActivitySync] notifications listener failed', error);
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

        publishActivity(
          authUid,
          useNotificationStore.getState().activityItems,
          pendingFollowRequestCountRef.current,
          queryClient,
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
      unsubReactionsByAuthor();
      unsubPosts();
      unsubNotifications();
      unsubRequests();
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [authUid, queryClient]);
}

/** @deprecated Use useActivitySync */
export const useActivityBadge = useActivitySync;
