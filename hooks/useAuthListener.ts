import { useEffect, useRef } from 'react';
import { useAuthStore } from '@/store/authStore';
import { subscribeToAuthState, loadAuthUserProfile } from '@/services/firebase/auth';
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
}
