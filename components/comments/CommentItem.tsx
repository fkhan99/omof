import { memo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Comment } from '@/types';
import { Avatar } from '@/components/ui/Avatar';
import { FONT_SIZES, SPACING, ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { formatRelativeTime } from '@/utils';
import { RESPONSES } from '@/constants/copy';

interface CommentItemProps {
  comment: Comment;
  canDelete: boolean;
  isReply?: boolean;
  isDeleting?: boolean;
  onDelete?: () => void;
  onReport?: () => void;
  onReply?: () => void;
  showReplyAction?: boolean;
}

function CommentItemComponent({
  comment,
  canDelete,
  isReply = false,
  isDeleting,
  onDelete,
  onReport,
  onReply,
  showReplyAction = false,
}: CommentItemProps) {
  const styles = useThemedStyles(createStyles);

  return (
    <View style={[styles.container, isReply && styles.replyContainer]}>
      <Avatar uri={comment.authorPhotoURL} name={comment.authorDisplayName} size={isReply ? 28 : 36} />
      <View style={styles.content}>
        <View style={styles.bubble}>
          <Text style={styles.header}>
            <Text style={styles.author}>{comment.authorDisplayName}</Text>
            <Text style={styles.time}> · {formatRelativeTime(comment.createdAt)}</Text>
          </Text>
          {comment.replyToUsername ? (
            <Text style={styles.replyingTo}>
              Replying to @{comment.replyToUsername}
            </Text>
          ) : null}
          <Text style={styles.text}>{comment.text}</Text>
        </View>
        <View style={styles.actions}>
          {showReplyAction && onReply ? (
            <TouchableOpacity onPress={onReply} hitSlop={8}>
              <Text style={styles.actionText}>{RESPONSES.reply}</Text>
            </TouchableOpacity>
          ) : null}
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

export const CommentItem = memo(CommentItemComponent);

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flexDirection: 'row',
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
      gap: SPACING.sm,
    },
    replyContainer: {
      paddingLeft: SPACING.xl + SPACING.md,
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
    replyingTo: {
      fontSize: FONT_SIZES.xs,
      color: colors.primary,
      marginBottom: 2,
      fontWeight: '600',
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
