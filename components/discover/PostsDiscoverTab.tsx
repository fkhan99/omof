import { useCallback, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { getPostsByMoodTag } from '@/services/firebase/posts';
import { getBlockedUserIds } from '@/services/firebase/safety';
import { PostCard } from '@/components/posts/PostCard';
import { MoodFilterBar } from '@/components/shared/MoodFilterBar';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import { PullRefreshFlatList } from '@/components/ui/PullRefreshFlatList';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { DISCOVER_MODES } from '@/constants/copy';
import { SPACING, FONT_SIZES, ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { MoodTag, User } from '@/types';

interface PostsDiscoverTabProps {
  authUid: string | undefined;
  profile: User | null;
  followingIds: string[];
}

export function PostsDiscoverTab({ authUid, profile, followingIds }: PostsDiscoverTabProps) {
  const styles = useThemedStyles(createStyles);
  const copy = DISCOVER_MODES.posts;
  const [selectedMood, setSelectedMood] = useState<MoodTag | 'all' | 'growth'>('all');

  const moodTag = selectedMood !== 'all' && selectedMood !== 'growth' ? selectedMood : null;
  const postKind = selectedMood === 'growth' ? ('growth_update' as const) : null;

  const { data: sharedPosts = [], isLoading, refetch } = useQuery({
    queryKey: ['sharedExperiences', authUid, selectedMood],
    queryFn: async () => {
      if (!profile) return [];
      const blockedIds = await getBlockedUserIds(profile.id);
      const result = await getPostsByMoodTag(moodTag, profile.id, followingIds, blockedIds, {
        postKind,
      });
      return result.items;
    },
    enabled: !!authUid,
  });

  const onRefreshPosts = useCallback(async () => {
    if (!profile) return;
    await refetch({ cancelRefetch: false });
  }, [profile, refetch]);
  const { refreshing, onRefresh: handleRefreshPosts } = usePullToRefresh(onRefreshPosts);

  const renderHeader = () => (
    <View>
      <View style={styles.header}>
        <Text style={styles.title}>{copy.title}</Text>
        <Text style={styles.subtitle}>{copy.subtitle}</Text>
      </View>
      <MoodFilterBar selectedMood={selectedMood} onSelect={setSelectedMood} />
    </View>
  );

  if (isLoading) {
    return (
      <View style={styles.container}>
        {renderHeader()}
        <LoadingState message={copy.loading} />
      </View>
    );
  }

  return (
    <PullRefreshFlatList
      data={sharedPosts}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={renderHeader}
      renderItem={({ item }) => <PostCard post={{ ...item, isPromoted: false }} variant="card" />}
      contentContainerStyle={styles.list}
      keyboardShouldPersistTaps="handled"
      refreshing={refreshing}
      onRefresh={handleRefreshPosts}
      extraData={selectedMood}
      ListEmptyComponent={
        <EmptyState icon="heart-outline" title={copy.emptyTitle} message={copy.emptyMessage} />
      }
    />
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
    },
    list: {
      paddingBottom: SPACING.xl,
    },
    header: {
      paddingHorizontal: SPACING.md,
      paddingTop: SPACING.xs,
      paddingBottom: SPACING.xs,
    },
    title: {
      fontSize: FONT_SIZES.lg,
      fontWeight: '700',
      color: colors.text,
    },
    subtitle: {
      fontSize: FONT_SIZES.sm,
      color: colors.textMuted,
      marginTop: 4,
      lineHeight: 20,
    },
  });
}
