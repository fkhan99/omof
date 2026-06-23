import { GoogleAuthProvider, signInWithCredential, User as FirebaseUser } from 'firebase/auth';
import { getFirebaseAuth, isFirebaseConfigured } from './config';
import { getFirebaseAuthErrorMessage } from '@/utils/authErrors';
import {
  readGoogleWebClientId,
  requiresEmailVerification,
  SocialAuthProvider,
} from './socialAuth.shared';

export { requiresEmailVerification, readGoogleWebClientId };
export type { SocialAuthProvider };

export function isGoogleSignInConfigured(): boolean {
  return Boolean(readGoogleWebClientId()) && isFirebaseConfigured();
}

export function isAppleSignInAvailable(): boolean {
  return false;
}

export async function signInWithGoogleIdToken(idToken: string): Promise<FirebaseUser> {
  try {
    const auth = getFirebaseAuth();
    const credential = GoogleAuthProvider.credential(idToken);
    const result = await signInWithCredential(auth, credential);
    return result.user;
  } catch (error) {
    throw new Error(getFirebaseAuthErrorMessage(error, 'Google sign-in failed. Please try again.'));
  }
}

export async function signInWithGoogle(): Promise<FirebaseUser> {
  throw new Error('Use the Google sign-in button on web.');
}

export async function signInWithApple(): Promise<FirebaseUser> {
  throw new Error('Sign in with Apple is only available in the iOS app.');
}

export async function signInWithSocialProvider(_provider: SocialAuthProvider): Promise<FirebaseUser> {
  throw new Error('Use the Google sign-in button on web.');
}
