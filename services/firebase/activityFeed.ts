import { collection, getDocs, query, where, limit, DocumentData } from 'firebase/firestore';
import { getFirebaseDb } from './config';
import { mapFollowDoc, timestampToDate } from './mappers';
import { Notification, ReactionType } from '@/types';
import { getActivityReadKey } from '@/utils/activityRead';
import { getPostsByAuthor } from './posts';
import { getUserById } from './users';
import { getPost } from './posts';

/** True for activity rows built from follows/comments/reactions (not stored in notifications). */
export function isDerivedActivityId(id: string): boolean {
  return id.startsWith('derived_');
}

/** Merge Firestore notifications with derived activity, avoiding duplicates. */
export function mergeActivityItems(
  collectionItems: Notification[],
  derivedItems: Notification[],
): Notification[] {
  const seen = new Set(collectionItems.map(getActivityReadKey));
  const merged = [...collectionItems];

  for (const item of derivedItems) {
    const key = getActivityReadKey(item);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(item);
  }

  merged.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return merged;
}

export async function reactionDocToNotification(
  reactionId: string,
  data: DocumentData,
  recipientId: string,
): Promise<Notification | null> {
  if (data.userId === recipientId) return null;

  const actor = await getUserById(data.userId);
  if (!actor) return null;

  const post = data.postId ? await getPost(data.postId) : null;

  return {
    id: `derived_reaction_${reactionId}`,
    recipientId,
    actorId: actor.id,
    actorUsername: actor.username,
    actorDisplayName: actor.displayName,
    actorPhotoURL: actor.photoURL,
    type: 'reaction',
    postId: data.postId ?? null,
    postImageURL: post?.imageURL ?? null,
    commentText: null,
    commentId: null,
    reactionType: (data.type as ReactionType) ?? null,
    read: false,
    createdAt: timestampToDate(data.createdAt ?? data.updatedAt),
  };
}

async function deriveReactionsForRecipient(recipientId: string): Promise<Notification[]> {
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
  const filtered = items.filter((item) => getActivityReadKey(item) !== key);
  return [incoming, ...filtered].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}
