import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { POSTS } from '@/constants/copy';
import { FONT_SIZES, SPACING, BORDER_RADIUS, ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/hooks/useTheme';
import { formatRelativeTime } from '@/utils';

interface PostGrowthSectionProps {
  growthCaption: string;
  updatedAt?: Date | null;
  compact?: boolean;
}

export function PostGrowthSection({
  growthCaption,
  updatedAt,
  compact = false,
}: PostGrowthSectionProps) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();

  return (
    <View style={[styles.container, compact && styles.containerCompact]}>
      <View style={styles.badgeRow}>
        <View style={styles.badge}>
          <Ionicons name="trending-up" size={14} color={colors.primary} />
          <Text style={styles.badgeText}>{POSTS.growthBadge}</Text>
        </View>
        {updatedAt ? (
          <Text style={styles.updatedAt}>{formatRelativeTime(updatedAt)}</Text>
        ) : null}
      </View>
      <Text style={styles.growthCaption}>{growthCaption}</Text>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      marginTop: SPACING.sm,
      padding: SPACING.md,
      borderRadius: BORDER_RADIUS.md,
      backgroundColor: colors.accentSoft + '44',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderLeftWidth: 3,
      borderLeftColor: colors.primary,
      gap: SPACING.xs,
    },
    containerCompact: {
      marginTop: SPACING.xs,
      padding: SPACING.sm,
    },
    badgeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: SPACING.sm,
    },
    badge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    badgeText: {
      fontSize: FONT_SIZES.xs,
      fontWeight: '700',
      color: colors.primary,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    updatedAt: {
      fontSize: FONT_SIZES.xs,
      color: colors.textMuted,
    },
    growthCaption: {
      fontSize: FONT_SIZES.sm,
      color: colors.text,
      lineHeight: 20,
    },
  });
}
