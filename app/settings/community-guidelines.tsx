import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { FONT_SIZES, SPACING, ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';

export default function CommunityGuidelinesScreen() {
  const styles = useThemedStyles(createStyles);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title} accessibilityRole="header">Community Guidelines</Text>
      <Text style={styles.intro}>
        OMOF is a space for authentic sharing and mutual support. These guidelines help keep our
        community safe and welcoming for everyone.
      </Text>

      <Text style={styles.sectionTitle}>Be authentic, not harmful</Text>
      <Text style={styles.text}>
        Share real experiences — struggles, setbacks, and difficult days are welcome here. However,
        content that promotes self-harm, harassment, or hate is not allowed.
      </Text>

      <Text style={styles.sectionTitle}>Support, don't judge</Text>
      <Text style={styles.text}>
        Respond with empathy. Use support reactions and comments to let others know they're not
        alone. Avoid judgment, unsolicited advice, or minimizing someone's experience.
      </Text>

      <Text style={styles.sectionTitle}>Respect privacy</Text>
      <Text style={styles.text}>
        Don't share others' personal information without consent. Respect boundaries and block users
        if needed — we support your right to control your experience.
      </Text>

      <Text style={styles.sectionTitle}>No harassment or hate</Text>
      <Text style={styles.text}>
        Bullying, threats, discrimination, and targeted harassment will result in account
        restrictions. Report content that violates these guidelines.
      </Text>

      <Text style={styles.sectionTitle}>We're not a crisis service</Text>
      <Text style={styles.text}>
        OMOF is a supportive community, not a mental health provider. If you or someone you know is
        in crisis, please contact emergency services or a crisis helpline in your area.
      </Text>

      <Text style={styles.sectionTitle}>Report violations</Text>
      <Text style={styles.text}>
        Use the report feature on posts and comments. Our team reviews reports and takes action
        when guidelines are violated.
      </Text>
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
    },
    title: {
      fontSize: FONT_SIZES.xxl,
      fontWeight: '700',
      color: colors.text,
      marginBottom: SPACING.md,
    },
    intro: {
      fontSize: FONT_SIZES.md,
      color: colors.textSecondary,
      lineHeight: 22,
      marginBottom: SPACING.xl,
    },
    sectionTitle: {
      fontSize: FONT_SIZES.lg,
      fontWeight: '600',
      color: colors.text,
      marginBottom: SPACING.sm,
      marginTop: SPACING.lg,
    },
    text: {
      fontSize: FONT_SIZES.md,
      color: colors.textSecondary,
      lineHeight: 22,
    },
  });
}
