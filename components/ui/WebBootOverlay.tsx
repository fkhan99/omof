import { useEffect, useMemo } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';
import { createPortal } from 'react-dom';
import { usePathname } from 'expo-router';
import { useAuthStore } from '@/store/authStore';
import { useTheme } from '@/hooks/useTheme';
import { FONT_SIZES, SPACING } from '@/constants/theme';

/** Full-screen web overlay on the boot route so content never shows through while loading. */
export function WebBootOverlay() {
  const pathname = usePathname();
  const { colors } = useTheme();
  const isInitialized = useAuthStore((s) => s.isInitialized);
  const firebaseUser = useAuthStore((s) => s.firebaseUser);
  const profileLoading = useAuthStore((s) => s.profileLoading);
  const profileLoadComplete = useAuthStore((s) => s.profileLoadComplete);
  const profileError = useAuthStore((s) => s.profileError);
  const profile = useAuthStore((s) => s.profile);

  const isBootRoute = pathname === '/' || pathname === '';
  const waitingForAuth = !isInitialized;
  const waitingForProfile = Boolean(
    firebaseUser && profileLoading && !profileLoadComplete && !profile && !profileError,
  );
  const visible = isBootRoute && (waitingForAuth || waitingForProfile);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    if (!visible) {
      document.getElementById('omof-boot-overlay')?.remove();
    }
  }, [visible]);

  const overlayStyle = useMemo(
    () => ({
      position: 'fixed' as const,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 999999,
      display: 'flex',
      flexDirection: 'column' as const,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.background,
      gap: SPACING.md,
      padding: SPACING.xl,
    }),
    [colors.background],
  );

  if (Platform.OS !== 'web' || typeof document === 'undefined' || !visible) {
    return null;
  }

  return createPortal(
    <View style={overlayStyle} accessibilityRole="progressbar" accessibilityLabel="Starting OMOF">
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={{ fontSize: FONT_SIZES.md, color: colors.textSecondary, fontWeight: '600' }}>
        Starting OMOF...
      </Text>
    </View>,
    document.body,
  );
}
