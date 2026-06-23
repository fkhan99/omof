import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { sendExpoPushNotification } from './expoPush';
import {
  handleCommentCreatedGamification,
  handlePostCreatedGamification,
  handleReactionGivenGamification,
  handleReactionReceivedGamification,
  reconcileUserGamification,
  syncFollowCounts,
} from './gamification';
import { createAdminPurgeUserDataCallable, createOnAuthUserDeleted } from './userDeletion';
import { createAdminEmailVerificationCallable } from './adminAuth';
import { createRequestVerificationEmailCallable } from './verificationEmail';
import { applyServerModeration, getPostModerationText } from './moderation/applyModeration';
import { escalateReportedContent } from './moderation/reportEscalation';
import {
  createAdminListModerationQueueCallable,
  createAdminModerationActionCallable,
} from './moderation/adminModeration';

admin.initializeApp();

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

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

// Keep in sync with constants/moderation.ts REVIEW_REPORT_THRESHOLD.
import { REVIEW_REPORT_THRESHOLD } from './moderation/phrases';

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

export const onPostCreated = functions.firestore
  .document('posts/{postId}')
  .onCreate(async (snap) => {
    const post = snap.data();
    if (!post.authorId) return;

    const caption = typeof post.caption === 'string' ? post.caption : '';
    await applyServerModeration(snap.ref, caption, {
      reviewRequired: post.reviewRequired === true,
      moderationStatus: post.moderationStatus,
    });

    await handlePostCreatedGamification(post.authorId as string);
  });

/** Re-classify when caption or growth text is edited after publish. */
export const onPostUpdated = functions.firestore
  .document('posts/{postId}')
  .onUpdate(async (change) => {
    const before = change.before.data();
    const after = change.after.data();

    const captionChanged = before.caption !== after.caption;
    const growthChanged = before.growthCaption !== after.growthCaption;

    if (!captionChanged && !growthChanged) return;

    const text = getPostModerationText(after);
    await applyServerModeration(change.after.ref, text, {
      reviewRequired: after.reviewRequired === true,
      moderationStatus: after.moderationStatus,
    });
  });

export const onCommentCreated = functions.firestore
  .document('comments/{commentId}')
  .onCreate(async (snap) => {
    const comment = snap.data();
    const postSnap = await db.collection('posts').doc(comment.postId).get();
    if (!postSnap.exists) return;

    const post = postSnap.data()!;
    const text = typeof comment.text === 'string' ? comment.text : '';

    await applyServerModeration(snap.ref, text, {
      reviewRequired: comment.reviewRequired === true,
      moderationStatus: comment.moderationStatus,
    });

    const refreshed = await snap.ref.get();
    const moderated = refreshed.data()!;
    const isHidden = moderated.isHidden === true;

    const actor = await getUser(comment.authorId);
    if (!actor) return;

    await postSnap.ref.update({
      commentCount: FieldValue.increment(1),
    });

    const isOwnPost = post.authorId === comment.authorId;
    await handleCommentCreatedGamification(comment.authorId, isOwnPost);

    if (isHidden) {
      functions.logger.info('[moderation] skipping comment notification — hidden', {
        commentId: snap.id,
      });
      return;
    }

    if (post.authorId !== comment.authorId) {
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
    }

    const replyToUserId = comment.replyToUserId as string | null | undefined;
    if (
      replyToUserId
      && replyToUserId !== comment.authorId
      && replyToUserId !== post.authorId
    ) {
      await createNotification({
        recipientId: replyToUserId,
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
    }
  });

export const onCommentDeleted = functions.firestore
  .document('comments/{commentId}')
  .onDelete(async (snap) => {
    const comment = snap.data();
    const postId = comment.postId as string | undefined;
    const authorId = comment.authorId as string | undefined;
    if (!postId) return;

    const postRef = db.collection('posts').doc(postId);
    const postSnap = await postRef.get();
    if (postSnap.exists) {
      await postRef.update({
        commentCount: FieldValue.increment(-1),
      });
    }

    if (authorId) {
      await reconcileUserGamification(authorId);
    }
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

    await postSnap.ref.update({
      [`reactionCounts.${reaction.type}`]: FieldValue.increment(1),
    });

    await handleReactionGivenGamification(reaction.userId);
    if (post.authorId !== reaction.userId) {
      await handleReactionReceivedGamification(post.authorId);
    }

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

export const onReactionUpdated = functions.firestore
  .document('reactions/{reactionId}')
  .onUpdate(async (change) => {
    const before = change.before.data();
    const after = change.after.data();
    if (before.type === after.type) return;

    const postSnap = await db.collection('posts').doc(after.postId).get();
    if (!postSnap.exists) return;

    const post = postSnap.data()!;

    await postSnap.ref.update({
      [`reactionCounts.${before.type}`]: FieldValue.increment(-1),
      [`reactionCounts.${after.type}`]: FieldValue.increment(1),
    });

    await handleReactionGivenGamification(after.userId);
    if (post.authorId !== after.userId) {
      await handleReactionReceivedGamification(post.authorId);
    }
  });

export const onReactionDeleted = functions.firestore
  .document('reactions/{reactionId}')
  .onDelete(async (snap) => {
    const reaction = snap.data();
    const postSnap = await db.collection('posts').doc(reaction.postId).get();

    if (postSnap.exists) {
      await postSnap.ref.update({
        [`reactionCounts.${reaction.type}`]: FieldValue.increment(-1),
      });
    }

    const reactorId = reaction.userId as string | undefined;
    const postAuthorId = postSnap.exists
      ? (postSnap.data()?.authorId as string | undefined)
      : (reaction.postAuthorId as string | undefined);

    if (reactorId) {
      await reconcileUserGamification(reactorId);
    }
    if (postAuthorId && postAuthorId !== reactorId) {
      await reconcileUserGamification(postAuthorId);
    }
  });

export const onFollowCreated = functions.firestore
  .document('follows/{followId}')
  .onCreate(async (snap) => {
    const follow = snap.data();
    const actor = await getUser(follow.followerId);
    if (!actor) return;

    await syncFollowCounts(follow.followerId, follow.followingId);

    await createNotification({
      recipientId: follow.followingId,
      type: 'follow',
      actorId: follow.followerId,
      actorUsername: actor.username,
      actorDisplayName: actor.displayName,
      actorPhotoURL: actor.photoURL ?? null,
    });
  });

export const onFollowDeleted = functions.firestore
  .document('follows/{followId}')
  .onDelete(async (snap) => {
    const follow = snap.data();
    await syncFollowCounts(follow.followerId, follow.followingId);
  });

/**
 * Auto-moderation: when content accumulates flags from enough distinct users,
 * hide it and send to the admin review queue.
 */
export const onReportCreated = functions.firestore
  .document('reports/{reportId}')
  .onCreate(async (snap) => {
    const report = snap.data();
    const targetType = report.targetType as 'post' | 'comment' | undefined;
    const targetId: string | undefined = report.targetId;

    if (!targetId || (targetType !== 'post' && targetType !== 'comment')) return;

    const escalated = await escalateReportedContent(db, targetType, targetId);

    if (!escalated || targetType !== 'post') return;

    const postSnap = await db.collection('posts').doc(targetId).get();
    if (!postSnap.exists) return;

    const post = postSnap.data()!;
    const authorId: string = post.authorId;

    if (authorId) {
      await db.collection('notifications').add({
        recipientId: authorId,
        actorId: authorId,
        actorUsername: 'OMOF',
        actorDisplayName: 'OMOF Safety',
        actorPhotoURL: null,
        type: 'post_removed',
        postId: targetId,
        postImageURL: post.imageURL ?? null,
        commentText: null,
        commentId: null,
        reactionType: null,
        reportCount: post.reportCount ?? REVIEW_REPORT_THRESHOLD,
        read: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      const author = await getUser(authorId);
      if (author?.fcmToken) {
        await sendExpoPushNotification(
          author.fcmToken,
          'OMOF',
          'One of your posts is under review after multiple community reports.',
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

  // Firestore cleanup runs in onAuthUserDeleted after this succeeds.
  await admin.auth().deleteUser(context.auth.uid);
  return { success: true };
});

/** When Auth is removed (console, admin SDK, or deleteMyAuthUser), wipe all user data. */
export const onAuthUserDeleted = createOnAuthUserDeleted();

/** Admin-only: purge orphaned data for a uid whose Auth account is already gone. */
export const adminPurgeUserData = createAdminPurgeUserDataCallable();

/** Admin-only: generate a verification link or mark an email verified. */
export const adminEmailVerification = createAdminEmailVerificationCallable();

/** Signed-in users: send verification email via configured SMTP (falls back client-side). */
export const requestVerificationEmail = createRequestVerificationEmailCallable();

/** Admin-only: list posts and comments awaiting moderation review. */
export const adminListModerationQueue = createAdminListModerationQueueCallable();

/** Admin-only: approve, reject, or mark content as spam/blocked. */
export const adminModerationAction = createAdminModerationActionCallable();
