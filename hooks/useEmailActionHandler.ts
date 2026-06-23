import { useEffect } from 'react';
import { Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/store/authStore';
import {
  completeEmailVerificationFromLink,
  isEmailVerificationLink,
  navigateAfterEmailVerification,
  stripEmailActionQueryFromUrl,
} from '@/utils/firebaseEmailActions';

/**
 * On web, verification links land with ?mode=verifyEmail&oobCode=…
 * Apply the code as early as possible and send the user to profile setup.
 */
export function useEmailActionHandler() {
  const router = useRouter();
  const setFirebaseUser = useAuthStore((s) => s.setFirebaseUser);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    const search = window.location.search;
    if (!isEmailVerificationLink(search)) return;

    void (async () => {
      try {
        const result = await completeEmailVerificationFromLink(search);
        stripEmailActionQueryFromUrl();
        if (result?.verified) {
          await navigateAfterEmailVerification(router, result, setFirebaseUser);
          return;
        }
        router.replace('/(auth)/verify-email');
      } catch (error) {
        console.warn('[Auth] email action link failed', error);
        stripEmailActionQueryFromUrl();
        router.replace('/(auth)/verify-email');
      }
    })();
  }, [router, setFirebaseUser]);
}
