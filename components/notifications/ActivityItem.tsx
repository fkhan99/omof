import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { Notification } from '@/types';
import { Avatar } from '@/components/ui/Avatar';
import { getActivityActionText } from '@/utils/notifications';
import { FONT_SIZES, SPACING, BORDER_RADIUS, ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { formatRelativeTime } from '@/utils';

interface ActivityItemProps {
  notification: Notification;
  onPress: () => void;
}

export function ActivityItem({ notification, onPress }: ActivityItemProps) {
  const styles = useThemedStyles(createStyles);
  const actionText = getActivityActionText(notification);

  return (
    <TouchableOpacity
      style={[styles.item, !notification.read && styles.unread]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${notification.actorUsername} ${actionText}`}
    >
      <Avatar
        uri={notification.actorPhotoURL}
        name={notification.actorDisplayName}
        size={48}
        showRing
      />

      <View style={styles.content}>
        <Text style={styles.message}>
          <Text style={styles.actorName}>{notification.actorUsername}</Text>
          {' '}
          {actionText}
        </Text>
        <Text style={styles.time}>{formatRelativeTime(notification.createdAt)}</Text>
      </View>

      {notification.postImageURL ? (
        <Image
          source={{ uri: notification.postImageURL }}
          style={styles.thumbnail}
          contentFit="cover"
          accessibilityLabel="Related post"
        />
      ) : null}

      {!notification.read ? <View style={styles.unreadDot} /> : null}
    </TouchableOpacity>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    item: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.md,
      gap: SPACING.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
      backgroundColor: colors.surface,
    },
    unread: {
      backgroundColor: colors.accentSoft + '55',
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
    },
    thumbnail: {
      width: 48,
      height: 48,
      borderRadius: BORDER_RADIUS.sm,
      backgroundColor: colors.surfaceMuted,
    },
    unreadDot: {
      position: 'absolute',
      right: SPACING.md,
      top: '50%',
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.danger,
      marginTop: -4,
    },
  });
}
