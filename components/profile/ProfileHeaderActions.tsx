import { View, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { logOut } from '@/services/firebase/auth';
import { clearUserPostQueries } from '@/lib/queryClient';
import { confirmAction } from '@/utils/confirm';
import { useAuthStore } from '@/store/authStore';
import { useTheme } from '@/hooks/useTheme';
import { SPACING } from '@/constants/theme';

export function ProfileHeaderActions() {
  const router = useRouter();
  const reset = useAuthStore((s) => s.reset);
  const { colors } = useTheme();

  const handleLogout = () => {
    confirmAction(
      'Sign out',
      'Are you sure you want to sign out?',
      () => {
        void (async () => {
          try {
            clearUserPostQueries();
            await logOut();
            reset();
            router.replace('/(auth)/login');
          } catch (err) {
            Alert.alert(
              'Sign out failed',
              err instanceof Error ? err.message : 'Please try again.',
            );
          }
        })();
      },
      'Sign Out',
    );
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.button}
        onPress={handleLogout}
        accessibilityRole="button"
        accessibilityLabel="Sign out"
      >
        <Ionicons name="log-out-outline" size={22} color={colors.text} />
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.button}
        onPress={() => router.push('/settings')}
        accessibilityRole="button"
        accessibilityLabel="Settings"
      >
        <Ionicons name="settings-outline" size={24} color={colors.text} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginRight: SPACING.sm,
  },
  button: {
    padding: SPACING.sm,
  },
});
