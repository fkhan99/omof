import { useEffect } from 'react';
import { Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/store/authStore';
import {
  completeEmailVerificationFromLink,
  stripEmailActionQueryFromUrl,
} from '@/utils/firebaseEmailActions';

/**
 * On web, email verification links land on the app with ?mode=verifyEmail&oobCode=…
 * Apply the code as early as possible so verification works even before verify-email mounts.
 */
export function useEmailActionHandler() {
  const router = useRouter();
  const setFirebaseUser = useAuthStore((s) => s.setFirebaseUser);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    const search = window.location.search;
    if (!search.includes('oobCode') || !search.includes('mode=verifyEmail')) return;

    void (async () => {
      try {
        const user = await completeEmailVerificationFromLink(search);
        stripEmailActionQueryFromUrl();
        if (user?.emailVerified) {
          setFirebaseUser(user);
          router.replace('/');
        } else {
          router.replace('/(auth)/verify-email');
        }
      } catch (error) {
        console.warn('[Auth] email action link failed', error);
        stripEmailActionQueryFromUrl();
        router.replace('/(auth)/verify-email');
      }
    })();
  }, [router, setFirebaseUser]);
}
