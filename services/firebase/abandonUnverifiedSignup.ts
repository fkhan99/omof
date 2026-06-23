import { deleteUser } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { getFirebaseAuth, getFirebaseDb, isFirebaseConfigured } from './config';
import { logOut } from './auth';
import { deleteCurrentAuthUserViaFunction } from './deleteAuthUserCallable';
import { getAuthErrorCode, getFirebaseAuthErrorMessage } from '@/utils/authErrors';

async function userHasProfile(uid: string): Promise<boolean> {
  const snap = await getDoc(doc(getFirebaseDb(), 'users', uid));
  return snap.exists();
}

/**
 * Deletes an abandoned email/password signup that never verified and has no
 * Firestore profile (verify-email → "Use a different email").
 */
export async function abandonUnverifiedSignup(): Promise<void> {
  if (!isFirebaseConfigured()) {
    throw new Error('Firebase is not configured.');
  }

  const auth = getFirebaseAuth();
  const user = auth.currentUser;
  if (!user) {
    throw new Error('You must be signed in to switch emails. Try signing out and back in.');
  }

  if (await userHasProfile(user.uid)) {
    throw new Error(
      'This account already has a profile. Sign in to manage it from Settings instead.',
    );
  }

  try {
    await deleteCurrentAuthUserViaFunction();
  } catch (functionError) {
    try {
      await deleteUser(user);
    } catch (clientError) {
      throw new Error(
        getFirebaseAuthErrorMessage(
          getAuthErrorCode(clientError) === 'auth/requires-recent-login'
            ? functionError
            : clientError,
          'Could not remove this unverified account. Please try again.',
        ),
      );
    }
  }

  if (auth.currentUser) {
    throw new Error('Could not remove this account. Please try again.');
  }

  try {
    await logOut();
  } catch {
    // Session may already be cleared after deleteUser.
  }
}
