import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getPost, deletePost } from '@/services/firebase/posts';
import { useAuthStore } from '@/store/authStore';
import { usePostReaction } from '@/hooks/usePostReaction';
import { usePostLiveCounts } from '@/hooks/usePostLiveCounts';
import { Avatar } from '@/components/ui/Avatar';
import { MoodTagBadge } from '@/components/ui/MoodTagBadge';
import { PostMedia } from '@/components/posts/PostMedia';
import { ReactionBar } from '@/components/reactions/ReactionBar';
import { PostComments } from '@/components/comments/PostComments';
import { LoadingState } from '@/components/ui/LoadingState';
import { ErrorState } from '@/components/ui/ErrorState';
import { FONT_SIZES, SPACING, ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/hooks/useTheme';
import { formatRelativeTime, formatReactionCount } from '@/utils';
import { GrowthUpdateCard } from '@/components/posts/GrowthUpdateCard';
import { POSTS } from '@/constants/copy';
import { Button } from '@/components/ui/Button';
import { OptionsMenu } from '@/components/ui/OptionsMenu';
import { confirmAction } from '@/utils/confirm';
import { Ionicons } from '@expo/vector-icons';

export default function PostDetailScreen() {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { firebaseUser } = useAuthStore();
  const queryClient = useQueryClient();
  const [showPostMenu, setShowPostMenu] = useState(false);
  const authUid = firebaseUser?.uid;

  const { data: post, isLoading, error, refetch } = useQuery({
    queryKey: ['post', id],
    queryFn: () => getPost(id!),
    enabled: !!id,
  });

  usePostLiveCounts(id);
  const { userReaction, react } = usePostReaction(id!, post?.authorId);

  const handleDeletePost = () => {
    if (!authUid) return;
    confirmAction('Delete post', 'Are you sure you want to delete this post?', async () => {
      try {
        await deletePost(id!, authUid!);
        queryClient.invalidateQueries({ queryKey: ['myPosts'] });
        queryClient.invalidateQueries({ queryKey: ['authorPosts'] });
        queryClient.invalidateQueries({ queryKey: ['feed'] });
        queryClient.invalidateQueries({ queryKey: ['activity'] });
        router.back();
      } catch (err) {
        Alert.alert(
          'Delete failed',
          err instanceof Error ? err.message : 'Could not delete this post.',
        );
      }
    });
  };

  const handlePostOptions = () => {
    setShowPostMenu(true);
  };

  const handleReportPost = () => {
    router.push({ pathname: '/report', params: { targetType: 'post', targetId: id } });
  };

  if (isLoading) return <LoadingState />;
  if (error || !post) return <ErrorState message="Post not found." onRetry={() => refetch()} />;

  const isOwnPost = authUid === post.authorId;
  const isOriginalMoment = post.postKind !== 'growth_update';
  const totalReactions =
    post.reactionCounts.relate +
    post.reactionCounts.been_there +
    post.reactionCounts.sending_support;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
    >
      <ScrollView
        style={styles.scroll}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
      >
        <View style={styles.authorRow}>
          <TouchableOpacity
            style={styles.authorMain}
            onPress={() => router.push(`/user/${post.authorUsername}`)}
            accessibilityRole="button"
            accessibilityLabel={`View profile of ${post.authorDisplayName}`}
          >
            <Avatar uri={post.authorPhotoURL} name={post.authorDisplayName} size={40} showRing />
            <View style={styles.headerText}>
              <Text style={styles.authorName}>{post.authorDisplayName}</Text>
              <Text style={styles.meta}>@{post.authorUsername}</Text>
            </View>
          </TouchableOpacity>

          <View style={styles.authorAside}>
            <Text style={styles.time}>{formatRelativeTime(post.createdAt)}</Text>
            <TouchableOpacity
              style={styles.menuButton}
              onPress={isOwnPost ? handlePostOptions : handleReportPost}
              accessibilityRole="button"
              accessibilityLabel={isOwnPost ? 'Post options' : 'Report post'}
              hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
            >
              <Ionicons name="ellipsis-horizontal" size={22} color={colors.text} />
            </TouchableOpacity>
          </View>
        </View>

        <PostMedia post={post} mode="player" />

        <View style={styles.body}>
          {post.postKind === 'growth_update' ? <GrowthUpdateCard post={post} /> : null}
          <MoodTagBadge mood={post.moodTag} />

          {totalReactions > 0 ? (
            <Text style={styles.reactionCount}>{formatReactionCount(totalReactions)}</Text>
          ) : null}

          <Text style={styles.caption}>
            <Text style={styles.captionUser}>{post.authorUsername} </Text>
            {post.caption}
          </Text>

          <ReactionBar userReaction={userReaction} onReact={react} disabled={isOwnPost} />

          {isOwnPost && isOriginalMoment ? (
            <Button
              title={POSTS.shareGrowthUpdate}
              variant="secondary"
              size="sm"
              onPress={() => router.push(`/post/growth/${post.id}`)}
              style={styles.growthButton}
            />
          ) : null}
        </View>

        <PostComments postId={post.id} commentCount={post.commentCount} variant="detail" />
      </ScrollView>

      <OptionsMenu
        visible={showPostMenu}
        title="Post options"
        onClose={() => setShowPostMenu(false)}
        options={[
          {
            label: 'Edit post',
            onPress: () => router.push(`/post/edit/${id}`),
          },
          {
            label: 'Delete post',
            destructive: true,
            onPress: handleDeletePost,
          },
        ]}
      />
    </KeyboardAvoidingView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scroll: {
      flex: 1,
    },
    authorRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm + 2,
      backgroundColor: colors.surface,
      gap: SPACING.sm,
    },
    authorMain: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      minWidth: 0,
    },
    authorAside: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.xs,
      flexShrink: 0,
    },
    menuButton: {
      padding: SPACING.xs,
    },
    headerText: {
      marginLeft: SPACING.sm,
      flex: 1,
    },
    authorName: {
      fontSize: FONT_SIZES.sm,
      fontWeight: '700',
      color: colors.text,
    },
    meta: {
      fontSize: FONT_SIZES.xs,
      color: colors.textMuted,
      marginTop: 1,
    },
    time: {
      fontSize: FONT_SIZES.xs,
      color: colors.textMuted,
    },
    body: {
      paddingHorizontal: SPACING.md,
      paddingTop: SPACING.sm,
      paddingBottom: SPACING.sm,
      backgroundColor: colors.surface,
      gap: SPACING.xs,
    },
    reactionCount: {
      fontSize: FONT_SIZES.sm,
      fontWeight: '700',
      color: colors.text,
    },
    caption: {
      fontSize: FONT_SIZES.sm,
      color: colors.text,
      lineHeight: 20,
    },
    captionUser: {
      fontWeight: '700',
      color: colors.text,
    },
    growthButton: {
      marginTop: SPACING.sm,
      alignSelf: 'flex-start',
    },
  });
}
