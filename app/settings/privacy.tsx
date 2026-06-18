import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  Share,
  Switch,
  Keyboard,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import * as Device from 'expo-device';
import { useAuthStore } from '@/store/authStore';
import { deleteAccount } from '@/services/firebase/accountDeletion';
import { exportUserData } from '@/services/firebase/dataExport';
import { clearPushToken, registerForPushNotifications } from '@/utils/pushRegistration';
import { clearUserPostQueries } from '@/lib/queryClient';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { LoadingState } from '@/components/ui/LoadingState';
import { logOut } from '@/services/firebase/auth';
import { FONT_SIZES, SPACING, ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { PRIVACY_CONTACT_EMAIL, SAFETY_CONTACT_EMAIL } from '@/constants/legal';

export default function PrivacyDataScreen() {
  const router = useRouter();
  const styles = useThemedStyles(
    createStyles,
  );
  const { profile, firebaseUser, reset } = useAuthStore();
  const authUid = firebaseUser?.uid;
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(!!profile?.fcmToken);

  useEffect(() => {
    setNotificationsEnabled(!!profile?.fcmToken);
  }, [profile?.fcmToken]);

  useEffect(() => {
    if (profile && authUid) return;

    void (async () => {
      try {
        await logOut();
      } catch {
        // Session may already be cleared after account deletion.
      }
      reset();
      router.replace('/(auth)/login');
    })();
  }, [profile, authUid, reset, router]);

  const exportMutation = useMutation({
    mutationFn: () => exportUserData(authUid!),
    onSuccess: async (json) => {
      await Share.share({
        message: json,
        title: 'OMOF Data Export',
      });
    },
    onError: (err) => {
      Alert.alert('Export failed', err instanceof Error ? err.message : 'Try again.');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (password: string) => deleteAccount(authUid!, password),
    onSuccess: async () => {
      clearUserPostQueries();
      reset();
      router.replace('/(auth)/login');
      Alert.alert('Account deleted', 'Your OMOF account and personal data have been removed.');
    },
    onError: (err) => {
      const message = err instanceof Error ? err.message : 'Try again.';
      setDeleteError(message);
      Alert.alert('Deletion failed', message);
    },
  });

  const confirmAccountDeletion = (): Promise<boolean> =>
    new Promise((resolve) => {
      if (Platform.OS === 'web') {
        resolve(
          window.confirm(
            'Delete account permanently? This removes your profile, posts, and personal data. This cannot be undone.',
          ),
        );
        return;
      }

      Alert.alert(
        'Delete account permanently?',
        'This removes your profile, posts, and personal data. This cannot be undone.',
        [
          { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => resolve(true),
          },
        ],
        { cancelable: true, onDismiss: () => resolve(false) },
      );
    });

  const handleNotificationToggle = async (enabled: boolean) => {
    if (!authUid) return;

    if (!enabled) {
      setNotificationsEnabled(false);
      try {
        await clearPushToken(authUid);
      } catch (error) {
        console.warn('[push] failed to clear token', error);
      }
      return;
    }

    if (!Device.isDevice) {
      Alert.alert(
        'Notifications unavailable',
        'Push notifications require a physical device — they do not work on simulators or emulators.',
      );
      return;
    }

    try {
      const token = await registerForPushNotifications(authUid);
      if (!token) {
        Alert.alert(
          'Permission needed',
          'Notifications are turned off for OMOF. Enable them for OMOF in your device Settings, then try again.',
        );
        setNotificationsEnabled(false);
        return;
      }

      setNotificationsEnabled(true);
    } catch (error) {
      console.error('[push] enable failed', error);
      const message = error instanceof Error ? error.message : '';
      const needsDevBuild = /Expo Go|development build|removed from Expo Go|getExpoPushTokenAsync/i.test(
        message,
      );

      Alert.alert(
        'Could not enable notifications',
        needsDevBuild
          ? 'Push notifications require a development build, not Expo Go. Build one with: eas build --profile development'
          : message || 'Something went wrong enabling notifications. Please try again.',
      );
      setNotificationsEnabled(false);
    }
  };

  const handleDelete = async () => {
    Keyboard.dismiss();
    setDeleteError(null);

    if (deleteConfirm.trim().toUpperCase() !== 'DELETE') {
      const message = 'Type DELETE in the field above to confirm.';
      setDeleteError(message);
      Alert.alert('Confirmation required', message);
      return;
    }

    if (!deletePassword.trim()) {
      const message = 'Enter your password to confirm account deletion.';
      setDeleteError(message);
      Alert.alert('Password required', message);
      return;
    }

    const confirmed = await confirmAccountDeletion();
    if (!confirmed) return;

    deleteMutation.mutate(deletePassword);
  };

  if (!profile || !authUid) {
    return <LoadingState message="Redirecting to sign in..." />;
  }

  const deleteReady = deleteConfirm.trim().toUpperCase() === 'DELETE';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
    >
      <Text style={styles.title}>Privacy & Data</Text>
      <Text style={styles.subtitle}>
        Manage your data rights under GDPR, CCPA, and app store requirements.
      </Text>

      <Text style={styles.sectionTitle}>Your data</Text>
      <Button
        title={exportMutation.isPending ? 'Preparing export...' : 'Download my data (JSON)'}
        variant="secondary"
        onPress={() => exportMutation.mutate()}
        loading={exportMutation.isPending}
      />
      <Text style={styles.help}>
        Exports profile, posts, comments, reactions, follows, blocks, and notifications.
      </Text>

      <Text style={styles.sectionTitle}>Notifications</Text>
      <View style={styles.toggleRow}>
        <View style={styles.toggleText}>
          <Text style={styles.toggleTitle}>Push notifications</Text>
          <Text style={styles.toggleDescription}>
            You can also manage this in your device Settings. We only store a token to deliver alerts.
          </Text>
        </View>
        <Switch value={notificationsEnabled} onValueChange={handleNotificationToggle} />
      </View>

      <Text style={styles.sectionTitle}>Contact</Text>
      <Text style={styles.help}>Privacy requests: {PRIVACY_CONTACT_EMAIL}</Text>
      <Text style={styles.help}>Safety / moderation: {SAFETY_CONTACT_EMAIL}</Text>

      <Text style={[styles.sectionTitle, styles.dangerTitle]}>Delete account</Text>
      <Text style={styles.help}>
        Required by Apple and Google. Permanently deletes your account and personal data.
        You must enter your password to confirm.
      </Text>
      <Input
        placeholder="Type DELETE to confirm"
        value={deleteConfirm}
        onChangeText={(text) => {
          setDeleteConfirm(text);
          if (deleteError) setDeleteError(null);
        }}
        autoCapitalize="characters"
        autoCorrect={false}
        returnKeyType="done"
        onSubmitEditing={Keyboard.dismiss}
      />
      <Input
        label="Password"
        placeholder="Enter your password"
        value={deletePassword}
        onChangeText={(text) => {
          setDeletePassword(text);
          if (deleteError) setDeleteError(null);
        }}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="done"
        onSubmitEditing={Keyboard.dismiss}
      />
      {!deleteReady ? (
        <Text style={styles.deleteHint}>Type DELETE above, then tap the button below.</Text>
      ) : null}
      {deleteError ? (
        <Text style={styles.deleteError} accessibilityRole="alert">
          {deleteError}
        </Text>
      ) : null}
      <Button
        title={deleteMutation.isPending ? 'Deleting...' : 'Delete my account'}
        variant="danger"
        onPress={handleDelete}
        loading={deleteMutation.isPending}
      />
    </ScrollView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      padding: SPACING.lg,
      gap: SPACING.md,
      paddingBottom: SPACING.xxl,
    },
    title: {
      fontSize: FONT_SIZES.xl,
      fontWeight: '700',
      color: colors.text,
    },
    subtitle: {
      fontSize: FONT_SIZES.sm,
      color: colors.textMuted,
      lineHeight: 20,
    },
    sectionTitle: {
      fontSize: FONT_SIZES.sm,
      fontWeight: '700',
      color: colors.text,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginTop: SPACING.sm,
    },
    dangerTitle: {
      color: colors.danger,
    },
    help: {
      fontSize: FONT_SIZES.sm,
      color: colors.textMuted,
      lineHeight: 20,
    },
    deleteHint: {
      fontSize: FONT_SIZES.sm,
      color: colors.textMuted,
      fontStyle: 'italic',
    },
    deleteError: {
      fontSize: FONT_SIZES.sm,
      color: colors.danger,
      lineHeight: 20,
    },
    toggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: SPACING.md,
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: SPACING.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    toggleText: {
      flex: 1,
    },
    toggleTitle: {
      fontSize: FONT_SIZES.md,
      fontWeight: '600',
      color: colors.text,
    },
    toggleDescription: {
      fontSize: FONT_SIZES.sm,
      color: colors.textMuted,
      marginTop: SPACING.xs,
      lineHeight: 18,
    },
  });
}
