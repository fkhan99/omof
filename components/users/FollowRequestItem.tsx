import { View, Text, StyleSheet } from 'react-native';
import { FollowRequest } from '@/types';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { FONT_SIZES, SPACING, ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { formatRelativeTime } from '@/utils';

interface FollowRequestItemProps {
  request: FollowRequest;
  requesterName: string;
  requesterUsername: string;
  requesterPhotoURL: string | null;
  onAccept: () => void;
  onReject: () => void;
  loading?: boolean;
}

export function FollowRequestItem({
  request,
  requesterName,
  requesterUsername,
  requesterPhotoURL,
  onAccept,
  onReject,
  loading = false,
}: FollowRequestItemProps) {
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.item}>
      <Avatar uri={requesterPhotoURL} name={requesterName} size={48} showRing />
      <View style={styles.content}>
        <Text style={styles.message}>
          <Text style={styles.actorName}>@{requesterUsername}</Text>
          {' '}wants to follow you
        </Text>
        <Text style={styles.time}>{formatRelativeTime(request.createdAt)}</Text>
        <View style={styles.actions}>
          <Button
            title="Confirm"
            size="sm"
            onPress={onAccept}
            loading={loading}
            style={styles.confirmButton}
          />
          <Button
            title="Delete"
            variant="secondary"
            size="sm"
            onPress={onReject}
            disabled={loading}
            style={styles.rejectButton}
          />
        </View>
      </View>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    item: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.md,
      gap: SPACING.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
      backgroundColor: colors.surface,
    },
    content: {
      flex: 1,
      minWidth: 0,
    },
    message: {
      fontSize: FONT_SIZES.sm,
      color: colors.text,
      lineHeight: 20,
    },
    actorName: {
      fontWeight: '700',
      color: colors.text,
    },
    time: {
      fontSize: FONT_SIZES.xs,
      color: colors.textMuted,
      marginTop: SPACING.xs,
      marginBottom: SPACING.sm,
    },
    actions: {
      flexDirection: 'row',
      gap: SPACING.sm,
    },
    confirmButton: {
      flex: 1,
    },
    rejectButton: {
      flex: 1,
    },
  });
}
