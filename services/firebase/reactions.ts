import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { getFirebaseDb, getFirebaseAuth } from './config';
import { mapReactionDoc } from './mappers';
import { Reaction, ReactionType } from '@/types';
import { getReactionDocId } from '@/utils';
import { getPost } from './posts';
import { getUserById } from './users';
import { upsertReactionNotification } from './notifications';

async function notifyPostAuthorOfReaction(
  postId: string,
  userId: string,
  type: ReactionType,
  postAuthorId: string,
  actor: {
    username: string;
    displayName: string;
    photoURL: string | null;
  },
  postImageURL: string | null,
): Promise<void> {
  if (postAuthorId === userId) return;

  const authUid = getFirebaseAuth().currentUser?.uid ?? null;
  const notificationId = await upsertReactionNotification({
    recipientId: postAuthorId,
    actorId: userId,
    actorUsername: actor.username,
    actorDisplayName: actor.displayName,
    actorPhotoURL: actor.photoURL,
    type: 'reaction',
    postId,
    postImageURL,
    reactionType: type,
  });

  if (!notificationId) {
    console.warn('[reactions] activity notification was not upserted', {
      postId,
      actorId: userId,
      authUid,
      recipientId: postAuthorId,
      reactionType: type,
    });
  }
}

export async function removeReaction(postId: string, userId: string): Promise<void> {
  const db = getFirebaseDb();
  const reactionId = getReactionDocId(postId, userId);
  const reactionRef = doc(db, 'reactions', reactionId);
  const existing = await getDoc(reactionRef);

  if (!existing.exists()) return;

  await deleteDoc(reactionRef);
}

export async function setReaction(
  postId: string,
  userId: string,
  type: ReactionType,
): Promise<Reaction> {
  const db = getFirebaseDb();
  const [post, actor] = await Promise.all([getPost(postId), getUserById(userId)]);
  if (!post) {
    throw new Error('Post not found');
  }
  if (!actor) {
    throw new Error('User not found');
  }

  const reactionId = getReactionDocId(postId, userId);
  const reactionRef = doc(db, 'reactions', reactionId);
  const existing = await getDoc(reactionRef);
  const denormalized = {
    actorUsername: actor.username,
    actorDisplayName: actor.displayName,
    actorPhotoURL: actor.photoURL ?? null,
    postImageURL: post.imageURL ?? null,
  };

  if (existing.exists()) {
    const existingData = existing.data();
    const oldType = existingData.type as ReactionType;

    await updateDoc(reactionRef, {
      type,
      postAuthorId: post.authorId,
      updatedAt: serverTimestamp(),
      ...denormalized,
    });

    const updated = await getDoc(reactionRef);
    const reaction = mapReactionDoc(reactionId, updated.data()!);

    await notifyPostAuthorOfReaction(
      postId,
      userId,
      type,
      post.authorId,
      actor,
      post.imageURL,
    );

    return reaction;
  }

  await setDoc(reactionRef, {
    postId,
    userId,
    postAuthorId: post.authorId,
    type,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...denormalized,
  });

  const snap = await getDoc(reactionRef);
  const reaction = mapReactionDoc(reactionId, snap.data()!);

  await notifyPostAuthorOfReaction(
    postId,
    userId,
    type,
    post.authorId,
    actor,
    post.imageURL,
  );

  return reaction;
}

/** Set, change, or remove (tap active reaction again) the user's reaction on a post. */
export async function toggleReaction(
  postId: string,
  userId: string,
  type: ReactionType,
): Promise<Reaction | null> {
  const db = getFirebaseDb();
  const reactionId = getReactionDocId(postId, userId);
  const existing = await getDoc(doc(db, 'reactions', reactionId));

  if (existing.exists() && existing.data().type === type) {
    await removeReaction(postId, userId);
    return null;
  }

  return setReaction(postId, userId, type);
}

export async function getUserReaction(
  postId: string,
  userId: string,
): Promise<Reaction | null> {
  const db = getFirebaseDb();
  const reactionId = getReactionDocId(postId, userId);
  const snap = await getDoc(doc(db, 'reactions', reactionId));
  if (!snap.exists()) return null;
  return mapReactionDoc(snap.id, snap.data());
}
