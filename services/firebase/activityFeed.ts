import { collection, getDocs, query, where, limit, DocumentData } from 'firebase/firestore';
import { getFirebaseDb } from './config';
import { mapFollowDoc, timestampToDate } from './mappers';
import { reactionActivityTimestamp } from './reactionActivity';
import { Notification, ReactionType } from '@/types';
import { getActivityReadKey } from '@/utils/activityRead';
import { getPostsByAuthor, getPost } from './posts';
import { getUserById } from './users';

/** True for activity rows built from follows/comments/reactions (not stored in notifications). */
export function isDerivedActivityId(id: string): boolean {
  return id.startsWith('derived_');
}

function buildReactionNotification(
  reactionId: string,
  data: DocumentData,
  recipientId: string,
  actor: {
    id: string;
    username: string;
    displayName: string;
    photoURL: string | null;
  },
  postImageURL: string | null,
): Notification {
  return {
    id: `derived_reaction_${reactionId}`,
    recipientId,
    actorId: actor.id,
    actorUsername: actor.username,
    actorDisplayName: actor.displayName,
    actorPhotoURL: actor.photoURL,
    type: 'reaction',
    postId: data.postId ?? null,
    postImageURL,
    commentText: null,
    commentId: null,
    reactionType: (data.type as ReactionType) ?? null,
    read: false,
    createdAt: reactionActivityTimestamp(data),
  };
}

/** Fast path when reaction doc has denormalized actor fields (no network). */
export function reactionDocToNotificationSync(
  reactionId: string,
  data: DocumentData,
  recipientId: string,
): Notification | null {
  if (data.userId === recipientId) return null;
  if (!data.actorUsername || !data.userId) return null;

  return buildReactionNotification(
    reactionId,
    data,
    recipientId,
    {
      id: data.userId,
      username: data.actorUsername,
      displayName: data.actorDisplayName ?? data.actorUsername,
      photoURL: data.actorPhotoURL ?? null,
    },
    data.postImageURL ?? null,
  );
}

/** Merge Firestore notifications with derived activity, keeping the newest row per key. */
export function mergeActivityItems(
  collectionItems: Notification[],
  derivedItems: Notification[],
): Notification[] {
  const byKey = new Map<string, Notification>();

  for (const item of collectionItems) {
    byKey.set(getActivityReadKey(item), item);
  }

  for (const item of derivedItems) {
    const key = getActivityReadKey(item);
    const existing = byKey.get(key);
    if (!existing || item.createdAt.getTime() >= existing.createdAt.getTime()) {
      byKey.set(key, item);
    }
  }

  return [...byKey.values()].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export async function reactionDocToNotification(
  reactionId: string,
  data: DocumentData,
  recipientId: string,
): Promise<Notification | null> {
  const syncItem = reactionDocToNotificationSync(reactionId, data, recipientId);
  if (syncItem) return syncItem;

  if (data.userId === recipientId) return null;

  const actor = await getUserById(data.userId);
  if (!actor) return null;

  const post = data.postId ? await getPost(data.postId) : null;

  return buildReactionNotification(
    reactionId,
    data,
    recipientId,
    {
      id: actor.id,
      username: actor.username,
      displayName: actor.displayName,
      photoURL: actor.photoURL,
    },
    post?.imageURL ?? data.postImageURL ?? null,
  );
}

export async function deriveReactionsForRecipient(recipientId: string): Promise<Notification[]> {
  const db = getFirebaseDb();
  const items: Notification[] = [];

  const reactionsSnap = await getDocs(
    query(
      collection(db, 'reactions'),
      where('postAuthorId', '==', recipientId),
      limit(100),
    ),
  );

  for (const reactionDoc of reactionsSnap.docs) {
    const item = await reactionDocToNotification(reactionDoc.id, reactionDoc.data(), recipientId);
    if (item) items.push(item);
  }

  if (items.length > 0) {
    return items;
  }

  // Legacy reactions without postAuthorId — scan the author's posts.
  const myPosts = await getPostsByAuthor(recipientId, 50);
  for (const post of myPosts.items) {
    const legacySnap = await getDocs(
      query(collection(db, 'reactions'), where('postId', '==', post.id), limit(50)),
    );

    for (const reactionDoc of legacySnap.docs) {
      const data = reactionDoc.data();
      if (data.postAuthorId && data.postAuthorId !== recipientId) continue;
      const item = await reactionDocToNotification(reactionDoc.id, data, recipientId);
      if (item) items.push(item);
    }
  }

  return items;
}

/**
 * Build an activity list from collections that already exist when the
 * notifications collection is empty or not yet writable.
 */
export async function deriveActivityFromSources(recipientId: string): Promise<Notification[]> {
  const db = getFirebaseDb();
  const items: Notification[] = [];

  const followsSnap = await getDocs(
    query(
      collection(db, 'follows'),
      where('followingId', '==', recipientId),
      limit(50),
    ),
  );

  for (const followDoc of followsSnap.docs) {
    const follow = mapFollowDoc(followDoc.id, followDoc.data());
    if (follow.followerId === recipientId) continue;

    const actor = await getUserById(follow.followerId);
    if (!actor) continue;

    items.push({
      id: `derived_follow_${followDoc.id}`,
      recipientId,
      actorId: actor.id,
      actorUsername: actor.username,
      actorDisplayName: actor.displayName,
      actorPhotoURL: actor.photoURL,
      type: 'follow',
      postId: null,
      postImageURL: null,
      commentText: null,
      commentId: null,
      reactionType: null,
      read: false,
      createdAt: follow.createdAt,
    });
  }

  const myPosts = await getPostsByAuthor(recipientId, 50);

  for (const post of myPosts.items) {
    const commentsSnap = await getDocs(
      query(collection(db, 'comments'), where('postId', '==', post.id), limit(50)),
    );

    for (const commentDoc of commentsSnap.docs) {
      const data = commentDoc.data();
      if (data.authorId === recipientId) continue;

      items.push({
        id: `derived_comment_${commentDoc.id}`,
        recipientId,
        actorId: data.authorId,
        actorUsername: data.authorUsername,
        actorDisplayName: data.authorDisplayName,
        actorPhotoURL: data.authorPhotoURL ?? null,
        type: 'comment',
        postId: post.id,
        postImageURL: post.imageURL,
        commentText: data.text,
        commentId: commentDoc.id,
        reactionType: null,
        read: false,
        createdAt: timestampToDate(data.createdAt),
      });
    }
  }

  const reactionItems = await deriveReactionsForRecipient(recipientId);
  items.push(...reactionItems);

  items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return items;
}

export function upsertActivityNotification(
  items: Notification[],
  incoming: Notification,
): Notification[] {
  const key = getActivityReadKey(incoming);
  const existing = items.find((item) => getActivityReadKey(item) === key);

  if (existing && incoming.createdAt.getTime() < existing.createdAt.getTime()) {
    return items;
  }

  const nextItem =
    existing && incoming.createdAt.getTime() >= existing.createdAt.getTime()
      ? { ...incoming, read: false }
      : incoming;

  const filtered = items.filter((item) => getActivityReadKey(item) !== key);
  return [nextItem, ...filtered].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}
