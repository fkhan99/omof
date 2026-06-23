import { useCallback, useMemo, useState } from 'react';
import { View, FlatList, StyleSheet, RefreshControl, Text } from 'react-native';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';
import { getFeedPosts } from '@/services/firebase/posts';
import { getPromotedPosts } from '@/services/firebase/promotions';
import { buildFeedList, FeedListItem } from '@/utils/feedMerge';
import { getFollowingIds } from '@/services/firebase/follows';
import { getBlockedUserIds } from '@/services/firebase/safety';
import { PostCard } from '@/components/posts/PostCard';
import { LoadingState } from '@/components/ui/LoadingState';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { FEED } from '@/constants/copy';
import { POSTS_PAGE_SIZE, SPACING, FONT_SIZES, ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/hooks/useTheme';

export default function FeedScreen() {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const profile = useAuthStore((s) => s.profile);
  const [refreshing, setRefreshing] = useState(false);

  const { data: followingIds = [] } = useQuery({
    queryKey: ['followingIds', profile?.id],
    queryFn: () => getFollowingIds(profile!.id),
    enabled: !!profile?.id,
    staleTime: 0,
  });

  const {
    data,
    isLoading,
    error,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['feed', profile?.id],
    initialPageParam: null as Date | null,
    queryFn: async ({ pageParam }) => {
      if (!profile) return { feedItems: [] as FeedListItem[], hasMore: false, nextCursor: null as Date | null };

      const blockedIds = await getBlockedUserIds(profile.id);
      const filteredFollowing = followingIds.filter((id) => !blockedIds.includes(id));

      const [result, promotedPosts] = await Promise.all([
        getFeedPosts(filteredFollowing, POSTS_PAGE_SIZE, undefined, pageParam ?? undefined),
        pageParam ? Promise.resolve([]) : getPromotedPosts([profile.id], blockedIds),
      ]);

      const filteredPosts = result.items.filter(
        (p) => p.authorId !== profile.id && !blockedIds.includes(p.authorId),
      );

      const feedItems =
        pageParam === null
          ? buildFeedList(filteredPosts, promotedPosts.filter((p) => !blockedIds.includes(p.authorId)))
          : filteredPosts.map((post) => ({ type: 'post' as const, id: post.id, post: { ...post, isPromoted: false } }));

      return {
        feedItems,
        hasMore: result.hasMore,
        nextCursor: result.nextCursor ?? null,
      };
    },
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.nextCursor : undefined),
    enabled: !!profile,
  });

  const displayItems = useMemo(
    () => data?.pages.flatMap((page) => page.feedItems) ?? [],
    [data],
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const renderItem = useCallback(
    ({ item }: { item: FeedListItem }) => {
      if (item.type === 'header') {
        return (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{item.title}</Text>
            {item.subtitle ? <Text style={styles.sectionSubtitle}>{item.subtitle}</Text> : null}
          </View>
        );
      }
      return <PostCard post={item.post} />;
    },
    [styles],
  );

  if (!profile || isLoading) {
    return <LoadingState message={FEED.loading} />;
  }

  if (error) {
    return <ErrorState message={FEED.loadError} onRetry={() => refetch()} />;
  }

  return (
    <FlatList
      data={displayItems}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      contentContainerStyle={displayItems.length === 0 ? styles.emptyList : styles.list}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
      }
      ListEmptyComponent={
        <EmptyState
          icon="people-outline"
          title={FEED.emptyTitle}
          message={FEED.emptyMessage}
        />
      }
      onEndReached={() => {
        if (hasNextPage && !isFetchingNextPage) {
          void fetchNextPage();
        }
      }}
      onEndReachedThreshold={0.5}
      ListFooterComponent={
        isFetchingNextPage ? <LoadingState message={FEED.loadMore} /> : null
      }
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
    sectionHeader: {
      paddingHorizontal: SPACING.md,
      paddingTop: SPACING.md,
      paddingBottom: SPACING.sm,
      backgroundColor: colors.background,
    },
    sectionTitle: {
      fontSize: FONT_SIZES.sm,
      fontWeight: '700',
      color: colors.text,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    sectionSubtitle: {
      fontSize: FONT_SIZES.xs,
      color: colors.textMuted,
      marginTop: 4,
      lineHeight: 16,
    },
  });
}
