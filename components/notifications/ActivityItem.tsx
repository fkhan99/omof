import { memo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Notification } from '@/types';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { getActivityActionText, isSystemNotification } from '@/utils/notifications';
import { ACTIVITY } from '@/constants/copy';
import { FONT_SIZES, SPACING, BORDER_RADIUS, ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/hooks/useTheme';
import { formatRelativeTime } from '@/utils';

interface ActivityItemProps {
  notification: Notification;
  onPress: () => void;
  showConnectBack?: boolean;
  connectBackLoading?: boolean;
  onConnectBack?: () => void;
}

function ActivityItemComponent({
  notification,
  onPress,
  showConnectBack = false,
  connectBackLoading = false,
  onConnectBack,
}: ActivityItemProps) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const actionText = getActivityActionText(notification);
  const isSystem = isSystemNotification(notification);

  if (isSystem) {
    return (
      <TouchableOpacity
        style={[styles.item, !notification.read && styles.unread]}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={actionText}
      >
        <View style={styles.systemIcon}>
          <Ionicons name="alert-circle" size={28} color={colors.danger} />
        </View>

        <View style={styles.content}>
          <Text style={styles.message}>{actionText}</Text>
          <Text style={styles.time}>{formatRelativeTime(notification.createdAt)}</Text>
        </View>

        {!notification.read ? <View style={styles.unreadDot} /> : null}
      </TouchableOpacity>
    );
  }

  return (
    <View style={[styles.item, !notification.read && styles.unread]}>
      <TouchableOpacity
        style={styles.mainPressable}
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

      {showConnectBack && onConnectBack ? (
        <Button
          title={ACTIVITY.connectBack}
          size="sm"
          onPress={onConnectBack}
          loading={connectBackLoading}
          style={styles.connectBackButton}
        />
      ) : null}
    </View>
  );
}

export const ActivityItem = memo(ActivityItemComponent);

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
    mainPressable: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
      minWidth: 0,
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
    systemIcon: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.dangerSoft,
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
    connectBackButton: {
      minWidth: 108,
    },
  });
}
