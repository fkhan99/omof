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
import { getFirebaseDb, getFirebaseAuth, getFirebaseStorage, getFirebaseApp } from './config';
import { getUserProfile, reauthenticateWithPassword, logOut } from './auth';
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
    const chunk = snap.docs.slice(i, i + BATCH_SIZE);
    chunk.forEach((docSnap) => batch.delete(docSnap.ref));
    try {
      await batch.commit();
    } catch (error) {
      const firebaseError = error as { code?: string; message?: string };
      if (firebaseError.code !== 'permission-denied') {
        throw error;
      }

      // Fall back to per-document deletes so one legacy row does not block account deletion.
      for (const docSnap of chunk) {
        try {
          await deleteDoc(docSnap.ref);
        } catch (docError) {
          const docFirebaseError = docError as { code?: string; message?: string };
          if (docFirebaseError.code === 'permission-denied') {
            throw docError;
          }
          console.warn(`[compliance] skipped ${collectionName}/${docSnap.id} during account deletion`, docError);
        }
      }
    }
  }
}

async function deleteQueryEither(
  collectionName: string,
  fieldA: string,
  fieldB: string,
  userId: string,
): Promise<void> {
  await deleteQueryBatch(collectionName, fieldA, userId);
  await deleteQueryBatch(collectionName, fieldB, userId);
}

async function deleteSocialAndAccountData(userId: string): Promise<void> {
  const criticalSteps: { label: string; run: () => Promise<void> }[] = [
    {
      label: 'follows',
      run: () => deleteQueryEither('follows', 'followerId', 'followingId', userId),
    },
    {
      label: 'follow requests',
      run: () => deleteQueryEither('followRequests', 'requesterId', 'targetId', userId),
    },
    {
      label: 'notifications',
      run: () => deleteQueryEither('notifications', 'recipientId', 'actorId', userId),
    },
    {
      label: 'blocked users',
      run: () => deleteQueryEither('blockedUsers', 'blockerId', 'blockedId', userId),
    },
    {
      label: 'reports',
      run: () => deleteQueryBatch('reports', 'reporterId', userId),
    },
  ];

  const optionalSteps: { label: string; run: () => Promise<void> }[] = [
    {
      label: 'promotions',
      run: () => deleteQueryBatch('promotions', 'ownerId', userId),
    },
    {
      label: 'transactions',
      run: () => deleteQueryBatch('transactions_mock', 'userId', userId),
    },
  ];

  for (const step of criticalSteps) {
    try {
      await step.run();
    } catch (error) {
      throw formatDeletionError(error, `removing ${step.label}`);
    }
  }

  for (const step of optionalSteps) {
    try {
      await step.run();
    } catch (error) {
      console.warn(`[compliance] optional cleanup failed for ${step.label}`, error);
    }
  }
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

async function deleteAuthUserWithPassword(
  email: string,
  password: string,
): Promise<void> {
  await reauthenticateWithPassword(email, password);

  const auth = getFirebaseAuth();
  const user = auth.currentUser;
  if (!user) {
    return;
  }

  try {
    await deleteUser(user);
  } catch (error: unknown) {
    const code = (error as { code?: string }).code;
    if (code === 'auth/requires-recent-login') {
      throw new Error('Enter your password to confirm account deletion.');
    }
    throw formatDeletionError(error, 'deleting your sign-in account');
  }

  if (auth.currentUser) {
    throw new Error('Failed to delete sign-in account.');
  }
}

async function deleteAuthUserViaFunction(): Promise<boolean> {
  try {
    const { getFunctions, httpsCallable } = await import('firebase/functions');
    const functions = getFunctions(getFirebaseApp());
    const deleteMyAuthUser = httpsCallable(functions, 'deleteMyAuthUser');
    await deleteMyAuthUser({});
    return true;
  } catch (error) {
    console.warn('[compliance] admin auth delete fallback failed', error);
    return false;
  }
}

async function ensureAuthAccountRemoved(
  email: string,
  password: string,
): Promise<void> {
  try {
    await deleteAuthUserWithPassword(email, password);
    return;
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === 'Enter your password to confirm account deletion.'
    ) {
      throw error;
    }
    console.warn('[compliance] client auth delete failed, trying admin fallback', error);
  }

  const deletedViaFunction = await deleteAuthUserViaFunction();
  if (deletedViaFunction) {
    return;
  }

  throw new Error(
    'Your profile was removed but your sign-in account could not be deleted. Sign in and try deleting again, or contact support.',
  );
}

export async function deleteAccount(userId: string, password: string): Promise<void> {
  const auth = getFirebaseAuth();
  const authUid = auth.currentUser?.uid;

  if (!authUid || authUid !== userId) {
    throw new Error('You must be signed in to delete your account.');
  }

  if (!password.trim()) {
    throw new Error('Enter your password to confirm account deletion.');
  }

  const profile = await getUserProfile(userId);
  if (!profile) {
    throw new Error('Profile not found.');
  }

  console.log('[compliance] account deletion started', { userId });

  const db = getFirebaseDb();
  let shouldSignOut = false;
  let userDocDeleted = false;
  const authUserEmail = auth.currentUser?.email ?? '';
  const profileEmail =
    profile.email.trim() || authUserEmail.trim();

  if (!profileEmail) {
    throw new Error(
      'No email found for this account. Sign out, sign in again, then retry deletion.',
    );
  }

  await reauthenticateWithPassword(profileEmail, password);

  try {
    try {
      await deleteQueryBatch('promotions', 'ownerId', userId);
    } catch (error) {
      console.warn('[compliance] promotion cleanup failed before post deletion', error);
    }

    try {
      const postsSnap = await getDocs(
        query(collection(db, 'posts'), where('authorId', '==', userId)),
      );
      for (const postDoc of postsSnap.docs) {
        await deletePost(postDoc.id, userId);
      }
    } catch (error) {
      throw formatDeletionError(error, 'deleting your posts');
    }

    try {
      await deleteQueryBatch('comments', 'authorId', userId);
    } catch (error) {
      throw formatDeletionError(error, 'deleting your comments');
    }

    try {
      const reactionsSnap = await getDocs(
        query(collection(db, 'reactions'), where('userId', '==', userId)),
      );
      for (const reactionDoc of reactionsSnap.docs) {
        await deleteDoc(reactionDoc.ref);
      }
    } catch (error) {
      throw formatDeletionError(error, 'deleting your reactions');
    }

    try {
      await deleteSocialAndAccountData(userId);
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw formatDeletionError(error, 'removing social and account data');
    }

    try {
      await clearPushToken(userId);
    } catch (error) {
      console.warn('[compliance] push token clear failed during account deletion', error);
    }

    try {
      if (profile.username) {
        await deleteDoc(doc(db, 'usernames', profile.username.toLowerCase()));
      }
      await deleteDoc(doc(db, 'users', userId));
      userDocDeleted = true;
      shouldSignOut = true;
    } catch (error) {
      throw formatDeletionError(error, 'deleting your profile');
    }

    await Promise.all([
      deleteStoragePrefix(`profiles/${userId}`),
      deleteStoragePrefix(`posts/${userId}`),
    ]);

    await ensureAuthAccountRemoved(profileEmail, password);

    console.log('[compliance] account deletion completed', { userId });
  } finally {
    if (userDocDeleted && getFirebaseAuth().currentUser) {
      try {
        await ensureAuthAccountRemoved(profileEmail, password);
      } catch (error) {
        console.warn('[compliance] auth delete retry in finally failed', error);
      }
    }

    if (shouldSignOut) {
      try {
        await logOut();
      } catch (error) {
        console.warn('[compliance] sign-out after account deletion failed', error);
      }
    }
  }

  if (userDocDeleted && getFirebaseAuth().currentUser) {
    throw new Error(
      'Your profile was removed but your sign-in account could not be deleted. Sign in and try deleting again, or contact support.',
    );
  }
}

/** Remove Firebase Auth sign-in when profile is already gone (e.g. partial deletion). */
export async function deleteAuthOnly(email: string, password: string): Promise<void> {
  const auth = getFirebaseAuth();
  if (!auth.currentUser) {
    throw new Error('You must be signed in.');
  }

  await ensureAuthAccountRemoved(email, password);
  await logOut();
}
