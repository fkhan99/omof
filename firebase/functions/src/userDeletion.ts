import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';

const BATCH_SIZE = 400;

function getDb() {
  return admin.firestore();
}

async function deleteDocsByQuery(query: admin.firestore.Query): Promise<number> {
  const snap = await query.get();
  const docs = snap.docs;

  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const batch = getDb().batch();
    docs.slice(i, i + BATCH_SIZE).forEach((docSnap) => batch.delete(docSnap.ref));
    await batch.commit();
  }

  return docs.length;
}

async function deleteQueryByField(collectionName: string, field: string, value: string): Promise<number> {
  return deleteDocsByQuery(getDb().collection(collectionName).where(field, '==', value));
}

async function deleteQueryByEitherField(
  collectionName: string,
  fieldA: string,
  fieldB: string,
  userId: string,
): Promise<number> {
  const [countA, countB] = await Promise.all([
    deleteQueryByField(collectionName, fieldA, userId),
    deleteQueryByField(collectionName, fieldB, userId),
  ]);
  return countA + countB;
}

function parseStorageDownloadUrl(url: string): { bucket: string; path: string } | null {
  if (typeof url !== 'string' || !url.includes('/o/')) return null;
  try {
    const bucketMatch = url.match(/\/b\/([^/]+)\/o\//);
    const afterO = url.split('/o/')[1];
    if (!bucketMatch || !afterO) return null;
    const path = decodeURIComponent(afterO.split('?')[0]);
    return { bucket: bucketMatch[1], path };
  } catch {
    return null;
  }
}

async function deleteStorageFileFromUrl(url: string | null | undefined): Promise<void> {
  if (!url) return;
  const parsed = parseStorageDownloadUrl(url);
  if (!parsed) return;

  try {
    await admin.storage().bucket(parsed.bucket).file(parsed.path).delete();
  } catch {
    // Object may not exist — non-fatal.
  }
}

async function deleteStoragePrefix(prefix: string): Promise<number> {
  const bucket = admin.storage().bucket();
  const [files] = await bucket.getFiles({ prefix });
  await Promise.all(
    files.map((file) => file.delete().catch(() => undefined)),
  );
  return files.length;
}

async function deletePostTree(
  postId: string,
  postData?: admin.firestore.DocumentData,
): Promise<void> {
  const data =
    postData ?? (await getDb().collection('posts').doc(postId).get()).data();

  await Promise.all([
    deleteDocsByQuery(getDb().collection('comments').where('postId', '==', postId)),
    deleteDocsByQuery(getDb().collection('reactions').where('postId', '==', postId)),
  ]);

  if (data) {
    await Promise.all([
      deleteStorageFileFromUrl(data.imageURL as string | undefined),
      deleteStorageFileFromUrl(data.videoURL as string | undefined),
    ]);
  }

  await getDb().collection('posts').doc(postId).delete().catch(() => undefined);
}

export interface PurgeUserDataSummary {
  userId: string;
  postsDeleted: number;
  commentsDeleted: number;
  reactionsDeleted: number;
  followsDeleted: number;
  followRequestsDeleted: number;
  notificationsDeleted: number;
  blockedUsersDeleted: number;
  reportsDeleted: number;
  promotionsDeleted: number;
  storageFilesDeleted: number;
  userDocDeleted: boolean;
  usernameDocDeleted: boolean;
}

/**
 * Remove all OMOF data for a user. Safe to run more than once (idempotent).
 * Called when Firebase Auth deletes a user and by the admin purge script.
 */
export async function purgeAllUserData(userId: string): Promise<PurgeUserDataSummary> {
  const summary: PurgeUserDataSummary = {
    userId,
    postsDeleted: 0,
    commentsDeleted: 0,
    reactionsDeleted: 0,
    followsDeleted: 0,
    followRequestsDeleted: 0,
    notificationsDeleted: 0,
    blockedUsersDeleted: 0,
    reportsDeleted: 0,
    promotionsDeleted: 0,
    storageFilesDeleted: 0,
    userDocDeleted: false,
    usernameDocDeleted: false,
  };

  const userSnap = await getDb().collection('users').doc(userId).get();
  const userData = userSnap.data();
  const usernameLower =
    (userData?.usernameLower as string | undefined)
    ?? (typeof userData?.username === 'string' ? userData.username.toLowerCase() : null);

  const postsSnap = await getDb().collection('posts').where('authorId', '==', userId).get();
  for (const postDoc of postsSnap.docs) {
    await deletePostTree(postDoc.id, postDoc.data());
  }
  summary.postsDeleted = postsSnap.size;

  summary.commentsDeleted = await deleteQueryByField('comments', 'authorId', userId);
  summary.reactionsDeleted = await deleteQueryByField('reactions', 'userId', userId);
  summary.followsDeleted = await deleteQueryByEitherField('follows', 'followerId', 'followingId', userId);
  summary.followRequestsDeleted = await deleteQueryByEitherField(
    'followRequests',
    'requesterId',
    'targetId',
    userId,
  );
  summary.notificationsDeleted = await deleteQueryByEitherField(
    'notifications',
    'recipientId',
    'actorId',
    userId,
  );
  summary.blockedUsersDeleted = await deleteQueryByEitherField(
    'blockedUsers',
    'blockerId',
    'blockedId',
    userId,
  );
  summary.reportsDeleted = await deleteQueryByField('reports', 'reporterId', userId);

  try {
    summary.promotionsDeleted = await deleteQueryByField('promotions', 'ownerId', userId);
  } catch (error) {
    functions.logger.warn('[userDeletion] promotion cleanup failed', { userId, error });
  }

  const [profileFiles, postFiles] = await Promise.all([
    deleteStoragePrefix(`profiles/${userId}/`),
    deleteStoragePrefix(`posts/${userId}/`),
  ]);
  summary.storageFilesDeleted = profileFiles + postFiles;

  if (usernameLower) {
    try {
      await getDb().collection('usernames').doc(usernameLower).delete();
      summary.usernameDocDeleted = true;
    } catch (error) {
      functions.logger.warn('[userDeletion] username doc delete failed', { userId, usernameLower, error });
    }
  }

  try {
    await getDb().collection('users').doc(userId).delete();
    summary.userDocDeleted = true;
  } catch (error) {
    functions.logger.warn('[userDeletion] user doc delete failed', { userId, error });
  }

  functions.logger.info('[userDeletion] purge complete', summary);
  return summary;
}

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

export function createOnAuthUserDeleted() {
  return functions.auth.user().onDelete(async (user) => {
    functions.logger.info('[userDeletion] auth user deleted — purging data', { uid: user.uid });
    await purgeAllUserData(user.uid);
  });
}

export function createAdminPurgeUserDataCallable() {
  return functions.https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'You must be signed in.');
    }

    const adminUids = getAdminUids();
    if (adminUids.size === 0) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'No admin UIDs configured. Set omof.admin_uids in functions config.',
      );
    }

    if (!adminUids.has(context.auth.uid)) {
      throw new functions.https.HttpsError('permission-denied', 'Admin access required.');
    }

    const userId = typeof data?.userId === 'string' ? data.userId.trim() : '';
    if (!userId) {
      throw new functions.https.HttpsError('invalid-argument', 'userId is required.');
    }

    const summary = await purgeAllUserData(userId);
    return { success: true, summary };
  });
}
