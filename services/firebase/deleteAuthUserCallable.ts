import { getFunctions, httpsCallable } from 'firebase/functions';
import { getFirebaseApp, getFirebaseAuth, isFirebaseConfigured } from './config';

/**
 * Deletes the signed-in Firebase Auth user via Cloud Function (admin SDK).
 * Used when client-side deleteUser fails or on web where callable is more reliable.
 */
export async function deleteCurrentAuthUserViaFunction(): Promise<void> {
  if (!isFirebaseConfigured()) {
    throw new Error('Firebase is not configured.');
  }

  if (!getFirebaseAuth().currentUser) {
    throw new Error('You must be signed in to delete your account.');
  }

  const functions = getFunctions(getFirebaseApp());
  const deleteMyAuthUser = httpsCallable(functions, 'deleteMyAuthUser');
  await deleteMyAuthUser({});
}
