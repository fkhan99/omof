import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

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

  const docRef = await db.collection('notifications').add({
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
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  functions.logger.info('[Notifications] created', {
    id: docRef.id,
    type: data.type,
    recipientId: data.recipientId,
    actorId: data.actorId,
    actorUsername: data.actorUsername,
    postId: data.postId ?? null,
  });

  const recipient = await getUser(data.recipientId);
  if (recipient?.fcmToken) {
    let body = '';
    switch (data.type) {
      case 'comment':
        body = `${data.actorUsername} commented: ${data.commentText ?? ''}`;
        break;
      case 'reaction':
        body = `${data.actorUsername} reacted to your post`;
        break;
      case 'like':
        body = `${data.actorUsername} liked your post`;
        break;
      case 'follow':
        body = `${data.actorUsername} followed you`;
        break;
    }

    try {
      await admin.messaging().send({
        token: recipient.fcmToken,
        notification: {
          title: 'OMOF',
          body,
        },
        data: {
          type: data.type,
          postId: data.postId ?? '',
        },
      });
    } catch (error) {
      functions.logger.warn('Failed to send push notification', error);
    }
  }
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
