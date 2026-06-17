import {
  collection,
  doc,
  getDocs,
  deleteDoc,
  query,
  where,
  writeBatch,
} from 'firebase/firestore';
import { deleteUser } from 'firebase/auth';
import { ref, deleteObject } from 'firebase/storage';
import { getFirebaseDb, getFirebaseAuth, getFirebaseStorage } from './config';
import { getUserProfile } from './auth';
import { deletePost } from './posts';
import { clearPushToken } from '@/utils/pushRegistration';

const BATCH_SIZE = 400;

function formatDeletionError(error: unknown, step: string): Error {
  const firebaseError = error as { code?: string; message?: string };
  if (firebaseError.code === 'permission-denied') {
    return new Error(
      `Account deletion failed while ${step}. Missing or insufficient permissions — deploy the latest Firestore rules, then try again.`,
    );
  }
  if (error instanceof Error) {
    return new Error(`Account deletion failed while ${step}: ${error.message}`);
  }
  return new Error(`Account deletion failed while ${step}.`);
}

async function deleteQueryBatch(
  collectionName: string,
  field: string,
  value: string,
): Promise<void> {
  const db = getFirebaseDb();
  const snap = await getDocs(query(collection(db, collectionName), where(field, '==', value)));

  for (let i = 0; i < snap.docs.length; i += BATCH_SIZE) {
    const batch = writeBatch(db);
    snap.docs.slice(i, i + BATCH_SIZE).forEach((docSnap) => batch.delete(docSnap.ref));
    await batch.commit();
  }
}

async function deleteQueryEither(
  collectionName: string,
  fieldA: string,
  fieldB: string,
  userId: string,
): Promise<void> {
  await Promise.all([
    deleteQueryBatch(collectionName, fieldA, userId),
    deleteQueryBatch(collectionName, fieldB, userId),
  ]);
}

async function deleteStoragePrefix(prefix: string): Promise<void> {
  // Best-effort: client SDK cannot list all files; delete known profile/posts paths via user data.
  try {
    const storage = getFirebaseStorage();
    await deleteObject(ref(storage, prefix));
  } catch {
    // Object may not exist
  }
}

export async function deleteAccount(userId: string): Promise<void> {
  const auth = getFirebaseAuth();
  const authUid = auth.currentUser?.uid;

  if (!authUid || authUid !== userId) {
    throw new Error('You must be signed in to delete your account.');
  }

  const profile = await getUserProfile(userId);
  if (!profile) {
    throw new Error('Profile not found.');
  }

  console.log('[compliance] account deletion started', { userId });

  const db = getFirebaseDb();

  // Delete owned posts (includes comments/reactions on those posts)
  const postsSnap = await getDocs(query(collection(db, 'posts'), where('authorId', '==', userId)));
  for (const postDoc of postsSnap.docs) {
    await deletePost(postDoc.id, userId);
  }

  // Delete comments authored by user on others' posts
  await deleteQueryBatch('comments', 'authorId', userId);

  // Delete reactions
  const reactionsSnap = await getDocs(query(collection(db, 'reactions'), where('userId', '==', userId)));
  for (const reactionDoc of reactionsSnap.docs) {
    await deleteDoc(reactionDoc.ref);
  }

  // Social graph + safety + monetization + promotions
  await Promise.all([
    deleteQueryEither('follows', 'followerId', 'followingId', userId),
    deleteQueryEither('followRequests', 'requesterId', 'targetId', userId),
    deleteQueryEither('notifications', 'recipientId', 'actorId', userId),
    deleteQueryEither('blockedUsers', 'blockerId', 'blockedId', userId),
    deleteQueryBatch('reports', 'reporterId', userId),
    deleteQueryBatch('prootions', 'ownerId', userId),
    deleteQueryBatch('transactions_mock', 'userId', userId),
  ]);

  await clearPushToken(userId).catch((error) => {
    console.warn('[compliance] push token clear failed during account deletion', error);
  });

  // Username reservation
  if (profile.username) {
    await deleteDoc(doc(db, 'usernames', profile.username.toLowerCase()));
  }

  // User profile
  await deleteDoc(doc(db, 'users', userId));

  // Best-effort storage cleanup
  await Promise.all([
    deleteStoragePrefix(`profiles/${userId}`),
    deleteStoragePrefix(`posts/${userId}`),
  ]);

  // Firebase Auth account (must be last while user is signed in)
  if (auth.currentUser) {
    try {
      await deleteUser(auth.currentUser);
    } catch (error: unknown) {
      const code = (error as { code?: string }).code;
      if (code === 'auth/requires-recent-login') {
        throw new Error('For security, sign out, sign in again, then retry account deletion.');
      }
      throw error;
    }
  }

  console.log('[compliance] account deletion completed', { userId });
}
