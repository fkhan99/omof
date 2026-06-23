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
  const [storedPending, setStoredPending] = useState(false);

  // Restore pending flag from storage (e.g. app reload before dismiss).
  useEffect(() => {
    const uid = firebaseUser?.uid;
    if (!uid || pendingWelcome) {
      return;
    }

    let cancelled = false;
    void isWelcomePending(uid).then((pending) => {
      if (!cancelled) setStoredPending(pending);
    });

    return () => {
      cancelled = true;
    };
  }, [firebaseUser?.uid, pendingWelcome]);

  const visible = Boolean(
    firebaseUser?.uid && profile && (pendingWelcome || storedPending),
  );

  const dismissWelcome = useCallback(async () => {
    const uid = firebaseUser?.uid;
    setStoredPending(false);
    setPendingWelcome(false);
    if (uid) {
      await markWelcomeSeen(uid);
    }
  }, [firebaseUser?.uid, setPendingWelcome]);

  return <WelcomeModal visible={visible} onDismiss={() => void dismissWelcome()} />;
}
