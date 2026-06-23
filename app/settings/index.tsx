import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Switch, Alert, Platform, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { FONT_SIZES, SPACING, ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/hooks/useTheme';
import { ThemeMode } from '@/store/themeStore';
import { useAuthStore } from '@/store/authStore';
import { updateUserProfile } from '@/services/firebase/users';
import { getUserProfile, logOut } from '@/services/firebase/auth';
import { sendTestPushToSelf } from '@/utils/pushRegistration';
import { clearUserPostQueries } from '@/lib/queryClient';
import { confirmAction } from '@/utils/confirm';

interface SettingsItemProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  onPress: () => void;
}

function SettingsItem({ icon, title, onPress }: SettingsItemProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createItemStyles);

  return (
    <TouchableOpacity style={styles.item} onPress={onPress} accessibilityRole="button">
      <Ionicons name={icon} size={22} color={colors.textSecondary} />
      <Text style={styles.itemText}>{title}</Text>
      <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
    </TouchableOpacity>
  );
}

interface ThemeOptionProps {
  label: string;
  description?: string;
  selected: boolean;
  onPress: () => void;
}

function ThemeOption({ label, description, selected, onPress }: ThemeOptionProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createThemeOptionStyles);

  return (
    <TouchableOpacity
      style={[styles.option, selected && styles.optionSelected]}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
    >
      <View style={styles.optionContent}>
        <Text style={styles.optionLabel}>{label}</Text>
        {description ? <Text style={styles.optionDescription}>{description}</Text> : null}
      </View>
      {selected ? <Ionicons name="checkmark-circle" size={22} color={colors.selected} /> : null}
    </TouchableOpacity>
  );
}

const THEME_OPTIONS: { mode: ThemeMode; label: string; description: string }[] = [
  { mode: 'system', label: 'System', description: 'Match your device setting' },
  { mode: 'light', label: 'Light', description: 'Always use light mode' },
  { mode: 'dark', label: 'Dark', description: 'Always use dark mode' },
];

export default function SettingsScreen() {
  const router = useRouter();
  const { mode, setMode, colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { profile, setProfile, reset } = useAuthStore();

  const handleSignOut = () => {
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
          } catch (error) {
            Alert.alert(
              'Sign out failed',
              error instanceof Error ? error.message : 'Please try again.',
            );
          }
        })();
      },
      'Sign Out',
    );
  };

  const privacyMutation = useMutation({
    mutationFn: (isPrivate: boolean) => updateUserProfile(profile!.id, { isPrivate }),
    onSuccess: async (_data, isPrivate) => {
      if (!profile) return;
      setProfile({ ...profile, isPrivate });
      const refreshed = await getUserProfile(profile.id);
      if (refreshed) setProfile(refreshed);
    },
    onError: (error) => {
      Alert.alert(
        "Couldn't update privacy",
        error instanceof Error ? error.message : 'Please try again.',
      );
    },
  });

  const testPushMutation = useMutation({
    mutationFn: () => sendTestPushToSelf(profile!.id),
    onSuccess: (result) => {
      Alert.alert(
        result.ok ? 'Test notification sent' : "Couldn't send test",
        result.message,
      );
    },
    onError: (error) => {
      Alert.alert(
        "Couldn't send test",
        error instanceof Error ? error.message : 'Please try again.',
      );
    },
  });

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.sectionTitle}>Account</Text>
      <View style={styles.section}>
        <SettingsItem
          icon="star-outline"
          title="OMOF Plus"
          onPress={() => router.push('/settings/subscription')}
        />
        <View style={styles.toggleRow}>
          <View style={styles.toggleText}>
            <Text style={styles.toggleTitle}>Private account</Text>
            <Text style={styles.toggleDescription}>
              Only approved followers can see your posts.
            </Text>
          </View>
          <Switch
            value={profile?.isPrivate ?? false}
            onValueChange={(value) => privacyMutation.mutate(value)}
            disabled={!profile || privacyMutation.isPending}
          />
        </View>
        <SettingsItem icon="log-out-outline" title="Sign Out" onPress={handleSignOut} />
      </View>

      <Text style={styles.sectionTitle}>Appearance</Text>
      <View style={styles.section}>
        {THEME_OPTIONS.map((option) => (
          <ThemeOption
            key={option.mode}
            label={option.label}
            description={option.description}
            selected={mode === option.mode}
            onPress={() => setMode(option.mode)}
          />
        ))}
      </View>

      <Text style={styles.sectionTitle}>Notifications</Text>
      <View style={styles.section}>
        {Platform.OS === 'web' ? (
          <View style={styles.testRow}>
            <Ionicons name="notifications-off-outline" size={22} color={colors.textMuted} />
            <View style={styles.testText}>
              <Text style={styles.testTitle}>Not available on web</Text>
              <Text style={styles.testDescription}>
                Push notifications work in the iOS and Android apps. Install OMOF on your phone to
                enable them.
              </Text>
            </View>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.testRow}
            onPress={() => testPushMutation.mutate()}
            disabled={!profile || testPushMutation.isPending}
            accessibilityRole="button"
          >
            <Ionicons name="notifications-outline" size={22} color={colors.textSecondary} />
            <View style={styles.testText}>
              <Text style={styles.testTitle}>Send test notification</Text>
              <Text style={styles.testDescription}>
                Push a test to this device to confirm notifications work.
              </Text>
            </View>
            {testPushMutation.isPending ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <Ionicons name="paper-plane-outline" size={20} color={colors.primary} />
            )}
          </TouchableOpacity>
        )}
      </View>

      <Text style={styles.sectionTitle}>Safety & community</Text>
      <SettingsItem
        icon="document-text-outline"
        title="Community Guidelines"
        onPress={() => router.push('/settings/community-guidelines')}
      />
      <SettingsItem
        icon="shield-checkmark-outline"
        title="Privacy & Data"
        onPress={() => router.push('/settings/privacy')}
      />
      <SettingsItem
        icon="document-outline"
        title="Privacy Policy"
        onPress={() => router.push('/settings/privacy-policy')}
      />
      <SettingsItem
        icon="reader-outline"
        title="Terms of Service"
        onPress={() => router.push('/settings/terms')}
      />
      <SettingsItem
        icon="ban-outline"
        title="Blocked Users"
        onPress={() => router.push('/settings/blocked')}
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
    sectionTitle: {
      fontSize: FONT_SIZES.sm,
      fontWeight: '600',
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      paddingHorizontal: SPACING.lg,
      paddingTop: SPACING.lg,
      paddingBottom: SPACING.sm,
    },
    section: {
      backgroundColor: colors.surface,
      borderTopWidth: 1,
      borderBottomWidth: 1,
      borderColor: colors.border,
    },
    toggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: SPACING.lg,
      gap: SPACING.md,
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
    testRow: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: SPACING.lg,
      gap: SPACING.md,
    },
    testText: {
      flex: 1,
    },
    testTitle: {
      fontSize: FONT_SIZES.md,
      fontWeight: '600',
      color: colors.text,
    },
    testDescription: {
      fontSize: FONT_SIZES.sm,
      color: colors.textMuted,
      marginTop: SPACING.xs,
      lineHeight: 18,
    },
  });
}

function createItemStyles(colors: ThemeColors) {
  return StyleSheet.create({
    item: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: SPACING.lg,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      gap: SPACING.md,
    },
    itemText: {
      flex: 1,
      fontSize: FONT_SIZES.md,
      color: colors.text,
    },
  });
}

function createThemeOptionStyles(colors: ThemeColors) {
  return StyleSheet.create({
    option: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: SPACING.lg,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      gap: SPACING.md,
    },
    optionSelected: {
      backgroundColor: colors.selectedBackground,
      borderLeftWidth: 3,
      borderLeftColor: colors.selectedBorder,
    },
    optionContent: {
      flex: 1,
    },
    optionLabel: {
      fontSize: FONT_SIZES.md,
      fontWeight: '600',
      color: colors.text,
    },
    optionDescription: {
      fontSize: FONT_SIZES.sm,
      color: colors.textMuted,
      marginTop: SPACING.xs,
    },
  });
}
