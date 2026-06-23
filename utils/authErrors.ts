import { FirebaseError } from 'firebase/app';

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  'auth/email-already-in-use':
    'An account with this email already exists. Please sign in instead.',
  'auth/invalid-email': 'Please enter a valid email address.',
  'auth/user-disabled': 'This account has been disabled. Please contact support.',
  'auth/user-not-found': 'No account found with this email. Please sign up first.',
  'auth/wrong-password': 'Incorrect email or password.',
  'auth/invalid-credential': 'Incorrect email or password.',
  'auth/too-many-requests': 'Too many attempts. Please wait a moment and try again.',
  'auth/weak-password': 'Password must be at least 6 characters.',
  'auth/invalid-action-code':
    'That verification link is invalid or already used. Resend a new verification email.',
  'auth/expired-action-code':
    'That verification link has expired. Resend a new verification email.',
  'auth/unauthorized-continue-uri':
    'Could not send verification email for this site URL. Try again or contact support.',
  'auth/invalid-continue-uri':
    'Could not send verification email for this site URL. Try again or contact support.',
  'auth/missing-continue-uri':
    'Could not send verification email. Try again or contact support.',
  'auth/account-exists-with-different-credential':
    'An account already exists with this email using a different sign-in method. Try that method instead.',
  'auth/popup-closed-by-user': 'Sign-in was cancelled.',
  'auth/cancelled-popup-request': 'Sign-in was cancelled.',
  'auth/popup-blocked': 'Sign-in popup was blocked. Allow popups for this site and try again.',
  'auth/argument-error':
    'This sign-in method is not set up yet. Try Google or email/password instead.',
  'auth/operation-not-allowed': 'This sign-in method is not enabled. Contact support.',
  'auth/requires-recent-login':
    'For security, verify your password and try again.',
};

export const NO_PROFILE_ACCOUNT_MESSAGE =
  'No account is associated with this email. Sign up to create a new one.';

export const NO_ACCOUNT_SIGNUP_PROMPT =
  'No account was found for this email. Create one below to get started.';

function getErrorCode(error: unknown): string | null {
  if (error instanceof FirebaseError) {
    return error.code;
  }
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === 'string' ? code : null;
  }
  return null;
}

export function getFirebaseAuthErrorMessage(error: unknown, fallback: string): string {
  const code = getErrorCode(error);
  if (code && AUTH_ERROR_MESSAGES[code]) {
    return AUTH_ERROR_MESSAGES[code];
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}

export function getAuthErrorCode(error: unknown): string | null {
  return getErrorCode(error);
}
