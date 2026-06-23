import { useEffect } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { useAuthStore } from '@/store/authStore';
import { LoadingState } from '@/components/ui/LoadingState';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { ThemeColors } from '@/constants/theme';

/** Full-screen web overlay so the boot spinner covers content until auth routing is ready. */
export function WebBootOverlay() {
  const styles = useThemedStyles(createStyles);
  const isInitialized = useAuthStore((s) => s.isInitialized);
  const firebaseUser = useAuthStore((s) => s.firebaseUser);
  const profileLoading = useAuthStore((s) => s.profileLoading);
  const profileLoadComplete = useAuthStore((s) => s.profileLoadComplete);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    document.getElementById('omof-boot-overlay')?.remove();
  }, []);

  if (Platform.OS !== 'web') return null;

  const waitingForAuth = !isInitialized;
  const waitingForProfile = Boolean(firebaseUser && profileLoading && !profileLoadComplete);
  if (!waitingForAuth && !waitingForProfile) return null;

  return (
    <View style={styles.overlay} pointerEvents="auto" accessibilityViewIsModal>
      <LoadingState message="Starting OMOF..." />
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    overlay: {
      ...(Platform.OS === 'web'
        ? ({
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
          } as object)
        : StyleSheet.absoluteFillObject),
      zIndex: 9999,
      elevation: 9999,
      backgroundColor: colors.background,
    },
  });
}
