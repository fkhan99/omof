import { Platform } from 'react-native';
import * as Crypto from 'expo-crypto';
import * as AppleAuthentication from 'expo-apple-authentication';
import {
  GoogleAuthProvider,
  OAuthProvider,
  signInWithCredential,
  signInWithPopup,
  User as FirebaseUser,
} from 'firebase/auth';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { getFirebaseAuth } from './config';
import { getFirebaseAuthErrorMessage } from '@/utils/authErrors';

export type SocialAuthProvider = 'google' | 'apple';

function readEnv(name: string): string {
  return process.env[name]?.trim() ?? '';
}

function getGoogleWebClientId(): string {
  return readEnv('EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID');
}

function assertGoogleConfigured(): void {
  if (!getGoogleWebClientId()) {
    throw new Error(
      'Google sign-in is not configured. Add EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID to .env and enable Google in Firebase Authentication.',
    );
  }
}

let googleSignInConfigured = false;

function configureNativeGoogleSignIn(): void {
  if (googleSignInConfigured || Platform.OS === 'web') return;

  assertGoogleConfigured();
  GoogleSignin.configure({
    webClientId: getGoogleWebClientId(),
    iosClientId: readEnv('EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID') || undefined,
    offlineAccess: false,
  });
  googleSignInConfigured = true;
}

async function signInWithGoogleWeb(): Promise<FirebaseUser> {
  assertGoogleConfigured();
  const auth = getFirebaseAuth();
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });

  const result = await signInWithPopup(auth, provider);
  return result.user;
}

async function signInWithGoogleNative(): Promise<FirebaseUser> {
  configureNativeGoogleSignIn();
  const auth = getFirebaseAuth();

  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const response = await GoogleSignin.signIn();

  const idToken = response.data?.idToken;
  if (!idToken) {
    throw new Error('Google sign-in did not return an ID token.');
  }

  const credential = GoogleAuthProvider.credential(idToken);
  const result = await signInWithCredential(auth, credential);
  return result.user;
}

async function signInWithAppleWeb(): Promise<FirebaseUser> {
  const auth = getFirebaseAuth();
  const provider = new OAuthProvider('apple.com');
  provider.addScope('email');
  provider.addScope('name');

  const result = await signInWithPopup(auth, provider);
  return result.user;
}

async function createAppleNonce(): Promise<{ rawNonce: string; hashedNonce: string }> {
  const rawNonce = Crypto.randomUUID();
  const hashedNonce = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    rawNonce,
  );
  return { rawNonce, hashedNonce };
}

async function signInWithAppleNative(): Promise<FirebaseUser> {
  const available = await AppleAuthentication.isAvailableAsync();
  if (!available) {
    throw new Error('Sign in with Apple is not available on this device.');
  }

  const { rawNonce, hashedNonce } = await createAppleNonce();
  const appleCredential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
    nonce: hashedNonce,
  });

  if (!appleCredential.identityToken) {
    throw new Error('Apple sign-in did not return an identity token.');
  }

  const auth = getFirebaseAuth();
  const provider = new OAuthProvider('apple.com');
  const credential = provider.credential({
    idToken: appleCredential.identityToken,
    rawNonce,
  });

  const result = await signInWithCredential(auth, credential);
  return result.user;
}

export function isGoogleSignInConfigured(): boolean {
  return Boolean(getGoogleWebClientId());
}

export function isAppleSignInAvailable(): boolean {
  if (Platform.OS === 'ios' || Platform.OS === 'web') return true;
  return false;
}

/** Password-based accounts still need inbox verification; OAuth providers do not. */
export function requiresEmailVerification(user: FirebaseUser): boolean {
  if (user.emailVerified) return false;
  return user.providerData.some((provider) => provider.providerId === 'password');
}

export async function signInWithGoogle(): Promise<FirebaseUser> {
  try {
    if (Platform.OS === 'web') {
      return await signInWithGoogleWeb();
    }
    return await signInWithGoogleNative();
  } catch (error) {
    if (isUserCancelledError(error)) {
      throw new Error('Google sign-in was cancelled.');
    }
    throw new Error(getFirebaseAuthErrorMessage(error, 'Google sign-in failed. Please try again.'));
  }
}

export async function signInWithApple(): Promise<FirebaseUser> {
  try {
    if (Platform.OS === 'web') {
      return await signInWithAppleWeb();
    }
    if (Platform.OS === 'ios') {
      return await signInWithAppleNative();
    }
    throw new Error('Sign in with Apple is only available on iOS and web.');
  } catch (error) {
    if (isUserCancelledError(error)) {
      throw new Error('Apple sign-in was cancelled.');
    }
    throw new Error(getFirebaseAuthErrorMessage(error, 'Apple sign-in failed. Please try again.'));
  }
}

function isUserCancelledError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;

  const code =
    'code' in error && typeof (error as { code?: unknown }).code === 'string'
      ? (error as { code: string }).code
      : null;

  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
    return true;
  }

  if ('message' in error && typeof (error as { message?: unknown }).message === 'string') {
    const message = (error as { message: string }).message.toLowerCase();
    if (message.includes('cancel') || message.includes('closed')) return true;
  }

  return false;
}

export async function signInWithSocialProvider(provider: SocialAuthProvider): Promise<FirebaseUser> {
  if (provider === 'google') return signInWithGoogle();
  return signInWithApple();
}
