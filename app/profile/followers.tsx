import { View, FlatList, StyleSheet } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';
import { getFollowerUsers } from '@/services/firebase/follows';
import { UserListItem } from '@/components/users/UserListItem';
import { LoadingState } from '@/components/ui/LoadingState';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { SPACING, ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';

export default function FollowersScreen() {
  const styles = useThemedStyles(createStyles);
  const { profile, firebaseUser } = useAuthStore();
  const authUid = firebaseUser?.uid;

  const {
    data: followerUsers = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['followerUsers', authUid],
    queryFn: () => getFollowerUsers(authUid!),
    enabled: !!authUid,
    staleTime: 0,
  });

  if (!profile || !authUid) return <LoadingState />;

  if (isLoading) return <LoadingState message="Loading followers..." />;

  if (isError) {
    return (
      <ErrorState
        message={error instanceof Error ? error.message : 'Could not load followers.'}
        onRetry={() => refetch()}
      />
    );
  }

  if (followerUsers.length === 0) {
    return (
      <EmptyState
        icon="people-outline"
        title="No followers yet"
        message="When people follow you, they'll show up here."
      />
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={followerUsers}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <UserListItem user={item} />}
        contentContainerStyle={styles.list}
      />
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    list: {
      paddingBottom: SPACING.lg,
    },
  });
}
