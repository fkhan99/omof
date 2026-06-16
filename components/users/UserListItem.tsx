import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { User } from '@/types';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { FONT_SIZES, SPACING, ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';

interface UserListItemProps {
  user: User;
  showFollowButton?: boolean;
  isFollowing?: boolean;
  isRequested?: boolean;
  onFollow?: () => void;
  onUnfollow?: () => void;
}

export function UserListItem({
  user,
  showFollowButton,
  isFollowing,
  isRequested,
  onFollow,
  onUnfollow,
}: UserListItemProps) {
  const router = useRouter();
  const styles = useThemedStyles(createStyles);

  const getFollowButtonTitle = () => {
    if (isFollowing) return 'Following';
    if (isRequested) return 'Requested';
    return user.isPrivate ? 'Request' : 'Follow';
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.main}
        onPress={() => router.push(`/user/${user.username}`)}
        accessibilityRole="button"
        accessibilityLabel={`View ${user.displayName}'s profile`}
      >
        <Avatar uri={user.photoURL} name={user.displayName} size={48} showRing />
        <View style={styles.info}>
          <Text style={styles.displayName}>{user.displayName}</Text>
          <Text style={styles.username}>@{user.username}</Text>
          {user.bio ? (
            <Text style={styles.bio} numberOfLines={1}>{user.bio}</Text>
          ) : null}
        </View>
      </TouchableOpacity>
      {showFollowButton ? (
        <Button
          title={getFollowButtonTitle()}
          variant={isFollowing || isRequested ? 'secondary' : 'primary'}
          size="sm"
          onPress={isFollowing || isRequested ? onUnfollow : onFollow}
        />
      ) : null}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.md,
      backgroundColor: colors.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
      gap: SPACING.md,
    },
    main: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
      minWidth: 0,
    },
    info: {
      flex: 1,
      minWidth: 0,
    },
    displayName: {
      fontSize: FONT_SIZES.sm,
      fontWeight: '700',
      color: colors.text,
    },
    username: {
      fontSize: FONT_SIZES.xs,
      color: colors.textMuted,
      marginTop: 1,
    },
    bio: {
      fontSize: FONT_SIZES.xs,
      color: colors.textSecondary,
      marginTop: 4,
    },
  });
}
