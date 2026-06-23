import { Platform } from 'react-native';
import type { ActionCodeSettings } from 'firebase/auth';
import { applyActionCode, checkActionCode } from 'firebase/auth';
import type { Router } from 'expo-router';
import { getFirebaseAuth, isFirebaseConfigured } from '@/services/firebase/config';
import { loadAuthUserProfile, reloadCurrentUser } from '@/services/firebase/auth';
import { normalizeEmail } from '@/utils';

const HOSTED_ONBOARDING_URL = 'https://omof-eed24.web.app/onboarding';

export function getEmailVerificationContinueUrl(): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location.origin) {
    return `${window.location.origin}/onboarding`;
  }
  return HOSTED_ONBOARDING_URL;
}

export function getEmailVerificationActionSettings(): ActionCodeSettings {
  return {
    url: getEmailVerificationContinueUrl(),
    handleCodeInApp: true,
  };
}

export interface EmailVerificationResult {
  verified: boolean;
  email: string | null;
  user: Awaited<ReturnType<typeof reloadCurrentUser>>;
}

function parseEmailActionSearch(search: string): { mode: string | null; oobCode: string | null } {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  return {
    mode: params.get('mode'),
    oobCode: params.get('oobCode'),
  };
}

export function isEmailVerificationLink(search: string): boolean {
  const { mode, oobCode } = parseEmailActionSearch(search);
  return mode === 'verifyEmail' && Boolean(oobCode);
}

/**
 * Completes email verification when the user opens the link from their inbox.
 */
export async function completeEmailVerificationFromLink(
  search: string,
): Promise<EmailVerificationResult | null> {
  if (!isFirebaseConfigured()) return null;

  const { mode, oobCode } = parseEmailActionSearch(search);
  if (mode !== 'verifyEmail' || !oobCode) return null;

  const auth = getFirebaseAuth();
  const info = await checkActionCode(auth, oobCode);
  const email = info.data.email ? normalizeEmail(info.data.email) : null;

  await applyActionCode(auth, oobCode);
  const user = await reloadCurrentUser();

  return {
    verified: true,
    email,
    user,
  };
}

export function stripEmailActionQueryFromUrl(path = '/onboarding'): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  const normalized =
    window.location.pathname.replace(/\/$/, '') ||
    path.replace(/\/$/, '') ||
    '/onboarding';
  window.history.replaceState({}, '', normalized);
}

/** Route to profile setup after the inbox link verifies an email address. */
export async function navigateAfterEmailVerification(
  router: Router,
  result: EmailVerificationResult,
  setFirebaseUser: (user: NonNullable<EmailVerificationResult['user']>) => void,
): Promise<void> {
  if (result.user?.emailVerified) {
    setFirebaseUser(result.user);
    const profile = await loadAuthUserProfile(result.user.uid);
    router.replace(profile ? '/(tabs)' : '/(onboarding)');
    return;
  }

  if (result.email) {
    router.replace({
      pathname: '/(auth)/login',
      params: {
        email: result.email,
        verified: '1',
      },
    });
    return;
  }

  router.replace('/(auth)/login');
}
