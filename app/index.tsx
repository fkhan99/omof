import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/store/authStore';
import { LoadingState } from '@/components/ui/LoadingState';

export default function Index() {
  const router = useRouter();
  const { firebaseUser, profile, isLoading, isInitialized } = useAuthStore();

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

    const usersDocExists = profile !== null;

    // New signups must verify their email before onboarding. Existing accounts
    // (those that already have a profile) are grandfathered in.
    if (firebaseUser && !firebaseUser.emailVerified && !usersDocExists) {
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
  }, [firebaseUser, profile, isLoading, isInitialized, router]);

  return <LoadingState message="Starting OMOF..." />;
}
