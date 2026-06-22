import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useAuthStore } from '@/store/authStore';
import {
  subscribeToAuthState,
  loadAuthUserProfile,
  subscribeToUserProfile,
} from '@/services/firebase/auth';
import { syncUserProgress } from '@/services/firebase/gamification';
import { clearUserPostQueries } from '@/lib/queryClient';
import { todayKey } from '@/utils/streak';

const PROFILE_LOAD_TIMEOUT_MS = 15_000;
// syncUserProgress does several full-collection reads; don't repeat it on every
// foreground. Re-run only after a cooldown or when the local day rolls over.
const FOREGROUND_SYNC_COOLDOWN_MS = 5 * 60 * 1000;

async function loadProfileWithTimeout(uid: string) {
  return Promise.race([
    loadAuthUserProfile(uid),
    new Promise<null>((_, reject) => {
      setTimeout(() => reject(new Error('Profile load timed out')), PROFILE_LOAD_TIMEOUT_MS);
    }),
  ]);
}

export function useAuthListener() {
  const { setFirebaseUser, setProfile, setProfileError, setLoading, setInitialized, reset } =
    useAuthStore();
  const previousUidRef = useRef<string | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeToAuthState((user) => {
      void (async () => {
        setLoading(true);

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

          if (user) {
            try {
              let profile;
              try {
                profile = await loadProfileWithTimeout(user.uid);
              } catch (firstError) {
                // Retry once before treating it as a failure, so a transient
                // network blip doesn't drop an existing user into onboarding.
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
                void syncUserProgress(user.uid)
                  .then((stats) => {
                    if (!stats) return;
                    const store = useAuthStore.getState();
                    if (store.profile && store.profile.id === user.uid) {
                      store.setProfile({ ...store.profile, stats });
                    }
                  })
                  .catch((error) => {
                    console.warn('[gamification] progress sync failed', error);
                  });
              }
            } catch (error) {
              console.error('[Auth] profile load failed:', error);
              // Distinguish a load failure from a genuinely missing profile so
              // the router doesn't push an existing user into onboarding.
              setProfileError(true);
              setProfile(null);
            }
          } else {
            setProfileError(false);
            setProfile(null);
            clearUserPostQueries();
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
  }, [setFirebaseUser, setProfile, setProfileError, setLoading, setInitialized, reset]);

  // Re-check the streak when the app returns to the foreground (e.g. left open
  // across midnight) so the day streak stays accurate without a restart.
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
      // Skip the (expensive) reconciliation if we synced recently on the same
      // calendar day.
      if (last && last.day === day && now - last.at < FOREGROUND_SYNC_COOLDOWN_MS) {
        return;
      }
      lastForegroundSyncRef.current = { at: now, day };

      void syncUserProgress(uid)
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

  // Keep profile stats/points in sync as Cloud Functions update the user doc.
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
