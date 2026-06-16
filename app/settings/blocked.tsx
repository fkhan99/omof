import { FlatList, StyleSheet, Alert } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';
import { getBlockedUsers, unblockUser } from '@/services/firebase/safety';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import { View, Text } from 'react-native';
import { FONT_SIZES, SPACING, ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';

export default function BlockedUsersScreen() {
  const styles = useThemedStyles(createStyles);
  const { profile } = useAuthStore();
  const queryClient = useQueryClient();

  const { data: blockedUsers = [], isLoading } = useQuery({
    queryKey: ['blockedUsers', profile?.id],
    queryFn: () => getBlockedUsers(profile!.id),
    enabled: !!profile,
  });

  const unblockMutation = useMutation({
    mutationFn: (blockedId: string) => unblockUser(profile!.id, blockedId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blockedUsers'] });
    },
  });

  const handleUnblock = (blockedId: string, username: string) => {
    Alert.alert('Unblock user', `Unblock @${username}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Unblock', onPress: () => unblockMutation.mutate(blockedId) },
    ]);
  };

  if (isLoading) return <LoadingState />;

  if (blockedUsers.length === 0) {
    return (
      <EmptyState
        title="No blocked users"
        message="Users you block will appear here. You can unblock them at any time."
      />
    );
  }

  return (
    <FlatList
      data={blockedUsers}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.list}
      renderItem={({ item }) => (
        <View style={styles.item}>
          <Avatar uri={null} name={item.blockedDisplayName} size={44} />
          <View style={styles.info}>
            <Text style={styles.name}>{item.blockedDisplayName}</Text>
            <Text style={styles.username}>@{item.blockedUsername}</Text>
          </View>
          <Button
            title="Unblock"
            variant="secondary"
            size="sm"
            onPress={() => handleUnblock(item.blockedId, item.blockedUsername)}
            loading={unblockMutation.isPending}
          />
        </View>
      )}
    />
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    list: {
      padding: SPACING.md,
    },
    item: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: SPACING.md,
      backgroundColor: colors.surface,
      borderRadius: 12,
      marginBottom: SPACING.sm,
      gap: SPACING.md,
    },
    info: {
      flex: 1,
    },
    name: {
      fontSize: FONT_SIZES.md,
      fontWeight: '600',
      color: colors.text,
    },
    username: {
      fontSize: FONT_SIZES.sm,
      color: colors.textMuted,
    },
  });
}
