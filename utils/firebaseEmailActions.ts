import { Platform } from 'react-native';
import type { ActionCodeSettings } from 'firebase/auth';
import { applyActionCode } from 'firebase/auth';
import { getFirebaseAuth, isFirebaseConfigured } from '@/services/firebase/config';
import { reloadCurrentUser } from '@/services/firebase/auth';

const HOSTED_VERIFY_URL = 'https://omof-eed24.web.app/verify-email';

export function getEmailVerificationContinueUrl(): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location.origin) {
    return `${window.location.origin}/verify-email`;
  }
  return HOSTED_VERIFY_URL;
}

export function getEmailVerificationActionSettings(): ActionCodeSettings {
  const url = getEmailVerificationContinueUrl();
  return {
    url,
    // Use Firebase's hosted verification page in the email link — best deliverability.
    // The app still handles oobCode if the user lands on /verify-email directly.
    handleCodeInApp: false,
  };
}

/**
 * Completes email verification when the user opens the link from their inbox.
 * Returns the refreshed user when verification succeeded.
 */
export async function completeEmailVerificationFromLink(
  search: string,
): Promise<Awaited<ReturnType<typeof reloadCurrentUser>>> {
  if (!isFirebaseConfigured()) return null;

  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const mode = params.get('mode');
  const oobCode = params.get('oobCode');
  if (mode !== 'verifyEmail' || !oobCode) return null;

  const auth = getFirebaseAuth();
  await applyActionCode(auth, oobCode);
  return reloadCurrentUser();
}

export function stripEmailActionQueryFromUrl(): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  const path = window.location.pathname.replace(/\/$/, '') || '/verify-email';
  window.history.replaceState({}, '', path.endsWith('verify-email') ? path : '/verify-email');
}
