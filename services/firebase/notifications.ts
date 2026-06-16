import {
  collection,
  doc,
  addDoc,
  getDocs,
  updateDoc,
  query,
  where,
  limit,
  serverTimestamp,
  QueryDocumentSnapshot,
  DocumentData,
} from 'firebase/firestore';
import { getFirebaseDb, getFirebaseAuth } from './config';
import { mapNotificationDoc } from './mappers';
import { Notification, PaginatedResult, CreateNotificationData } from '@/types';
import { NOTIFICATIONS_PAGE_SIZE } from '@/constants/theme';
import { deriveActivityFromSources, isDerivedActivityId, mergeActivityItems } from './activityFeed';
import { getIncomingFollowRequests } from './followRequests';
import { computeActivityBadgeCount } from '@/utils/activityBadge';
import {
  applyPersistedReadState,
  loadReadActivityKeys,
  markActivityKeyRead,
  markActivityKeysRead,
} from './activityReadState';
import { getActivityReadKey } from '@/utils/activityRead';
import { getUserById } from './users';
import { dispatchPushForNotification } from '@/utils/pushNotifications';

async function queryNotificationsByRecipient(recipientId: string): Promise<Notification[]> {
  const db = getFirebaseDb();

  // Single-field query — no composite index required. Sort client-side.
  const snap = await getDocs(
    query(collection(db, 'notifications'), where('recipientId', '==', recipientId), limit(200)),
  );

  return snap.docs
    .map((docSnap) => mapNotificationDoc(docSnap.id, docSnap.data()))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export async function getNotifications(
  recipientId: string,
  pageSize: number = NOTIFICATIONS_PAGE_SIZE,
  _lastDoc?: QueryDocumentSnapshot<DocumentData>,
): Promise<PaginatedResult<Notification>> {
  const authUid = getFirebaseAuth().currentUser?.uid ?? null;

  console.log('[Activity] loading notifications', {
    authUid,
    recipientId,
  });

  let collectionItems: Notification[] = [];

  try {
    collectionItems = await queryNotificationsByRecipient(recipientId);
    console.log('[Activity] notifications collection count:', collectionItems.length, {
      types: collectionItems.map((n) => n.type),
    });
  } catch (error: unknown) {
    const firebaseError = error as { code?: string; message?: string };
    console.error('[Activity] notifications query failed', {
      code: firebaseError.code,
      message: firebaseError.message ?? String(error),
    });
  }

  const derivedItems = await deriveActivityFromSources(recipientId);
  console.log('[Activity] derived activity count:', derivedItems.length, {
    types: derivedItems.map((n) => n.type),
  });

  const items = mergeActivityItems(collectionItems, derivedItems);
  const readKeys = await loadReadActivityKeys(recipientId);
  const itemsWithReadState = applyPersistedReadState(items, readKeys);

  const page = itemsWithReadState.slice(0, pageSize);

  console.log('[Activity] loaded notifications', {
    count: page.length,
    ids: page.map((n) => n.id),
    types: page.map((n) => n.type),
  });

  return {
    items: page,
    lastDoc: null,
    hasMore: itemsWithReadState.length > pageSize,
  };
}

/** Activity feed for the signed-in user (recipientId == auth.currentUser.uid). */
export async function getMyNotifications(
  pageSize: number = NOTIFICATIONS_PAGE_SIZE,
  lastDoc?: QueryDocumentSnapshot<DocumentData>,
): Promise<PaginatedResult<Notification>> {
  const authUid = getFirebaseAuth().currentUser?.uid;
  if (!authUid) {
    return { items: [], lastDoc: null, hasMore: false };
  }
  return getNotifications(authUid, pageSize, lastDoc);
}

export async function markNotificationRead(notification: Notification): Promise<void> {
  const authUid = getFirebaseAuth().currentUser?.uid;
  if (!authUid) return;

  const readKey = getActivityReadKey(notification);
  await markActivityKeyRead(authUid, readKey);

  if (isDerivedActivityId(notification.id)) return;

  const db = getFirebaseDb();
  try {
    await updateDoc(doc(db, 'notifications', notification.id), { read: true });
  } catch (error: unknown) {
    const firebaseError = error as { code?: string; message?: string };
    console.warn('notification Firestore read update failed — persisted locally', {
      id: notification.id,
      code: firebaseError.code,
      message: firebaseError.message ?? String(error),
    });
  }
}

export async function markAllNotificationsRead(
  recipientId: string,
  notifications: Notification[],
): Promise<void> {
  const readKeys = notifications.map(getActivityReadKey);
  await markActivityKeysRead(recipientId, readKeys);

  const db = getFirebaseDb();
  const persistedIds = new Set(
    notifications.filter((item) => !isDerivedActivityId(item.id)).map((item) => item.id),
  );

  if (persistedIds.size === 0) return;

  const snap = await getDocs(
    query(collection(db, 'notifications'), where('recipientId', '==', recipientId), limit(200)),
  );

  const unread = snap.docs.filter(
    (docSnap) => persistedIds.has(docSnap.id) && docSnap.data().read !== true,
  );

  await Promise.all(
    unread.map((docSnap) =>
      updateDoc(doc(db, 'notifications', docSnap.id), { read: true }).catch((error) => {
        console.warn('notification Firestore read update failed — persisted locally', {
          id: docSnap.id,
          error,
        });
      }),
    ),
  );
}

export async function getUnreadCount(recipientId: string): Promise<number> {
  const { items } = await getNotifications(recipientId, 200);
  const readKeys = await loadReadActivityKeys(recipientId);
  const itemsWithRead = applyPersistedReadState(items, readKeys);
  const pendingRequests = await getIncomingFollowRequests(recipientId);
  return computeActivityBadgeCount(itemsWithRead, pendingRequests.length);
}

export async function createFollowReceivedNotification(
  followerId: string,
  followingId: string,
): Promise<string | null> {
  const authUid = getFirebaseAuth().currentUser?.uid ?? null;
  if (!authUid || authUid !== followingId) {
    return null;
  }

  const actor = await getUserById(followerId);
  if (!actor) return null;

  const db = getFirebaseDb();
  const notificationData = {
    recipientId: followingId,
    actorId: followerId,
    actorUsername: actor.username,
    actorDisplayName: actor.displayName,
    actorPhotoURL: actor.photoURL ?? null,
    type: 'follow' as const,
    postId: null,
    postImageURL: null,
    commentText: null,
    commentId: null,
    reactionType: null,
    read: false,
    createdAt: serverTimestamp(),
  };

  try {
    const docRef = await addDoc(collection(db, 'notifications'), notificationData);
    void dispatchPushForNotification({
      recipientId: followingId,
      actorId: followerId,
      actorUsername: actor.username,
      actorDisplayName: actor.displayName,
      actorPhotoURL: actor.photoURL,
      type: 'follow',
    });
    return docRef.id;
  } catch (error: unknown) {
    const firebaseError = error as { code?: string; message?: string };
    console.error('follow received notification creation failed', {
      code: firebaseError.code ?? 'unknown',
      message: firebaseError.message ?? String(error),
      followerId,
      followingId,
    });
    return null;
  }
}

export async function createNotification(data: CreateNotificationData): Promise<string | null> {
  const db = getFirebaseDb();
  const authUid = getFirebaseAuth().currentUser?.uid ?? null;

  console.log('creating notification', {
    authUid,
    actorId: data.actorId,
    recipientId: data.recipientId,
    type: data.type,
    actorMatchesAuth: authUid === data.actorId,
  });

  if (data.recipientId === data.actorId) {
    console.log('notification skipped — own action', {
      type: data.type,
      actorId: data.actorId,
    });
    return null;
  }

  if (!authUid || authUid !== data.actorId) {
    console.error('notification skipped — actorId must match signed-in user', {
      authUid,
      actorId: data.actorId,
      type: data.type,
    });
    return null;
  }

  const notificationData = {
    recipientId: data.recipientId,
    actorId: data.actorId,
    actorUsername: data.actorUsername,
    actorDisplayName: data.actorDisplayName,
    actorPhotoURL: data.actorPhotoURL ?? null,
    type: data.type,
    postId: data.postId ?? null,
    postImageURL: data.postImageURL ?? null,
    commentText: data.commentText ?? null,
    commentId: data.commentId ?? null,
    reactionType: data.reactionType ?? null,
    read: false,
    createdAt: serverTimestamp(),
  };

  try {
    const docRef = await addDoc(collection(db, 'notifications'), notificationData);

    console.log('notification created', {
      id: docRef.id,
      ...notificationData,
      createdAt: '(serverTimestamp)',
    });

    void dispatchPushForNotification(data);

    return docRef.id;
  } catch (error: unknown) {
    const firebaseError = error as { code?: string; message?: string };
    console.error('notification creation failed', {
      code: firebaseError.code ?? 'unknown',
      message: firebaseError.message ?? String(error),
      authUid,
      notificationData,
      hint:
        firebaseError.code === 'permission-denied'
          ? 'Update Firestore rules in Firebase Console to allow notifications create'
          : undefined,
    });
    return null;
  }
}
