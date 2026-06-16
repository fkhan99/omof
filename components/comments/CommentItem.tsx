import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Comment } from '@/types';
import { Avatar } from '@/components/ui/Avatar';
import { FONT_SIZES, SPACING, ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { formatRelativeTime } from '@/utils';

interface CommentItemProps {
  comment: Comment;
  canDelete: boolean;
  isDeleting?: boolean;
  onDelete?: () => void;
  onReport?: () => void;
}

export function CommentItem({ comment, canDelete, isDeleting, onDelete, onReport }: CommentItemProps) {
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.container}>
      <Avatar uri={comment.authorPhotoURL} name={comment.authorDisplayName} size={36} />
      <View style={styles.content}>
        <View style={styles.bubble}>
          <Text style={styles.header}>
            <Text style={styles.author}>{comment.authorDisplayName}</Text>
            <Text style={styles.time}> · {formatRelativeTime(comment.createdAt)}</Text>
          </Text>
          <Text style={styles.text}>{comment.text}</Text>
        </View>
        <View style={styles.actions}>
          {canDelete && onDelete ? (
            <TouchableOpacity onPress={onDelete} disabled={isDeleting} hitSlop={8}>
              <Text style={[styles.actionText, styles.deleteText]}>
                {isDeleting ? 'Deleting...' : 'Delete'}
              </Text>
            </TouchableOpacity>
          ) : null}
          {!canDelete && onReport ? (
            <TouchableOpacity onPress={onReport} hitSlop={8}>
              <Text style={styles.actionText}>Report</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flexDirection: 'row',
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
      gap: SPACING.sm,
    },
    content: {
      flex: 1,
    },
    bubble: {
      backgroundColor: colors.surfaceMuted,
      borderRadius: 18,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
    },
    header: {
      marginBottom: 2,
    },
    author: {
      fontSize: FONT_SIZES.sm,
      fontWeight: '700',
      color: colors.text,
    },
    time: {
      fontSize: FONT_SIZES.xs,
      color: colors.textMuted,
    },
    text: {
      fontSize: FONT_SIZES.sm,
      color: colors.text,
      lineHeight: 20,
    },
    actions: {
      flexDirection: 'row',
      marginTop: SPACING.xs,
      marginLeft: SPACING.sm,
      gap: SPACING.md,
    },
    actionText: {
      fontSize: FONT_SIZES.xs,
      color: colors.textMuted,
      fontWeight: '600',
    },
    deleteText: {
      color: colors.danger,
    },
  });
}
