import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { getMissingFirebaseEnvKeys } from '@/services/firebase/config';
import { FONT_SIZES, SPACING, BORDER_RADIUS, ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';

export function FirebaseSetupNotice() {
  const styles = useThemedStyles(createStyles);
  const missingKeys = getMissingFirebaseEnvKeys();

  return (
    <View style={styles.container} accessibilityRole="alert">
      <Text style={styles.title}>Firebase not configured</Text>
      <Text style={styles.message}>
        Create a <Text style={styles.code}>.env</Text> file in the project root with your Firebase
        Web app credentials, then restart Expo with{' '}
        <Text style={styles.code}>npx expo start -c</Text>.
      </Text>
      <Text style={styles.subtitle}>Required variables:</Text>
      <ScrollView style={styles.list} nestedScrollEnabled>
        {(missingKeys.length > 0 ? missingKeys : [
          'EXPO_PUBLIC_FIREBASE_API_KEY',
          'EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN',
          'EXPO_PUBLIC_FIREBASE_PROJECT_ID',
          'EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET',
          'EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
          'EXPO_PUBLIC_FIREBASE_APP_ID',
        ]).map((key) => (
          <Text key={key} style={styles.key}>
            {key}
          </Text>
        ))}
      </ScrollView>
      <Text style={styles.hint}>
        Find these in Firebase Console → Project Settings → Your apps → Web app → SDK setup.
      </Text>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      backgroundColor: colors.warning + '22',
      borderColor: colors.warning,
      borderWidth: 1,
      borderRadius: BORDER_RADIUS.md,
      padding: SPACING.md,
      marginBottom: SPACING.lg,
    },
    title: {
      fontSize: FONT_SIZES.md,
      fontWeight: '700',
      color: colors.text,
      marginBottom: SPACING.sm,
    },
    message: {
      fontSize: FONT_SIZES.sm,
      color: colors.textSecondary,
      lineHeight: 20,
      marginBottom: SPACING.sm,
    },
    subtitle: {
      fontSize: FONT_SIZES.sm,
      fontWeight: '600',
      color: colors.text,
      marginBottom: SPACING.xs,
    },
    list: {
      maxHeight: 120,
      marginBottom: SPACING.sm,
    },
    key: {
      fontSize: FONT_SIZES.xs,
      fontFamily: 'monospace',
      color: colors.primary,
      marginBottom: 2,
    },
    code: {
      fontFamily: 'monospace',
      fontWeight: '600',
      color: colors.text,
    },
    hint: {
      fontSize: FONT_SIZES.xs,
      color: colors.textMuted,
      lineHeight: 18,
    },
  });
}
