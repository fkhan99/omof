import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/store/authStore';
import { loadAuthUserProfile } from '@/services/firebase/auth';
import { LoadingState } from '@/components/ui/LoadingState';
import { ErrorState } from '@/components/ui/ErrorState';

const log = (...args: unknown[]) => {
  if (__DEV__) console.log(...args);
};

export default function Index() {
  const router = useRouter();
  const { firebaseUser, profile, isLoading, isInitialized, profileError, setProfile, setProfileError } =
    useAuthStore();
  const [retrying, setRetrying] = useState(false);

  const handleRetryProfile = async () => {
    const uid = firebaseUser?.uid;
    if (!uid || retrying) return;
    setRetrying(true);
    try {
      const reloaded = await loadAuthUserProfile(uid);
      setProfileError(false);
      setProfile(reloaded);
    } catch (error) {
      console.warn('[Route] manual profile reload failed', error);
      setProfileError(true);
    } finally {
      setRetrying(false);
    }
  };

  useEffect(() => {
    if (!isInitialized) {
      console.log('[Route] waiting for auth init', { isInitialized, isLoading });
      return;
    }

    if (isLoading) {
      console.log('[Route] auth resolving…', { isInitialized, isLoading });
      return;
    }

    const uid = firebaseUser?.uid ?? null;

    if (!uid) {
      console.log('[Route] no auth user → login', { uid });
      router.replace('/(auth)/login');
      return;
    }

    // A failed profile load (not a missing profile) must not route to
    // onboarding — keep the user here and let them retry.
    if (profileError) {
      console.log('[Route] profile load errored → holding for retry', { uid });
      return;
    }

    const usersDocExists = profile !== null;

    // Every account must have a verified email — including existing ones —
    // before reaching onboarding or the main app.
    if (firebaseUser && !firebaseUser.emailVerified) {
      console.log('[Route] email not verified → verify-email', { uid });
      router.replace('/(auth)/verify-email');
      return;
    }

    if (usersDocExists) {
      console.log('[Route] users/{uid} exists → main app', {
        uid,
        username: profile.username,
      });
      router.replace('/(tabs)');
      return;
    }

    console.log('[Route] users/{uid} missing → onboarding', { uid });
    router.replace('/(onboarding)');
  }, [firebaseUser, profile, isLoading, isInitialized, profileError, router]);

  if (isInitialized && !isLoading && firebaseUser && profileError) {
    if (retrying) {
      return <LoadingState message="Loading your profile..." />;
    }
    return (
      <ErrorState
        message="We couldn't load your profile. Check your connection and try again."
        onRetry={handleRetryProfile}
      />
    );
  }

  return <LoadingState message="Starting OMOF..." />;
}
