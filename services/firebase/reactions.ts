import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  serverTimestamp,
  updateDoc,
  increment,
} from 'firebase/firestore';
import { getFirebaseDb, getFirebaseAuth } from './config';
import { mapReactionDoc } from './mappers';
import { Reaction, ReactionType } from '@/types';
import { getReactionDocId } from '@/utils';
import { getPost } from './posts';
import { getUserById } from './users';
import { createNotification } from './notifications';
import { onReactionGiven, onReactionReceived } from './gamification';

export async function setReaction(
  postId: string,
  userId: string,
  type: ReactionType,
): Promise<Reaction> {
  const db = getFirebaseDb();
  const reactionId = getReactionDocId(postId, userId);
  const reactionRef = doc(db, 'reactions', reactionId);
  const existing = await getDoc(reactionRef);

  if (existing.exists()) {
    const oldType = existing.data().type as ReactionType;
    if (oldType === type) {
      return mapReactionDoc(reactionId, existing.data());
    }

    await updateDoc(doc(db, 'posts', postId), {
      [`reactionCounts.${oldType}`]: increment(-1),
      [`reactionCounts.${type}`]: increment(1),
    });

    await updateDoc(reactionRef, {
      type,
      updatedAt: serverTimestamp(),
    });

    const updated = await getDoc(reactionRef);
    return mapReactionDoc(reactionId, updated.data()!);
  }

  await setDoc(reactionRef, {
    postId,
    userId,
    type,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await updateDoc(doc(db, 'posts', postId), {
    [`reactionCounts.${type}`]: increment(1),
  });

  const snap = await getDoc(reactionRef);
  const reaction = mapReactionDoc(reactionId, snap.data()!);

  const [post, actor] = await Promise.all([getPost(postId), getUserById(userId)]);
  if (post && actor && post.authorId !== userId) {
    const authUid = getFirebaseAuth().currentUser?.uid ?? null;
    const notificationId = await createNotification({
      recipientId: post.authorId,
      actorId: userId,
      actorUsername: actor.username,
      actorDisplayName: actor.displayName,
      actorPhotoURL: actor.photoURL,
      type: 'reaction',
      postId,
      postImageURL: post.imageURL,
      reactionType: type,
    });

    if (!notificationId) {
      console.warn('[reactions] activity notification was not created', {
        postId,
        actorId: userId,
        authUid,
        recipientId: post.authorId,
        reactionType: type,
      });
    }

    void onReactionReceived(post.authorId);
  }

  void onReactionGiven(userId);

  return reaction;
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

export async function removeReaction(postId: string, userId: string): Promise<void> {
  const db = getFirebaseDb();
  const reactionId = getReactionDocId(postId, userId);
  const reactionRef = doc(db, 'reactions', reactionId);
  const existing = await getDoc(reactionRef);

  if (!existing.exists()) return;

  const oldType = existing.data().type as ReactionType;
  await deleteDoc(reactionRef);
  await updateDoc(doc(db, 'posts', postId), {
    [`reactionCounts.${oldType}`]: increment(-1),
  });
}
