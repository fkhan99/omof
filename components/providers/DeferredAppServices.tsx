import { useEffect, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useFollowRelationshipSync } from '@/hooks/useFollowRelationshipSync';
import { WelcomeModalHost } from '@/components/onboarding/WelcomeModalHost';

const WEB_DEFER_MS = 900;
const WEB_IDLE_TIMEOUT_MS = 2500;

function BackgroundSyncServices() {
  usePushNotifications();
  useFollowRelationshipSync();
  return null;
}

function useWebDeferredReady() {
  const [ready, setReady] = useState(Platform.OS !== 'web');

  useEffect(() => {
    if (Platform.OS !== 'web') return;

    let cancelled = false;
    const activate = () => {
      if (!cancelled) setReady(true);
    };

    if (typeof requestIdleCallback === 'function') {
      const idleId = requestIdleCallback(activate, { timeout: WEB_IDLE_TIMEOUT_MS });
      return () => {
        cancelled = true;
        cancelIdleCallback(idleId);
      };
    }

    const timeoutId = setTimeout(activate, WEB_DEFER_MS);
    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, []);

  return ready;
}

/** Defers non-critical listeners/modals on web so auth + first paint win the network. */
export function DeferredAppServices({ children }: { children: ReactNode }) {
  const ready = useWebDeferredReady();

  return (
    <>
      {children}
      {ready ? (
        <>
          <BackgroundSyncServices />
          <WelcomeModalHost />
        </>
      ) : null}
    </>
  );
}
