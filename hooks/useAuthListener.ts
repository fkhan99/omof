import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import { useAuthStore } from '@/store/authStore';
import {
  subscribeToAuthState,
  loadAuthUserProfile,
  subscribeToUserProfile,
} from '@/services/firebase/auth';
import { clearUserPostQueries } from '@/lib/queryClient';
import { todayKey } from '@/utils/streak';
import { clearProfileCache, readProfileCache } from '@/utils/profileCache';

const PROFILE_LOAD_TIMEOUT_MS = Platform.OS === 'web' ? 4_000 : 12_000;
const PROGRESS_SYNC_DEFER_MS = Platform.OS === 'web' ? 15_000 : 4_000;
const FOREGROUND_SYNC_COOLDOWN_MS = 5 * 60 * 1000;

async function loadProfileWithTimeout(uid: string) {
  return Promise.race([
    loadAuthUserProfile(uid),
    new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Profile load timed out')), PROFILE_LOAD_TIMEOUT_MS);
    }),
  ]);
}

function deferSyncUserProgress(uid: string) {
  setTimeout(() => {
    void import('@/services/firebase/gamification')
      .then(({ syncUserProgress }) => syncUserProgress(uid))
      .then((stats) => {
        if (!stats) return;
        const store = useAuthStore.getState();
        if (store.profile && store.profile.id === uid) {
          store.setProfile({ ...store.profile, stats });
        }
      })
      .catch((error) => {
        console.warn('[gamification] deferred progress sync failed', error);
      });
  }, PROGRESS_SYNC_DEFER_MS);
}

export function useAuthListener() {
  const {
    setFirebaseUser,
    setProfile,
    setProfileError,
    setLoading,
    setInitialized,
    setProfileLoading,
    setProfileLoadComplete,
    reset,
  } = useAuthStore();
  const previousUidRef = useRef<string | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeToAuthState((user) => {
      void (async () => {
        const nextUid = user?.uid ?? null;
        if (__DEV__) console.log('[Auth] onAuthStateChanged — uid:', nextUid);

        try {
          if (previousUidRef.current !== null && previousUidRef.current !== nextUid) {
            if (__DEV__) {
              console.log('[Auth] uid changed — clearing post queries', {
                previousUid: previousUidRef.current,
                nextUid,
              });
            }
            clearUserPostQueries();
          }

          previousUidRef.current = nextUid;
          setFirebaseUser(user);

          if (!user) {
            clearProfileCache();
            setProfileError(false);
            setProfile(null);
            setProfileLoading(false);
            setProfileLoadComplete(true);
            clearUserPostQueries();
            return;
          }

          const cachedProfile = readProfileCache(user.uid);
          if (cachedProfile) {
            setProfileError(false);
            setProfile(cachedProfile);
          }

          // Unlock routing as soon as Firebase Auth is known.
          setLoading(false);
          setInitialized(true);
          setProfileLoading(true);
          setProfileLoadComplete(false);

          try {
            let profile;
            try {
              profile = await loadProfileWithTimeout(user.uid);
            } catch (firstError) {
              if (Platform.OS === 'web') {
                throw firstError;
              }
              console.warn('[Auth] profile load failed, retrying once', firstError);
              profile = await loadProfileWithTimeout(user.uid);
            }

            if (__DEV__) {
              console.log('[Auth] profile load result:', {
                uid: user.uid,
                usersDocExists: profile !== null,
              });
            }

            if (profile && profile.id !== user.uid) {
              console.warn('[Auth] profile.id does not match auth uid', {
                profileId: profile.id,
                authUid: user.uid,
              });
            }

            setProfileError(false);
            setProfile(profile);

            if (profile) {
              deferSyncUserProgress(user.uid);
            }
          } catch (error) {
            console.error('[Auth] profile load failed:', error);
            const store = useAuthStore.getState();
            if (!store.profile) {
              setProfileError(true);
              setProfile(null);
            } else {
              console.warn('[Auth] keeping cached profile after load failure');
              deferSyncUserProgress(user.uid);
            }
          } finally {
            setProfileLoading(false);
            setProfileLoadComplete(true);
          }
        } finally {
          setLoading(false);
          setInitialized(true);
        }
      })();
    });

    return () => {
      unsubscribe();
      reset();
    };
  }, [
    setFirebaseUser,
    setProfile,
    setProfileError,
    setLoading,
    setInitialized,
    setProfileLoading,
    setProfileLoadComplete,
    reset,
  ]);

  const lastForegroundSyncRef = useRef<{ at: number; day: string } | null>(null);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;

      const store = useAuthStore.getState();
      const uid = store.firebaseUser?.uid;
      if (!uid || !store.profile) return;

      const now = Date.now();
      const day = todayKey();
      const last = lastForegroundSyncRef.current;
      if (last && last.day === day && now - last.at < FOREGROUND_SYNC_COOLDOWN_MS) {
        return;
      }
      lastForegroundSyncRef.current = { at: now, day };

      void import('@/services/firebase/gamification')
        .then(({ syncUserProgress }) => syncUserProgress(uid))
        .then((stats) => {
          if (!stats) return;
          const latest = useAuthStore.getState();
          if (latest.profile && latest.profile.id === uid) {
            latest.setProfile({ ...latest.profile, stats });
          }
        })
        .catch((error) => {
          console.warn('[gamification] foreground sync failed', error);
        });
    });

    return () => subscription.remove();
  }, []);

  const firebaseUser = useAuthStore((s) => s.firebaseUser);

  useEffect(() => {
    const uid = firebaseUser?.uid;
    if (!uid) return;

    return subscribeToUserProfile(uid, (user) => {
      if (!user) return;
      const store = useAuthStore.getState();
      if (store.firebaseUser?.uid === uid) {
        store.setProfile(user);
      }
    });
  }, [firebaseUser?.uid]);
}
