import { useCallback, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';
import { getFeedPosts } from '@/services/firebase/posts';
import { getPromotedPosts } from '@/services/firebase/promotions';
import { mergeFeedWithPromoted } from '@/utils/feedMerge';
import { getFollowingIds } from '@/services/firebase/follows';
import { getBlockedUserIds } from '@/services/firebase/safety';
import { PostCard } from '@/components/posts/PostCard';
import { LoadingState } from '@/components/ui/LoadingState';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { SPACING, ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/hooks/useTheme';

export default function FeedScreen() {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const profile = useAuthStore((s) => s.profile);
  const [refreshing, setRefreshing] = useState(false);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['feed', profile?.id],
    queryFn: async () => {
      if (!profile) return { items: [], hasMore: false };
      const [followingIds, blockedIds, promotedPosts] = await Promise.all([
        getFollowingIds(profile.id),
        getBlockedUserIds(profile.id),
        getPromotedPosts([profile.id], []),
      ]);
      const filteredFollowing = followingIds.filter((id) => !blockedIds.includes(id));
      const result = await getFeedPosts(filteredFollowing);
      const filteredPosts = result.items.filter(
        (p) => p.authorId !== profile.id && !blockedIds.includes(p.authorId),
      );
      const promotedFiltered = promotedPosts.filter((p) => !blockedIds.includes(p.authorId));
      const merged = mergeFeedWithPromoted(filteredPosts, promotedFiltered);
      return { ...result, items: merged };
    },
    enabled: !!profile,
  });

  const displayPosts = data?.items ?? [];

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const renderItem = useCallback(
    ({ item }: { item: (typeof displayPosts)[number] }) => <PostCard post={item} />,
    [],
  );

  // Profile not resolved yet (auth still initializing) — show a loader instead
  // of falsely telling the user their feed is empty.
  if (!profile || isLoading) {
    return <LoadingState message="Loading your feed..." />;
  }

  if (error) {
    return <ErrorState message="Couldn't load your feed." onRetry={() => refetch()} />;
  }

  return (
    <FlatList
      data={displayPosts}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      contentContainerStyle={displayPosts.length === 0 ? styles.emptyList : styles.list}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
      }
      ListEmptyComponent={
        <EmptyState
          icon="people-outline"
          title="Your feed is quiet"
          message="Follow people to see their posts here. Pull down to refresh. Your own posts appear on your profile."
        />
      }
      onEndReachedThreshold={0.5}
    />
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    list: {
      paddingBottom: SPACING.lg,
    },
    emptyList: {
      flexGrow: 1,
    },
  });
}
