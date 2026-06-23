import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Post } from '@/types';
import { POSTS } from '@/constants/copy';
import { MoodTagBadge } from '@/components/ui/MoodTagBadge';
import { FONT_SIZES, SPACING, BORDER_RADIUS, ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/hooks/useTheme';
import { Ionicons } from '@expo/vector-icons';

interface GrowthUpdateCardProps {
  post: Post;
  compact?: boolean;
}

export function GrowthUpdateCard({ post, compact = false }: GrowthUpdateCardProps) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const router = useRouter();

  const openParent = () => {
    if (post.parentPostId) {
      router.push(`/post/${post.parentPostId}`);
    }
  };

  return (
    <View style={[styles.container, compact && styles.containerCompact]}>
      <View style={styles.badgeRow}>
        <View style={styles.badge}>
          <Ionicons name="trending-up" size={14} color={colors.primary} />
          <Text style={styles.badgeText}>{POSTS.growthBadge}</Text>
        </View>
      </View>

      {post.parentCaption ? (
        <TouchableOpacity
          style={styles.parentCard}
          onPress={openParent}
          accessibilityRole="button"
          accessibilityLabel={`${POSTS.parentMoment}: ${post.parentCaption}`}
        >
          <Text style={styles.parentLabel}>{POSTS.parentMoment}</Text>
          <Text style={styles.parentCaption} numberOfLines={compact ? 2 : 3}>
            {post.parentCaption}
          </Text>
          {post.moodTag ? (
            <View style={styles.parentMood}>
              <MoodTagBadge mood={post.moodTag} />
            </View>
          ) : null}
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      gap: SPACING.xs,
    },
    containerCompact: {
      marginBottom: SPACING.xs,
    },
    badgeRow: {
      flexDirection: 'row',
    },
    badge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: SPACING.sm,
      paddingVertical: 2,
      borderRadius: BORDER_RADIUS.sm,
      backgroundColor: colors.selectedBackground,
    },
    badgeText: {
      fontSize: FONT_SIZES.xs,
      fontWeight: '700',
      color: colors.primary,
    },
    parentCard: {
      padding: SPACING.sm,
      borderRadius: BORDER_RADIUS.md,
      backgroundColor: colors.background,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderLeftWidth: 3,
      borderLeftColor: colors.primary,
    },
    parentLabel: {
      fontSize: FONT_SIZES.xs,
      fontWeight: '700',
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
      marginBottom: 4,
    },
    parentCaption: {
      fontSize: FONT_SIZES.sm,
      color: colors.textSecondary,
      lineHeight: 18,
    },
    parentMood: {
      marginTop: SPACING.xs,
    },
  });
}
