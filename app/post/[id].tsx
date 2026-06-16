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
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { getPost, deletePost } from '@/services/firebase/posts';
import { getComments, addComment, deleteComment } from '@/services/firebase/comments';
import { getUserReaction, setReaction } from '@/services/firebase/reactions';
import { useAuthStore } from '@/store/authStore';
import { commentSchema, CommentFormData } from '@/utils/validation';
import { Avatar } from '@/components/ui/Avatar';
import { MoodTagBadge } from '@/components/ui/MoodTagBadge';
import { PostMedia } from '@/components/posts/PostMedia';
import { ReactionBar } from '@/components/reactions/ReactionBar';
import { CommentItem } from '@/components/comments/CommentItem';
import { Input } from '@/components/ui/Input';
import { LoadingState } from '@/components/ui/LoadingState';
import { ErrorState } from '@/components/ui/ErrorState';
import { containsProfanity } from '@/utils';
import { ReactionType, Comment, Post } from '@/types';
import { FONT_SIZES, SPACING, ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/hooks/useTheme';
import { formatRelativeTime, formatReactionCount } from '@/utils';
import { OptionsMenu } from '@/components/ui/OptionsMenu';
import { confirmAction } from '@/utils/confirm';
import { Ionicons } from '@expo/vector-icons';

export default function PostDetailScreen() {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { profile, firebaseUser } = useAuthStore();
  const queryClient = useQueryClient();
  const [commentError, setCommentError] = useState<string | null>(null);
  const [showPostMenu, setShowPostMenu] = useState(false);
  const authUid = firebaseUser?.uid;

  const { data: post, isLoading, error, refetch } = useQuery({
    queryKey: ['post', id],
    queryFn: () => getPost(id!),
    enabled: !!id,
  });

  const {
    data: comments = [],
    isLoading: commentsLoading,
    isError: commentsError,
    refetch: refetchComments,
  } = useQuery({
    queryKey: ['comments', id],
    queryFn: async () => {
      const result = await getComments(id!);
      return result.items;
    },
    enabled: !!id,
  });

  const { data: userReaction } = useQuery({
    queryKey: ['reaction', id, profile?.id],
    queryFn: () => getUserReaction(id!, profile!.id),
    enabled: !!id && !!profile,
  });

  const reactionMutation = useMutation({
    mutationFn: (type: ReactionType) => setReaction(id!, profile!.id, type),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['post', id] });
      queryClient.invalidateQueries({ queryKey: ['reaction', id] });
    },
  });

  const { control, handleSubmit, reset, watch, formState: { isSubmitting } } = useForm<CommentFormData>({
    resolver: zodResolver(commentSchema),
    defaultValues: { text: '' },
  });

  const commentText = watch('text');

  const onSubmitComment = async (data: CommentFormData) => {
    if (!profile || !authUid) return;
    setCommentError(null);

    if (containsProfanity(data.text)) {
      setCommentError('Please remove inappropriate language from your comment.');
      return;
    }

    try {
      await addComment(id!, {
        id: authUid!,
        username: profile.username,
        displayName: profile.displayName,
        photoURL: profile.photoURL,
      }, data.text);
      reset();
      queryClient.invalidateQueries({ queryKey: ['comments', id] });
      queryClient.invalidateQueries({ queryKey: ['post', id] });
    } catch (err) {
      setCommentError(err instanceof Error ? err.message : 'Failed to add comment');
    }
  };

  const deleteCommentMutation = useMutation({
    mutationFn: (commentId: string) => deleteComment(commentId, id!),
    onMutate: async (commentId) => {
      await queryClient.cancelQueries({ queryKey: ['comments', id] });
      const previousComments = queryClient.getQueryData<Comment[]>(['comments', id]);

      queryClient.setQueryData<Comment[]>(['comments', id], (old) =>
        old?.filter((comment) => comment.id !== commentId) ?? [],
      );

      const previousPost = queryClient.getQueryData<Post>(['post', id]);
      if (previousPost) {
        queryClient.setQueryData(['post', id], {
          ...previousPost,
          commentCount: Math.max(0, previousPost.commentCount - 1),
        });
      }

      return { previousComments, previousPost };
    },
    onError: (err, _commentId, context) => {
      if (context?.previousComments) {
        queryClient.setQueryData(['comments', id], context.previousComments);
      }
      if (context?.previousPost) {
        queryClient.setQueryData(['post', id], context.previousPost);
      }
      Alert.alert(
        'Delete failed',
        err instanceof Error ? err.message : 'Could not delete this comment.',
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', id] });
      queryClient.invalidateQueries({ queryKey: ['post', id] });
      queryClient.invalidateQueries({ queryKey: ['activity'] });
    },
  });

  const handleDeleteComment = (commentId: string) => {
    confirmAction('Delete comment', 'Are you sure you want to delete this comment?', () => {
      deleteCommentMutation.mutate(commentId);
    });
  };

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
          <MoodTagBadge mood={post.moodTag} />

          {totalReactions > 0 ? (
            <Text style={styles.reactionCount}>{formatReactionCount(totalReactions)}</Text>
          ) : null}

          <Text style={styles.caption}>
            <Text style={styles.captionUser}>{post.authorUsername} </Text>
            {post.caption}
          </Text>

          <ReactionBar
            userReaction={userReaction?.type ?? null}
            onReact={(type) => profile && reactionMutation.mutate(type)}
          />
        </View>

        <View style={styles.commentsSection}>
          <Text style={styles.commentsTitle}>
            Comments ({comments.length > 0 ? comments.length : post.commentCount})
          </Text>

          {commentsLoading ? (
            <Text style={styles.commentsStatus}>Loading comments...</Text>
          ) : null}

          {commentsError ? (
            <View style={styles.commentsStatusBlock}>
              <Text style={styles.commentsStatus}>Could not load comments.</Text>
              <TouchableOpacity onPress={() => refetchComments()}>
                <Text style={styles.retryLink}>Try again</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {!commentsLoading && !commentsError && comments.length === 0 ? (
            <Text style={styles.commentsStatus}>No comments yet. Be the first to share support.</Text>
          ) : null}

          {comments.map((comment) => {
            const canDelete = !!authUid && comment.authorId === authUid;

            return (
              <CommentItem
                key={comment.id}
                comment={comment}
                canDelete={canDelete}
                isDeleting={
                  deleteCommentMutation.isPending &&
                  deleteCommentMutation.variables === comment.id
                }
                onDelete={() => handleDeleteComment(comment.id)}
                onReport={() =>
                  router.push({
                    pathname: '/report',
                    params: { targetType: 'comment', targetId: comment.id },
                  })
                }
              />
            );
          })}
        </View>
      </ScrollView>

      {profile && (
        <View style={styles.commentBar}>
          <Avatar uri={profile.photoURL} name={profile.displayName} size={36} />
          <View style={styles.commentInputWrap}>
            <Controller
              control={control}
              name="text"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  placeholder="Add a comment..."
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  multiline
                  style={styles.commentInput}
                  containerStyle={styles.commentInputContainer}
                />
              )}
            />
          </View>
          <TouchableOpacity
            onPress={handleSubmit(onSubmitComment)}
            disabled={isSubmitting || !commentText?.trim()}
            style={styles.postButton}
            accessibilityRole="button"
            accessibilityLabel="Post comment"
          >
            <Text
              style={[
                styles.postButtonText,
                (!commentText?.trim() || isSubmitting) && styles.postButtonDisabled,
              ]}
            >
              {isSubmitting ? '...' : 'Post'}
            </Text>
          </TouchableOpacity>
        </View>
      )}
      {commentError ? <Text style={styles.commentBarError}>{commentError}</Text> : null}

      <OptionsMenu
        visible={showPostMenu}
        title="Post options"
        onClose={() => setShowPostMenu(false)}
        options={[
          {
            label: 'Promote post',
            onPress: () => router.push(`/post/promote/${id}`),
          },
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
    commentsSection: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      backgroundColor: colors.surface,
      paddingBottom: SPACING.md,
    },
    commentsTitle: {
      fontSize: FONT_SIZES.sm,
      fontWeight: '700',
      color: colors.text,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.md,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    commentsStatus: {
      fontSize: FONT_SIZES.sm,
      color: colors.textMuted,
      paddingHorizontal: SPACING.md,
      paddingBottom: SPACING.md,
    },
    commentsStatusBlock: {
      paddingHorizontal: SPACING.md,
      paddingBottom: SPACING.md,
      gap: SPACING.xs,
    },
    retryLink: {
      fontSize: FONT_SIZES.sm,
      color: colors.primary,
      fontWeight: '600',
    },
    commentBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      backgroundColor: colors.surface,
    },
    commentInputWrap: {
      flex: 1,
    },
    commentInputContainer: {
      marginBottom: 0,
    },
    commentInput: {
      minHeight: 40,
      maxHeight: 100,
      paddingVertical: SPACING.sm,
      borderRadius: 20,
    },
    postButton: {
      paddingHorizontal: SPACING.xs,
      paddingVertical: SPACING.sm,
    },
    postButtonText: {
      fontSize: FONT_SIZES.sm,
      fontWeight: '700',
      color: colors.primary,
    },
    postButtonDisabled: {
      opacity: 0.4,
    },
    commentBarError: {
      color: colors.danger,
      fontSize: FONT_SIZES.xs,
      paddingHorizontal: SPACING.md,
      paddingBottom: SPACING.sm,
      backgroundColor: colors.surface,
    },
  });
}
