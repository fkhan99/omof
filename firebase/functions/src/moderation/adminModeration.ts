import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';

const FieldValue = admin.firestore.FieldValue;

export type AdminModerationAction = 'approve' | 'reject' | 'mark_spam' | 'mark_blocked';

function getAdminUids(): Set<string> {
  const configured =
    functions.config().omof?.admin_uids
    ?? process.env.OMOF_ADMIN_UIDS
    ?? '';
  return new Set(
    configured
      .split(',')
      .map((value: string) => value.trim())
      .filter(Boolean),
  );
}

async function assertAdmin(context: functions.https.CallableContext): Promise<void> {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'You must be signed in.');
  }

  const db = admin.firestore();
  const userSnap = await db.collection('users').doc(context.auth.uid).get();
  const isAdminDoc = userSnap.exists && userSnap.data()?.isAdmin === true;

  const adminUids = getAdminUids();
  const isConfiguredAdmin = adminUids.has(context.auth.uid);

  if (!isAdminDoc && !isConfiguredAdmin) {
    throw new functions.https.HttpsError('permission-denied', 'Admin access required.');
  }
}

export function createAdminListModerationQueueCallable() {
  return functions.https.onCall(async (data, context) => {
    await assertAdmin(context);

    const limit = typeof data?.limit === 'number' ? Math.min(data.limit, 50) : 30;
    const db = admin.firestore();

    const [postsSnap, commentsSnap] = await Promise.all([
      db.collection('posts').where('reviewRequired', '==', true).limit(limit).get(),
      db.collection('comments').where('reviewRequired', '==', true).limit(limit).get(),
    ]);

    const items = [
      ...postsSnap.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          targetType: 'post' as const,
          authorId: data.authorId,
          authorUsername: data.authorUsername,
          text: data.caption ?? '',
          moderationStatus: data.moderationStatus ?? 'REVIEW',
          moderationReason: data.moderationReason ?? '',
          moderationConfidence: data.moderationConfidence ?? 0,
          reportCount: data.reportCount ?? 0,
          reviewRequired: data.reviewRequired ?? true,
          isHidden: data.isHidden ?? true,
          createdAt: data.createdAt?.toMillis?.() ?? null,
        };
      }),
      ...commentsSnap.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          targetType: 'comment' as const,
          authorId: data.authorId,
          authorUsername: data.authorUsername,
          text: data.text ?? '',
          postId: data.postId ?? null,
          moderationStatus: data.moderationStatus ?? 'REVIEW',
          moderationReason: data.moderationReason ?? '',
          moderationConfidence: data.moderationConfidence ?? 0,
          reportCount: data.reportCount ?? 0,
          reviewRequired: data.reviewRequired ?? true,
          isHidden: data.isHidden ?? true,
          createdAt: data.createdAt?.toMillis?.() ?? null,
        };
      }),
    ].sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));

    return { items: items.slice(0, limit) };
  });
}

export function createAdminModerationActionCallable() {
  return functions.https.onCall(async (data, context) => {
    await assertAdmin(context);

    const targetType = data?.targetType === 'comment' ? 'comment' : 'post';
    const targetId = typeof data?.targetId === 'string' ? data.targetId.trim() : '';
    const action = data?.action as AdminModerationAction;

    if (!targetId) {
      throw new functions.https.HttpsError('invalid-argument', 'targetId is required.');
    }

    if (!['approve', 'reject', 'mark_spam', 'mark_blocked'].includes(action)) {
      throw new functions.https.HttpsError('invalid-argument', 'Invalid moderation action.');
    }

    const collection = targetType === 'post' ? 'posts' : 'comments';
    const ref = admin.firestore().collection(collection).doc(targetId);
    const snap = await ref.get();

    if (!snap.exists) {
      throw new functions.https.HttpsError('not-found', 'Content not found.');
    }

    const adminNote =
      typeof data?.note === 'string' && data.note.trim()
        ? data.note.trim()
        : `Admin action: ${action}`;

    let patch: Record<string, unknown>;

    switch (action) {
      case 'approve':
        patch = {
          moderationStatus: 'SAFE',
          moderationReason: adminNote,
          reviewRequired: false,
          isHidden: false,
        };
        break;
      case 'reject':
        patch = {
          moderationStatus: 'BLOCKED',
          moderationReason: adminNote,
          reviewRequired: false,
          isHidden: true,
        };
        break;
      case 'mark_spam':
        patch = {
          moderationStatus: 'SPAM',
          moderationReason: adminNote,
          reviewRequired: false,
          isHidden: true,
        };
        break;
      case 'mark_blocked':
        patch = {
          moderationStatus: 'BLOCKED',
          moderationReason: adminNote,
          reviewRequired: false,
          isHidden: true,
        };
        break;
      default:
        throw new functions.https.HttpsError('invalid-argument', 'Invalid moderation action.');
    }

    patch.moderationUpdatedAt = FieldValue.serverTimestamp();
    patch.moderationConfidence = 1;

    await ref.update(patch);

    return { success: true, targetType, targetId, action };
  });
}
