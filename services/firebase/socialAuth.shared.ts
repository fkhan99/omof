import { User as FirebaseUser } from 'firebase/auth';
import { isEmailVerificationRequired } from '@/constants/emailVerification';

/** Password-based accounts still need inbox verification; OAuth providers do not. */
export function requiresEmailVerification(user: FirebaseUser): boolean {
  if (!isEmailVerificationRequired()) return false;
  if (user.emailVerified) return false;
  return user.providerData.some((provider) => provider.providerId === 'password');
}

export type SocialAuthProvider = 'google' | 'apple';

export function readGoogleWebClientId(): string {
  return process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim() ?? '';
}
