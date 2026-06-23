import { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/store/authStore';
import { loadAuthUserProfile } from '@/services/firebase/auth';
import { requiresEmailVerification } from '@/services/firebase/socialAuth';
import { LoadingState } from '@/components/ui/LoadingState';
import { ErrorState } from '@/components/ui/ErrorState';

const log = (...args: unknown[]) => {
  if (__DEV__) console.log(...args);
};

export default function Index() {
  const router = useRouter();
  const {
    firebaseUser,
    profile,
    isInitialized,
    profileError,
    profileLoadComplete,
    setProfile,
    setProfileError,
  } = useAuthStore();
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
      log('[Route] waiting for auth init');
      return;
    }

    const uid = firebaseUser?.uid ?? null;

    if (!uid) {
      log('[Route] no auth user → login');
      router.replace('/(auth)/login');
      return;
    }

    if (profileError && !profile) {
      log('[Route] profile load errored → holding for retry', { uid });
      return;
    }

    if (firebaseUser && requiresEmailVerification(firebaseUser)) {
      log('[Route] email not verified → verify-email', { uid });
      router.replace('/(auth)/verify-email');
      return;
    }

    if (profile) {
      log('[Route] users/{uid} exists → main app', {
        uid,
        username: profile.username,
      });
      router.replace('/(tabs)');
      return;
    }

    if (profileLoadComplete) {
      log('[Route] users/{uid} missing → onboarding', { uid });
      router.replace('/onboarding');
    }
  }, [firebaseUser, profile, isInitialized, profileError, profileLoadComplete, router]);

  if (!isInitialized) {
    return Platform.OS === 'web' ? <View style={{ flex: 1 }} /> : <LoadingState message="Starting OMOF..." />;
  }

  if (firebaseUser && profileError && !profile) {
    if (retrying) {
      return Platform.OS === 'web' ? <View style={{ flex: 1 }} /> : <LoadingState message="Loading your profile..." />;
    }
    return (
      <ErrorState
        message="We couldn't load your profile. Check your connection and try again."
        onRetry={handleRetryProfile}
      />
    );
  }

  if (firebaseUser && !profile && !profileLoadComplete) {
    return Platform.OS === 'web' ? <View style={{ flex: 1 }} /> : <LoadingState message="Loading your profile..." />;
  }

  return Platform.OS === 'web' ? <View style={{ flex: 1 }} /> : <LoadingState message="Starting OMOF..." />;
}
