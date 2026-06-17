import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { sendExpoPushNotification } from './expoPush';

admin.initializeApp();

const db = admin.firestore();

interface UserData {
  id: string;
  username: string;
  displayName: string;
  photoURL?: string | null;
  fcmToken?: string | null;
}

const REACTION_LABELS: Record<string, string> = {
  relate: 'I relate',
  been_there: "I've been there",
  sending_support: 'Sending support',
};

async function getUser(userId: string): Promise<UserData | null> {
  const snap = await db.collection('users').doc(userId).get();
  if (!snap.exists) return null;
  const data = snap.data()!;
  return {
    id: snap.id,
    username: data.username,
    displayName: data.displayName,
    photoURL: data.photoURL ?? null,
    fcmToken: data.fcmToken ?? null,
  };
}

async function dispatchPushNotification(data: {
  recipientId: string;
  actorUsername: string;
  type: 'comment' | 'reaction' | 'follow' | 'like';
  postId?: string | null;
  commentText?: string | null;
  reactionType?: string | null;
}) {
  const recipient = await getUser(data.recipientId);
  if (!recipient?.fcmToken) {
    functions.logger.info('[push] skipped — recipient has no Expo token', {
      recipientId: data.recipientId,
      type: data.type,
    });
    return;
  }

  let body = '';
  switch (data.type) {
    case 'comment':
      body = `${data.actorUsername} commented: ${data.commentText ?? ''}`;
      break;
    case 'reaction': {
      const label = data.reactionType
        ? REACTION_LABELS[data.reactionType] ?? 'reacted to'
        : 'reacted to';
      body = `${data.actorUsername} ${label} your post`;
      break;
    }
    case 'like':
      body = `${data.actorUsername} liked your post`;
      break;
    case 'follow':
      body = `${data.actorUsername} followed you`;
      break;
  }

  await sendExpoPushNotification(recipient.fcmToken, 'OMOF', body, {
    type: data.type,
    postId: data.postId ?? '',
    actorUsername: data.actorUsername,
  });
}

async function createNotification(data: {
  recipientId: string;
  actorId: string;
  actorUsername: string;
  actorDisplayName: string;
  actorPhotoURL?: string | null;
  type: 'comment' | 'reaction' | 'follow' | 'like';
  postId?: string | null;
  postImageURL?: string | null;
  commentText?: string | null;
  commentId?: string | null;
  reactionType?: string | null;
}) {
  if (data.recipientId === data.actorId) {
    functions.logger.info('[Notifications] skipped self-notification', {
      type: data.type,
      actorId: data.actorId,
    });
    return;
  }

  // In-app notification docs are created on the client; Cloud Functions only deliver push.
  await dispatchPushNotification({
    recipientId: data.recipientId,
    actorUsername: data.actorUsername,
    type: data.type,
    postId: data.postId,
    commentText: data.commentText,
    reactionType: data.reactionType,
  });
}

export const onCommentCreated = functions.firestore
  .document('comments/{commentId}')
  .onCreate(async (snap) => {
    const comment = snap.data();
    const postSnap = await db.collection('posts').doc(comment.postId).get();
    if (!postSnap.exists) return;

    const post = postSnap.data()!;
    const actor = await getUser(comment.authorId);
    if (!actor) return;

    await createNotification({
      recipientId: post.authorId,
      type: 'comment',
      actorId: comment.authorId,
      actorUsername: actor.username,
      actorDisplayName: actor.displayName,
      actorPhotoURL: actor.photoURL ?? null,
      postId: comment.postId,
      postImageURL: post.imageURL ?? null,
      commentText: comment.text,
      commentId: snap.id,
    });
  });

export const onReactionCreated = functions.firestore
  .document('reactions/{reactionId}')
  .onCreate(async (snap) => {
    const reaction = snap.data();
    const postSnap = await db.collection('posts').doc(reaction.postId).get();
    if (!postSnap.exists) return;

    const post = postSnap.data()!;
    const actor = await getUser(reaction.userId);
    if (!actor) return;

    await createNotification({
      recipientId: post.authorId,
      type: 'reaction',
      actorId: reaction.userId,
      actorUsername: actor.username,
      actorDisplayName: actor.displayName,
      actorPhotoURL: actor.photoURL ?? null,
      postId: reaction.postId,
      postImageURL: post.imageURL ?? null,
      reactionType: reaction.type,
    });
  });

export const onFollowCreated = functions.firestore
  .document('follows/{followId}')
  .onCreate(async (snap) => {
    const follow = snap.data();
    const actor = await getUser(follow.followerId);
    if (!actor) return;

    await createNotification({
      recipientId: follow.followingId,
      type: 'follow',
      actorId: follow.followerId,
      actorUsername: actor.username,
      actorDisplayName: actor.displayName,
      actorPhotoURL: actor.photoURL ?? null,
    });
  });

export const deleteMyAuthUser = functions.https.onCall(async (_data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'You must be signed in to delete your account.',
    );
  }

  await admin.auth().deleteUser(context.auth.uid);
  return { success: true };
});
