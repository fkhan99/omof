import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useAuthStore } from '@/store/authStore';
import { subscribeToAuthState, loadAuthUserProfile } from '@/services/firebase/auth';
import { recordDailyActivity } from '@/services/firebase/gamification';
import { clearUserPostQueries } from '@/lib/queryClient';

const PROFILE_LOAD_TIMEOUT_MS = 15_000;

async function loadProfileWithTimeout(uid: string) {
  return Promise.race([
    loadAuthUserProfile(uid),
    new Promise<null>((_, reject) => {
      setTimeout(() => reject(new Error('Profile load timed out')), PROFILE_LOAD_TIMEOUT_MS);
    }),
  ]);
}

export function useAuthListener() {
  const { setFirebaseUser, setProfile, setLoading, setInitialized, reset } = useAuthStore();
  const previousUidRef = useRef<string | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeToAuthState((user) => {
      void (async () => {
        setLoading(true);

        const nextUid = user?.uid ?? null;
        console.log('[Auth] onAuthStateChanged — uid:', nextUid);

        try {
          if (previousUidRef.current !== null && previousUidRef.current !== nextUid) {
            console.log('[Auth] uid changed — clearing post queries', {
              previousUid: previousUidRef.current,
              nextUid,
            });
            clearUserPostQueries();
          }

          previousUidRef.current = nextUid;
          setFirebaseUser(user);

          if (user) {
            try {
              const profile = await loadProfileWithTimeout(user.uid);
              console.log('[Auth] profile load result:', {
                uid: user.uid,
                usersDocExists: profile !== null,
              });
              if (profile && profile.id !== user.uid) {
                console.warn('[Auth] profile.id does not match auth uid', {
                  profileId: profile.id,
                  authUid: user.uid,
                });
              }
              setProfile(profile);

              if (profile) {
                void recordDailyActivity(user.uid)
                  .then((stats) => {
                    if (!stats) return;
                    const store = useAuthStore.getState();
                    if (store.profile && store.profile.id === user.uid) {
                      store.setProfile({ ...store.profile, stats });
                    }
                  })
                  .catch((error) => {
                    console.warn('[gamification] daily check-in failed', error);
                  });
              }
            } catch (error) {
              console.error('[Auth] profile load failed:', error);
              setProfile(null);
            }
          } else {
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
  }, [setFirebaseUser, setProfile, setLoading, setInitialized, reset]);

  // Re-check the streak when the app returns to the foreground (e.g. left open
  // across midnight) so the day streak stays accurate without a restart.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;

      const store = useAuthStore.getState();
      const uid = store.firebaseUser?.uid;
      if (!uid || !store.profile) return;

      void recordDailyActivity(uid)
        .then((stats) => {
          if (!stats) return;
          const latest = useAuthStore.getState();
          if (latest.profile && latest.profile.id === uid) {
            latest.setProfile({ ...latest.profile, stats });
          }
        })
        .catch((error) => {
          console.warn('[gamification] foreground check-in failed', error);
        });
    });

    return () => subscription.remove();
  }, []);
}
