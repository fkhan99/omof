import { ScrollView, Text, StyleSheet, View } from 'react-native';
import { LegalSection } from '@/constants/legal';
import { FONT_SIZES, SPACING, ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';

interface LegalDocumentScreenProps {
  title: string;
  intro: string;
  sections: LegalSection[];
  version: string;
  lastUpdated: string;
}

export function LegalDocumentScreen({
  title,
  intro,
  sections,
  version,
  lastUpdated,
}: LegalDocumentScreenProps) {
  const styles = useThemedStyles(createStyles);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title} accessibilityRole="header">
        {title}
      </Text>
      <Text style={styles.meta}>
        Version {version} · Last updated {lastUpdated}
      </Text>
      <Text style={styles.intro}>{intro}</Text>

      {sections.map((section) => (
        <View key={section.title} style={styles.section}>
          <Text style={styles.sectionTitle}>{section.title}</Text>
          <Text style={styles.sectionBody}>{section.body}</Text>
        </View>
      ))}
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
      paddingBottom: SPACING.xxl,
    },
    title: {
      fontSize: FONT_SIZES.xxl,
      fontWeight: '700',
      color: colors.text,
      marginBottom: SPACING.xs,
    },
    meta: {
      fontSize: FONT_SIZES.xs,
      color: colors.textMuted,
      marginBottom: SPACING.md,
    },
    intro: {
      fontSize: FONT_SIZES.md,
      color: colors.text,
      lineHeight: 22,
      marginBottom: SPACING.lg,
    },
    section: {
      marginBottom: SPACING.lg,
    },
    sectionTitle: {
      fontSize: FONT_SIZES.lg,
      fontWeight: '600',
      color: colors.text,
      marginBottom: SPACING.sm,
    },
    sectionBody: {
      fontSize: FONT_SIZES.md,
      color: colors.textSecondary,
      lineHeight: 24,
    },
  });
}
