import { View, StyleSheet, TouchableOpacity, FlatList, ListRenderItem } from 'react-native';
import type { ComponentType, ReactElement } from 'react';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Post } from '@/types';
import { PostMedia } from '@/components/posts/PostMedia';
import { isVideoPost } from '@/utils/posts';
import { SPACING, ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/hooks/useTheme';
import { PullRefreshFlatList } from '@/components/ui/PullRefreshFlatList';

const NUM_COLUMNS = 3;

interface PostGridProps {
  posts: Post[];
  ListHeaderComponent?: ComponentType<unknown> | ReactElement | null;
  ListEmptyComponent?: ComponentType<unknown> | ReactElement | null;
  ListFooterComponent?: ComponentType<unknown> | ReactElement | null;
  extraData?: unknown;
  refreshing?: boolean;
  onRefresh?: () => void | Promise<void>;
}

export function PostGrid({
  posts,
  ListHeaderComponent,
  ListEmptyComponent,
  ListFooterComponent,
  extraData,
  refreshing = false,
  onRefresh,
}: PostGridProps) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const router = useRouter();

  const renderItem: ListRenderItem<Post> = ({ item }) => (
    <TouchableOpacity
      style={styles.cell}
      onPress={() => router.push(`/post/${item.id}`)}
      accessibilityRole="button"
      accessibilityLabel="View post"
      activeOpacity={0.85}
    >
      <PostMedia post={item} mode="preview" />
      {isVideoPost(item) ? (
        <View style={styles.videoBadge} pointerEvents="none">
          <Ionicons name="play" size={14} color={colors.white} />
        </View>
      ) : null}
      {item.postKind === 'growth_update' ? (
        <View style={styles.growthBadge} pointerEvents="none">
          <Ionicons name="trending-up" size={12} color={colors.white} />
        </View>
      ) : null}
    </TouchableOpacity>
  );

  const listProps = {
    style: styles.list,
    contentContainerStyle: styles.content,
    data: posts,
    key: `post-grid-${NUM_COLUMNS}`,
    numColumns: NUM_COLUMNS,
    keyExtractor: (item: Post) => item.id,
    renderItem,
    ListHeaderComponent,
    ListEmptyComponent,
    ListFooterComponent,
    extraData,
    showsVerticalScrollIndicator: false,
  };

  if (onRefresh) {
    return (
      <PullRefreshFlatList
        {...listProps}
        refreshing={refreshing}
        onRefresh={onRefresh}
      />
    );
  }

  return <FlatList {...listProps} />;
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    list: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      flexGrow: 1,
      paddingBottom: SPACING.lg,
    },
    cell: {
      flex: 1,
      maxWidth: '33.33%',
      aspectRatio: 1,
      padding: 1,
      backgroundColor: colors.background,
      overflow: 'hidden',
    },
    videoBadge: {
      position: 'absolute',
      top: 6,
      right: 6,
    },
    growthBadge: {
      position: 'absolute',
      bottom: 6,
      left: 6,
      backgroundColor: 'rgba(192, 86, 33, 0.85)',
      borderRadius: 10,
      padding: 4,
    },
  });
}
