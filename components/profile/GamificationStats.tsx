import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { User } from '@/types';
import { BADGE_DEFINITIONS } from '@/constants/gamification';
import { FONT_SIZES, SPACING, BORDER_RADIUS, ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/hooks/useTheme';

interface GamificationStatsProps {
  user: User;
}

export function GamificationStats({ user }: GamificationStatsProps) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const { stats, badges } = user;

  const statItems = [
    { label: 'Points', value: stats.points },
    { label: 'Streak', value: `${stats.streakDays}d` },
    { label: 'Given', value: stats.reactionsGiven },
    { label: 'Received', value: stats.reactionsReceived },
  ];

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Your journey</Text>
      <Text style={styles.subtitle}>Personal progress — no public rankings.</Text>

      <View style={styles.statsRow}>
        {statItems.map((item) => (
          <View key={item.label} style={styles.stat}>
            <Text style={styles.statValue}>{item.value}</Text>
            <Text style={styles.statLabel}>{item.label}</Text>
          </View>
        ))}
      </View>

      <View style={styles.countsRow}>
        <Text style={styles.countText}>{stats.postsCount} posts</Text>
        <Text style={styles.countDot}>·</Text>
        <Text style={styles.countText}>{stats.commentsCount} comments</Text>
        <Text style={styles.countDot}>·</Text>
        <Text style={styles.countText}>{stats.supportiveCommentsCount} supportive</Text>
      </View>

      <Text style={styles.badgesTitle}>Badges</Text>
      {badges.length === 0 ? (
        <Text style={styles.emptyBadges}>Keep sharing authentically to earn your first badge.</Text>
      ) : (
        <View style={styles.badgesList}>
          {badges.map((badgeId) => {
            const badge = BADGE_DEFINITIONS[badgeId];
            return (
              <View key={badgeId} style={styles.badgeItem}>
                <Ionicons
                  name={badge.icon as keyof typeof Ionicons.glyphMap}
                  size={18}
                  color={colors.primary}
                />
                <View style={styles.badgeText}>
                  <Text style={styles.badgeTitle}>{badge.title}</Text>
                  <Text style={styles.badgeDescription}>{badge.description}</Text>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      backgroundColor: colors.surface,
      padding: SPACING.lg,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    title: {
      fontSize: FONT_SIZES.md,
      fontWeight: '700',
      color: colors.text,
    },
    subtitle: {
      fontSize: FONT_SIZES.sm,
      color: colors.textMuted,
      marginTop: SPACING.xs,
      marginBottom: SPACING.md,
    },
    statsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: SPACING.md,
    },
    stat: {
      alignItems: 'center',
      flex: 1,
    },
    statValue: {
      fontSize: FONT_SIZES.lg,
      fontWeight: '700',
      color: colors.text,
    },
    statLabel: {
      fontSize: FONT_SIZES.xs,
      color: colors.textMuted,
      marginTop: 2,
    },
    countsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      marginBottom: SPACING.md,
    },
    countText: {
      fontSize: FONT_SIZES.sm,
      color: colors.textSecondary,
    },
    countDot: {
      marginHorizontal: SPACING.xs,
      color: colors.textMuted,
    },
    badgesTitle: {
      fontSize: FONT_SIZES.sm,
      fontWeight: '700',
      color: colors.text,
      marginBottom: SPACING.sm,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    emptyBadges: {
      fontSize: FONT_SIZES.sm,
      color: colors.textMuted,
      lineHeight: 20,
    },
    badgesList: {
      gap: SPACING.sm,
    },
    badgeItem: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: SPACING.sm,
      backgroundColor: colors.surfaceMuted,
      padding: SPACING.md,
      borderRadius: BORDER_RADIUS.md,
    },
    badgeText: {
      flex: 1,
    },
    badgeTitle: {
      fontSize: FONT_SIZES.sm,
      fontWeight: '700',
      color: colors.text,
    },
    badgeDescription: {
      fontSize: FONT_SIZES.xs,
      color: colors.textMuted,
      marginTop: 2,
      lineHeight: 16,
    },
  });
}
