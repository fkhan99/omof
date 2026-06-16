import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, Share, Switch } from 'react-native';
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
import { FONT_SIZES, SPACING, ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { PRIVACY_CONTACT_EMAIL, SAFETY_CONTACT_EMAIL } from '@/constants/legal';

export default function PrivacyDataScreen() {
  const router = useRouter();
  const styles = useThemedStyles(createStyles);
  const { profile, firebaseUser, reset } = useAuthStore();
  const authUid = firebaseUser?.uid;
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [notificationsEnabled, setNotificationsEnabled] = useState(!!profile?.fcmToken);

  useEffect(() => {
    setNotificationsEnabled(!!profile?.fcmToken);
  }, [profile?.fcmToken]);

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
    mutationFn: () => deleteAccount(authUid!),
    onSuccess: async () => {
      clearUserPostQueries();
      reset();
      router.replace('/(auth)/login');
      Alert.alert('Account deleted', 'Your OMOF account and personal data have been removed.');
    },
    onError: (err) => {
      Alert.alert('Deletion failed', err instanceof Error ? err.message : 'Try again.');
    },
  });

  const handleNotificationToggle = async (enabled: boolean) => {
    if (!authUid) return;

    if (!enabled) {
      setNotificationsEnabled(false);
      await clearPushToken(authUid);
      return;
    }

    if (!Device.isDevice) {
      Alert.alert('Notifications unavailable', 'Push notifications require a physical device.');
      return;
    }

    const token = await registerForPushNotifications(authUid);
    if (!token) {
      Alert.alert('Permission required', 'Enable notifications in your device Settings.');
      setNotificationsEnabled(false);
      return;
    }

    setNotificationsEnabled(true);
  };

  const handleDelete = () => {
    if (deleteConfirm.trim().toUpperCase() !== 'DELETE') {
      Alert.alert('Confirmation required', 'Type DELETE to confirm account deletion.');
      return;
    }

    Alert.alert(
      'Delete account permanently?',
      'This removes your profile, posts, and personal data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteMutation.mutate(),
        },
      ],
    );
  };

  if (!profile || !authUid) return null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
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
      </Text>
      <Input
        placeholder='Type DELETE to confirm'
        value={deleteConfirm}
        onChangeText={setDeleteConfirm}
        autoCapitalize="characters"
      />
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
