import { useEffect, useState, useCallback } from 'react';
import { useAuthStore } from '@/store/authStore';
import { WelcomeModal } from '@/components/onboarding/WelcomeModal';
import { isWelcomePending, markWelcomeSeen } from '@/utils/welcomeState';

/** One-time welcome overlay after profile setup — mounted at root for reliable stacking. */
export function WelcomeModalHost() {
  const firebaseUser = useAuthStore((s) => s.firebaseUser);
  const profile = useAuthStore((s) => s.profile);
  const pendingWelcome = useAuthStore((s) => s.pendingWelcome);
  const setPendingWelcome = useAuthStore((s) => s.setPendingWelcome);
  const [showWelcome, setShowWelcome] = useState(false);

  useEffect(() => {
    const uid = firebaseUser?.uid;
    if (!uid || !profile) {
      setShowWelcome(false);
      return;
    }

    if (pendingWelcome) {
      setShowWelcome(true);
      return;
    }

    let cancelled = false;
    void isWelcomePending(uid).then((pending) => {
      if (!cancelled) setShowWelcome(pending);
    });

    return () => {
      cancelled = true;
    };
  }, [firebaseUser?.uid, profile?.id, pendingWelcome]);

  const dismissWelcome = useCallback(async () => {
    const uid = firebaseUser?.uid;
    setShowWelcome(false);
    setPendingWelcome(false);
    if (uid) {
      await markWelcomeSeen(uid);
    }
  }, [firebaseUser?.uid, setPendingWelcome]);

  return <WelcomeModal visible={showWelcome} onDismiss={() => void dismissWelcome()} />;
}
