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

// Keep in sync with constants/safety.ts AUTO_REMOVAL_REPORT_THRESHOLD.
const AUTO_REMOVAL_REPORT_THRESHOLD = 5;

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

async function deleteDocsByQuery(
  query: admin.firestore.Query,
): Promise<void> {
  const snap = await query.get();
  const docs = snap.docs;

  for (let i = 0; i < docs.length; i += 400) {
    const batch = db.batch();
    docs.slice(i, i + 400).forEach((docSnap) => batch.delete(docSnap.ref));
    await batch.commit();
  }
}

/**
 * Auto-moderation: when a post accumulates flags from enough distinct users,
 * remove the post and notify the author in their activity feed.
 */
export const onReportCreated = functions.firestore
  .document('reports/{reportId}')
  .onCreate(async (snap) => {
    const report = snap.data();
    if (report.targetType !== 'post') return;

    const postId: string = report.targetId;
    if (!postId) return;

    const postSnap = await db.collection('posts').doc(postId).get();
    if (!postSnap.exists) {
      functions.logger.info('[moderation] post already removed', { postId });
      return;
    }

    // Single-field query (no composite index needed); filter type in code.
    const reportsSnap = await db
      .collection('reports')
      .where('targetId', '==', postId)
      .get();

    const distinctReporters = new Set<string>();
    reportsSnap.docs.forEach((docSnap) => {
      const data = docSnap.data();
      if (data.targetType === 'post' && data.reporterId) {
        distinctReporters.add(data.reporterId);
      }
    });

    functions.logger.info('[moderation] evaluating post', {
      postId,
      distinctReporters: distinctReporters.size,
      threshold: AUTO_REMOVAL_REPORT_THRESHOLD,
    });

    if (distinctReporters.size < AUTO_REMOVAL_REPORT_THRESHOLD) return;

    const post = postSnap.data()!;
    const authorId: string = post.authorId;

    await Promise.all([
      deleteDocsByQuery(db.collection('comments').where('postId', '==', postId)),
      deleteDocsByQuery(db.collection('reactions').where('postId', '==', postId)),
    ]);

    await postSnap.ref.delete();

    functions.logger.info('[moderation] post removed', {
      postId,
      authorId,
      reporterCount: distinctReporters.size,
    });

    if (authorId) {
      await db.collection('notifications').add({
        recipientId: authorId,
        actorId: authorId,
        actorUsername: 'OMOF',
        actorDisplayName: 'OMOF Safety',
        actorPhotoURL: null,
        type: 'post_removed',
        postId: null,
        postImageURL: null,
        commentText: null,
        commentId: null,
        reactionType: null,
        reportCount: distinctReporters.size,
        read: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      const author = await getUser(authorId);
      if (author?.fcmToken) {
        await sendExpoPushNotification(
          author.fcmToken,
          'OMOF',
          'One of your posts was removed after multiple community reports.',
          { type: 'post_removed' },
        );
      }
    }
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
