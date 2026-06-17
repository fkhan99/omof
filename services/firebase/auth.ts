import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  onAuthStateChanged,
  EmailAuthProvider,
  reauthenticateWithCredential,
  User as FirebaseUser,
} from 'firebase/auth';
import {
  doc,
  setDoc,
  getDoc,
  serverTimestamp,
  runTransaction,
} from 'firebase/firestore';
import {
  getFirebaseAuth,
  getFirebaseDb,
  isFirebaseConfigured,
  FirebaseNotConfiguredError,
} from './config';
import { mapUserDoc, getDefaultUserFields } from './mappers';
import { PRIVACY_POLICY_VERSION, TERMS_VERSION } from '@/constants/legal';
import { User } from '@/types';
import { normalizeEmail } from '@/utils';
import { getFirebaseAuthErrorMessage } from '@/utils/authErrors';
import { updateFcmToken } from './pushToken';

function assertFirebaseConfigured(): void {
  if (!isFirebaseConfigured()) {
    throw new FirebaseNotConfiguredError(
      'Firebase is not configured. Add your .env keys and restart Expo with: npx expo start -c',
    );
  }
}

export function subscribeToAuthState(
  callback: (user: FirebaseUser | null) => void,
): () => void {
  if (!isFirebaseConfigured()) {
    callback(null);
    return () => {};
  }

  const auth = getFirebaseAuth();
  return onAuthStateChanged(auth, callback);
}

export async function signUp(email: string, password: string): Promise<FirebaseUser> {
  assertFirebaseConfigured();
  const auth = getFirebaseAuth();
  const normalizedEmail = normalizeEmail(email);

  try {
    const credential = await createUserWithEmailAndPassword(auth, normalizedEmail, password);
    return credential.user;
  } catch (error) {
    throw new Error(
      getFirebaseAuthErrorMessage(error, 'Failed to create account. Please try again.'),
    );
  }
}

export async function signIn(email: string, password: string): Promise<FirebaseUser> {
  assertFirebaseConfigured();
  const auth = getFirebaseAuth();
  const normalizedEmail = normalizeEmail(email);

  try {
    const credential = await signInWithEmailAndPassword(auth, normalizedEmail, password);
    return credential.user;
  } catch (error) {
    throw new Error(getFirebaseAuthErrorMessage(error, 'Failed to sign in. Please try again.'));
  }
}

export async function logOut(): Promise<void> {
  if (!isFirebaseConfigured()) return;
  const auth = getFirebaseAuth();
  const uid = auth.currentUser?.uid;

  if (uid) {
    try {
      await updateFcmToken(uid, null);
    } catch (error) {
      console.warn('[push] failed to clear token on logout', error);
    }
  }

  await signOut(auth);
}

export async function resetPassword(email: string): Promise<void> {
  assertFirebaseConfigured();
  const auth = getFirebaseAuth();
  const normalizedEmail = normalizeEmail(email);

  try {
    await sendPasswordResetEmail(auth, normalizedEmail);
  } catch (error) {
    throw new Error(
      getFirebaseAuthErrorMessage(error, 'Failed to send reset email. Please try again.'),
    );
  }
}

/** Required before sensitive actions such as account deletion. */
export async function reauthenticateWithPassword(
  email: string,
  password: string,
): Promise<void> {
  assertFirebaseConfigured();
  const auth = getFirebaseAuth();
  const user = auth.currentUser;

  if (!user) {
    throw new Error('You must be signed in.');
  }

  const resolvedEmail =
    normalizeEmail(email) || (user.email ? normalizeEmail(user.email) : '');

  if (!resolvedEmail) {
    throw new Error(
      'No email found for this account. Sign out, sign in again, then retry deletion.',
    );
  }

  const credential = EmailAuthProvider.credential(resolvedEmail, password);

  try {
    await reauthenticateWithCredential(user, credential);
  } catch (error) {
    throw new Error(
      getFirebaseAuthErrorMessage(error, 'Password verification failed. Please try again.'),
    );
  }
}

export async function getUserProfile(userId: string): Promise<User | null> {
  assertFirebaseConfigured();
  const db = getFirebaseDb();
  const snap = await getDoc(doc(db, 'users', userId));
  const exists = snap.exists();

  console.log('[Auth] getUserProfile users/{uid} exists:', exists, { uid: userId });

  if (!exists) return null;
  return mapUserDoc(snap.id, snap.data());
}

/**
 * Load profile for the signed-in user. Uses auth uid → users/{uid}.
 * Never creates a document — read only.
 */
export async function loadAuthUserProfile(uid: string): Promise<User | null> {
  console.log('[Auth] loadAuthUserProfile — auth.currentUser.uid:', uid);
  return getUserProfile(uid);
}

export async function createUserProfile(
  userId: string,
  email: string,
  data: {
    username: string;
    displayName: string;
    bio?: string;
    photoURL?: string | null;
    compliance?: { acceptedTerms: boolean; confirmedAge: boolean };
  },
): Promise<User> {
  assertFirebaseConfigured();
  const db = getFirebaseDb();

  const existingSnap = await getDoc(doc(db, 'users', userId));
  if (existingSnap.exists()) {
    console.log('[Auth] createUserProfile skipped — users/{uid} already exists', { uid: userId });
    return mapUserDoc(existingSnap.id, existingSnap.data()!);
  }

  const usernameLower = data.username.toLowerCase();
  const now = serverTimestamp();
  const hasCompliance = data.compliance?.acceptedTerms && data.compliance?.confirmedAge;

  await runTransaction(db, async (transaction) => {
    const usernameRef = doc(db, 'usernames', usernameLower);
    const usernameSnap = await transaction.get(usernameRef);
    if (usernameSnap.exists()) {
      throw new Error('Username is already taken');
    }

    const userRef = doc(db, 'users', userId);
    transaction.set(usernameRef, { userId });
    transaction.set(userRef, {
      email,
      username: data.username,
      usernameLower,
      displayName: data.displayName,
      displayNameLower: data.displayName.toLowerCase(),
      bio: data.bio ?? '',
      photoURL: data.photoURL ?? null,
      followerCount: 0,
      followingCount: 0,
      fcmToken: null,
      isPrivate: false,
      onboardingComplete: true,
      termsAcceptedAt: hasCompliance ? now : null,
      privacyPolicyVersion: hasCompliance ? PRIVACY_POLICY_VERSION : null,
      termsVersion: hasCompliance ? TERMS_VERSION : null,
      ageConfirmedAt: hasCompliance ? now : null,
      ...getDefaultUserFields(),
      createdAt: now,
      updatedAt: now,
    });
  });

  const user = await getUserProfile(userId);
  if (!user) throw new Error('Failed to create user profile');
  return user;
}

export async function isUsernameAvailable(username: string): Promise<boolean> {
  assertFirebaseConfigured();
  const db = getFirebaseDb();
  const snap = await getDoc(doc(db, 'usernames', username.toLowerCase()));
  return !snap.exists();
}

export { updateFcmToken } from './pushToken';
