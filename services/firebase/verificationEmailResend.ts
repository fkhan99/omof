import { getFunctions, httpsCallable } from 'firebase/functions';
import { VERIFICATION_TOO_MANY_REQUESTS_MESSAGE } from '@/constants/emailVerification';
import { getFirebaseAuthErrorMessage, getAuthErrorCode } from '@/utils/authErrors';
import {
  assertVerificationResendAllowed,
  markVerificationEmailSent,
} from '@/utils/verificationEmailSendState';
import { getFirebaseApp, getFirebaseAuth, isFirebaseConfigured } from './config';

/**
 * Manual resend from the verify-email screen only. Uses Cloud Functions SMTP —
 * does not call sendEmailVerification() (reserved for the one-time signup send).
 */
export async function resendVerificationEmail(): Promise<void> {
  if (!isFirebaseConfigured()) {
    throw new Error('Firebase is not configured.');
  }

  const auth = getFirebaseAuth();
  const user = auth.currentUser;

  if (!user) {
    throw new Error('You must be signed in to verify your email.');
  }

  await assertVerificationResendAllowed(user.uid);

  try {
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
