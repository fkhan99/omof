import { FirebaseError } from 'firebase/app';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  sendEmailVerification,
  reload,
  onAuthStateChanged,
  EmailAuthProvider,
  reauthenticateWithCredential,
  fetchSignInMethodsForEmail,
  User as FirebaseUser,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  getDocFromServer,
  serverTimestamp,
  runTransaction,
  onSnapshot,
} from 'firebase/firestore';
import {
  getFirebaseAuth,
  getFirebaseDb,
  getFirebaseApp,
  isFirebaseConfigured,
  FirebaseNotConfiguredError,
} from './config';
import { mapUserDoc, getDefaultUserFields } from './mappers';
import { PRIVACY_POLICY_VERSION, TERMS_VERSION } from '@/constants/legal';
import { DEFAULT_USER_STATS } from '@/constants/gamification';
import { User } from '@/types';
import { normalizeEmail } from '@/utils';
import { getFirebaseAuthErrorMessage, getAuthErrorCode } from '@/utils/authErrors';
import { VERIFICATION_TOO_MANY_REQUESTS_MESSAGE } from '@/constants/emailVerification';
import { getEmailVerificationActionSettings } from '@/utils/firebaseEmailActions';
import {
  assertVerificationResendAllowed,
  markVerificationEmailSent,
} from '@/utils/verificationEmailSendState';
import { scheduleWelcome } from '@/utils/welcomeState';
import { useAuthStore } from '@/store/authStore';
import { requiresEmailVerification } from '@/services/firebase/socialAuth';
import { updateFcmToken } from './pushToken';

async function deliverVerificationEmail(user: FirebaseUser): Promise<void> {
  try {
    await sendEmailVerification(user, getEmailVerificationActionSettings());
  } catch (error) {
    const code = getAuthErrorCode(error);
    if (
      code === 'auth/unauthorized-continue-uri' ||
      code === 'auth/invalid-continue-uri' ||
      code === 'auth/missing-continue-uri'
    ) {
      await sendEmailVerification(user);
      return;
    }
    throw error;
  }
}

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
    const user = credential.user;

    // Single client-side verification send — only here, right after account creation.
    if (requiresEmailVerification(user)) {
      try {
        await deliverVerificationEmail(user);
        await markVerificationEmailSent(user.uid);
      } catch (error) {
        throw new Error(
          getFirebaseAuthErrorMessage(
            error,
            'Account created but the verification email could not be sent. Try resending from the next screen.',
          ),
        );
      }
    }

    return user;
  } catch (error) {
    if (error instanceof Error && error.message.includes('verification email')) {
      throw error;
    }
    throw new Error(
      getFirebaseAuthErrorMessage(error, 'Failed to create account. Please try again.'),
    );
  }
}

/**
 * Manual resend from the verify-email screen only. Uses Cloud Functions SMTP —
 * does not call sendEmailVerification() (reserved for the one-time signup send).
 */
export async function resendVerificationEmail(): Promise<void> {
  assertFirebaseConfigured();
  const auth = getFirebaseAuth();
  const user = auth.currentUser;

  if (!user) {
    throw new Error('You must be signed in to verify your email.');
  }

  await assertVerificationResendAllowed(user.uid);

  try {
    const { getFunctions, httpsCallable } = await import('firebase/functions');
    const functions = getFunctions(getFirebaseApp());
    const requestVerificationEmail = httpsCallable(functions, 'requestVerificationEmail');
    await requestVerificationEmail();
    await markVerificationEmailSent(user.uid);
  } catch (error) {
    const code =
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      typeof (error as { code?: unknown }).code === 'string'
        ? (error as { code: string }).code
        : null;

    if (code === 'functions/resource-exhausted') {
      throw new Error(VERIFICATION_TOO_MANY_REQUESTS_MESSAGE);
    }

    if (code === 'functions/failed-precondition') {
      throw new Error(
        'Verification email is not configured on the server yet. Please try again later or contact support.',
      );
    }

    const authCode = getAuthErrorCode(error);
    if (authCode === 'auth/too-many-requests') {
      throw new Error(VERIFICATION_TOO_MANY_REQUESTS_MESSAGE);
    }

    throw new Error(
      getFirebaseAuthErrorMessage(error, 'Failed to resend verification email. Please try again.'),
    );
  }
}

/**
 * Refreshes the current user from the server (so `emailVerified` reflects a
 * link that was just clicked) and returns the up-to-date user.
 */
export async function reloadCurrentUser(): Promise<FirebaseUser | null> {
  if (!isFirebaseConfigured()) return null;
  const auth = getFirebaseAuth();
  const user = auth.currentUser;
  if (!user) return null;

  await reload(user);
  // Force-refresh the ID token so Firestore sees the latest auth claims
  // (e.g. email_verified after inbox link or admin verify script).
  if (auth.currentUser) {
    try {
      await auth.currentUser.getIdToken(true);
    } catch {
      // Non-fatal: token will refresh on its own shortly.
    }
  }
  return auth.currentUser;
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

/**
 * Returns true if a Firebase Auth account exists for this email.
 * Returns null when it cannot be determined (e.g. email enumeration
 * protection is enabled), so callers can fall back gracefully.
 */
export async function accountExistsForEmail(email: string): Promise<boolean | null> {
  assertFirebaseConfigured();
  const auth = getFirebaseAuth();

  try {
    const methods = await fetchSignInMethodsForEmail(auth, normalizeEmail(email));
    return methods.length > 0;
  } catch (error) {
    console.warn('[Auth] accountExistsForEmail failed', error);
    return null;
  }
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

/** Read a profile immediately after create — web cache can lag behind the write. */
async function loadCreatedUserProfile(userId: string): Promise<User | null> {
  const db = getFirebaseDb();
  const userRef = doc(db, 'users', userId);
  const retryDelaysMs = [0, 200, 500, 1000];

  for (const delay of retryDelaysMs) {
    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    try {
      const snap = await getDocFromServer(userRef);
      if (snap.exists()) {
        return mapUserDoc(snap.id, snap.data()!);
      }
    } catch (error) {
      console.warn('[Auth] loadCreatedUserProfile server read failed', error);
    }
  }

  return getUserProfile(userId);
}

function buildUserProfileFromCreate(
  userId: string,
  resolvedEmail: string,
  data: {
    username: string;
    displayName: string;
    bio?: string;
    photoURL?: string | null;
  },
  hasCompliance: boolean,
): User {
  const now = new Date();
  return {
    id: userId,
    email: resolvedEmail,
    username: data.username,
    displayName: data.displayName,
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
    plan: 'free',
    promotionCredits: 0,
    stats: { ...DEFAULT_USER_STATS },
    badges: [],
    createdAt: now,
    updatedAt: now,
  };
}

function getFirestoreWriteErrorMessage(error: unknown): string {
  if (error instanceof FirebaseError) {
    if (error.code === 'permission-denied') {
      return 'Could not save your profile. Sign out, sign back in, then try again.';
    }
    if (error.code === 'unavailable') {
      return 'Network error while saving your profile. Check your connection and try again.';
    }
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return 'Failed to create user profile';
}

/** Live profile updates (stats, badges, counts) while signed in. */
export function subscribeToUserProfile(
  userId: string,
  callback: (user: User | null) => void,
): () => void {
  if (!isFirebaseConfigured()) {
    callback(null);
    return () => {};
  }

  const db = getFirebaseDb();
  return onSnapshot(
    doc(db, 'users', userId),
    (snap) => {
      if (!snap.exists()) {
        callback(null);
        return;
      }
      callback(mapUserDoc(snap.id, snap.data()));
    },
    (error) => {
      console.warn('[Auth] profile subscription error', error);
    },
  );
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

  const sessionUser = await reloadCurrentUser();
  if (!sessionUser || sessionUser.uid !== userId) {
    throw new Error('Your sign-in session expired. Please sign in again.');
  }

  const existingSnap = await getDoc(doc(db, 'users', userId));
  if (existingSnap.exists()) {
    console.log('[Auth] createUserProfile skipped — users/{uid} already exists', { uid: userId });
    return mapUserDoc(existingSnap.id, existingSnap.data()!);
  }

  const usernameLower = data.username.toLowerCase();
  const now = serverTimestamp();
  const hasCompliance = data.compliance?.acceptedTerms && data.compliance?.confirmedAge;
  const resolvedEmail =
    email ||
    sessionUser.email ||
    sessionUser.providerData?.[0]?.email ||
    '';

  try {
    await runTransaction(db, async (transaction) => {
      const usernameRef = doc(db, 'usernames', usernameLower);
      const usernameSnap = await transaction.get(usernameRef);
      if (usernameSnap.exists()) {
        throw new Error('Username is already taken');
      }

      const userRef = doc(db, 'users', userId);
      transaction.set(usernameRef, { userId });
      transaction.set(userRef, {
        email: resolvedEmail,
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
  } catch (error) {
    throw new Error(getFirestoreWriteErrorMessage(error));
  }

  useAuthStore.getState().setPendingWelcome(true);
  void scheduleWelcome(userId);

  const user = await loadCreatedUserProfile(userId);
  if (user) return user;

  console.warn('[Auth] createUserProfile using local payload after successful write', {
    uid: userId,
  });
  return buildUserProfileFromCreate(userId, resolvedEmail, data, hasCompliance);
}

export async function isUsernameAvailable(username: string): Promise<boolean> {
  assertFirebaseConfigured();
  const db = getFirebaseDb();
  const snap = await getDoc(doc(db, 'usernames', username.toLowerCase()));
  return !snap.exists();
}

export { updateFcmToken } from './pushToken';
