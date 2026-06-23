import { View, Text, StyleSheet } from 'react-native';
import { Post } from '@/types';
import { POSTS } from '@/constants/copy';
import { MoodTagBadge } from '@/components/ui/MoodTagBadge';
import { FONT_SIZES, SPACING, BORDER_RADIUS, ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';

interface OriginalMomentPreviewProps {
  post: Post;
}

export function OriginalMomentPreview({ post }: OriginalMomentPreviewProps) {
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{POSTS.parentMoment}</Text>
      <Text style={styles.caption}>{post.caption}</Text>
      <MoodTagBadge mood={post.moodTag} />
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      padding: SPACING.md,
      borderRadius: BORDER_RADIUS.md,
      backgroundColor: colors.surfaceMuted,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      gap: SPACING.sm,
    },
    label: {
      fontSize: FONT_SIZES.xs,
      fontWeight: '700',
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    caption: {
      fontSize: FONT_SIZES.sm,
      color: colors.textSecondary,
      lineHeight: 20,
    },
  });
}
