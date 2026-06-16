import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Switch } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { FONT_SIZES, SPACING, ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/hooks/useTheme';
import { ThemeMode } from '@/store/themeStore';
import { useAuthStore } from '@/store/authStore';
import { updateUserProfile } from '@/services/firebase/users';
import { getUserProfile } from '@/services/firebase/auth';

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
      {selected ? <Ionicons name="checkmark-circle" size={22} color={colors.primary} /> : null}
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
  const { mode, setMode } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { profile, setProfile } = useAuthStore();

  const privacyMutation = useMutation({
    mutationFn: (isPrivate: boolean) => updateUserProfile(profile!.id, { isPrivate }),
    onSuccess: async (_data, isPrivate) => {
      if (!profile) return;
      setProfile({ ...profile, isPrivate });
      const refreshed = await getUserProfile(profile.id);
      if (refreshed) setProfile(refreshed);
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

      <Text style={styles.sectionTitle}>Safety & community</Text>
      <SettingsItem
        icon="document-text-outline"
        title="Community Guidelines"
        onPress={() => router.push('/settings/community-guidelines')}
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
      backgroundColor: colors.accentSoft + '44',
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
