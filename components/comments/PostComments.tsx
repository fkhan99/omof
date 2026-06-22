import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { getComments, addComment, deleteComment } from '@/services/firebase/comments';
import { useAuthStore } from '@/store/authStore';
import { commentSchema, CommentFormData } from '@/utils/validation';
import { Avatar } from '@/components/ui/Avatar';
import { Input } from '@/components/ui/Input';
import { CommentItem } from '@/components/comments/CommentItem';
import { Comment } from '@/types';
import { FONT_SIZES, SPACING, ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { containsProfanity } from '@/utils';
import { confirmAction } from '@/utils/confirm';
import { patchPostInCaches } from '@/lib/postQueryCache';

interface PostCommentsProps {
  postId: string;
  commentCount: number;
  variant?: 'feed' | 'detail';
}

export function PostComments({
  postId,
  commentCount,
  variant = 'feed',
}: PostCommentsProps) {
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const queryClient = useQueryClient();
  const profile = useAuthStore((s) => s.profile);
  const authUid = useAuthStore((s) => s.firebaseUser?.uid);
  const [commentError, setCommentError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(variant === 'detail');

  const {
    data: comments = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['comments', postId],
    queryFn: async () => {
      const result = await getComments(postId);
      return result.items;
    },
    enabled: !!postId && (variant === 'detail' || expanded || commentCount > 0),
  });

  const { control, handleSubmit, reset, watch, formState: { isSubmitting } } = useForm<CommentFormData>({
    resolver: zodResolver(commentSchema),
    defaultValues: { text: '' },
  });

  const commentText = watch('text');

  const addCommentMutation = useMutation({
    mutationFn: (text: string) =>
      addComment(
        postId,
        {
          id: authUid!,
          username: profile!.username,
          displayName: profile!.displayName,
          photoURL: profile!.photoURL,
        },
        text,
      ),
    onMutate: async (text) => {
      await queryClient.cancelQueries({ queryKey: ['comments', postId] });
      const previousComments = queryClient.getQueryData<Comment[]>(['comments', postId]) ?? [];

      const optimisticComment: Comment = {
        id: `optimistic-${Date.now()}`,
        postId,
        authorId: authUid!,
        authorUsername: profile!.username,
        authorDisplayName: profile!.displayName,
        authorPhotoURL: profile!.photoURL,
        text,
        createdAt: new Date(),
      };

      queryClient.setQueryData<Comment[]>(['comments', postId], [...previousComments, optimisticComment]);
      patchPostInCaches(queryClient, postId, (post) => ({
        ...post,
        commentCount: post.commentCount + 1,
      }));

      return { previousComments };
    },
    onError: (err, _text, context) => {
      if (context?.previousComments) {
        queryClient.setQueryData(['comments', postId], context.previousComments);
      }
      patchPostInCaches(queryClient, postId, (post) => ({
        ...post,
        commentCount: Math.max(0, post.commentCount - 1),
      }));
      setCommentError(err instanceof Error ? err.message : 'Failed to add comment');
    },
    onSuccess: () => {
      reset();
      setCommentError(null);
      setExpanded(true);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', postId] });
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      queryClient.invalidateQueries({ queryKey: ['post', postId] });
    },
  });

  const deleteCommentMutation = useMutation({
    mutationFn: (commentId: string) => deleteComment(commentId, postId),
    onMutate: async (commentId) => {
      await queryClient.cancelQueries({ queryKey: ['comments', postId] });
      const previousComments = queryClient.getQueryData<Comment[]>(['comments', postId]) ?? [];

      queryClient.setQueryData<Comment[]>(
        ['comments', postId],
        previousComments.filter((comment) => comment.id !== commentId),
      );
      patchPostInCaches(queryClient, postId, (post) => ({
        ...post,
        commentCount: Math.max(0, post.commentCount - 1),
      }));

      return { previousComments };
    },
    onError: (err, _commentId, context) => {
      if (context?.previousComments) {
        queryClient.setQueryData(['comments', postId], context.previousComments);
      }
      patchPostInCaches(queryClient, postId, (post) => ({
        ...post,
        commentCount: post.commentCount + 1,
      }));
      Alert.alert(
        'Delete failed',
        err instanceof Error ? err.message : 'Could not delete this comment.',
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', postId] });
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      queryClient.invalidateQueries({ queryKey: ['post', postId] });
    },
  });

  const onSubmitComment = async (data: CommentFormData) => {
    if (!profile || !authUid) return;
    setCommentError(null);

    if (containsProfanity(data.text)) {
      setCommentError('Please remove inappropriate language from your comment.');
      return;
    }

    addCommentMutation.mutate(data.text);
  };

  const handleDeleteComment = (commentId: string) => {
    confirmAction('Delete comment', 'Are you sure you want to delete this comment?', () => {
      deleteCommentMutation.mutate(commentId);
    });
  };

  const displayedCount = comments.length > 0 ? comments.length : commentCount;
  const showToggle = variant === 'feed' && commentCount > 0 && !expanded;

  return (
    <View style={[styles.container, variant === 'detail' && styles.containerDetail]}>
      {variant === 'detail' ? (
        <Text style={styles.sectionTitle}>Comments ({displayedCount})</Text>
      ) : null}

      {showToggle ? (
        <TouchableOpacity
          onPress={() => setExpanded(true)}
          accessibilityRole="button"
          accessibilityLabel={`View ${commentCount} comments`}
        >
          <Text style={styles.viewComments}>View {commentCount} comments</Text>
        </TouchableOpacity>
      ) : null}

      {expanded && isLoading ? (
        <Text style={styles.statusText}>Loading comments...</Text>
      ) : null}

      {expanded && isError ? (
        <View style={styles.statusBlock}>
          <Text style={styles.statusText}>Could not load comments.</Text>
          <TouchableOpacity onPress={() => refetch()}>
            <Text style={styles.retryLink}>Try again</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {expanded && !isLoading && !isError && comments.length === 0 ? (
        <Text style={styles.statusText}>No comments yet. Be the first to share support.</Text>
      ) : null}

      {expanded
        ? comments.map((comment) => {
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
          })
        : null}

      {profile ? (
        <View style={styles.inputRow}>
          <Avatar uri={profile.photoURL} name={profile.displayName} size={32} />
          <View style={styles.inputWrap}>
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
                  style={styles.input}
                  containerStyle={styles.inputContainer}
                />
              )}
            />
          </View>
          <TouchableOpacity
            onPress={handleSubmit(onSubmitComment)}
            disabled={isSubmitting || addCommentMutation.isPending || !commentText?.trim()}
            style={styles.postButton}
            accessibilityRole="button"
            accessibilityLabel="Post comment"
          >
            <Text
              style={[
                styles.postButtonText,
                (!commentText?.trim() || isSubmitting || addCommentMutation.isPending) &&
                  styles.postButtonDisabled,
              ]}
            >
              {isSubmitting || addCommentMutation.isPending ? '...' : 'Post'}
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {commentError ? (
        <Text style={styles.error} accessibilityRole="alert">
          {commentError}
        </Text>
      ) : null}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      marginTop: SPACING.xs,
    },
    containerDetail: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      backgroundColor: colors.surface,
      paddingBottom: SPACING.md,
      marginTop: 0,
    },
    sectionTitle: {
      fontSize: FONT_SIZES.sm,
      fontWeight: '700',
      color: colors.text,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.md,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    viewComments: {
      fontSize: FONT_SIZES.sm,
      color: colors.textMuted,
      marginBottom: SPACING.xs,
    },
    statusText: {
      fontSize: FONT_SIZES.sm,
      color: colors.textMuted,
      paddingBottom: SPACING.sm,
    },
    statusBlock: {
      gap: SPACING.xs,
      paddingBottom: SPACING.sm,
    },
    retryLink: {
      fontSize: FONT_SIZES.sm,
      color: colors.primary,
      fontWeight: '600',
    },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
      marginTop: SPACING.sm,
    },
    inputWrap: {
      flex: 1,
    },
    inputContainer: {
      marginBottom: 0,
    },
    input: {
      minHeight: 36,
      maxHeight: 80,
      paddingVertical: SPACING.sm,
      borderRadius: 18,
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
    error: {
      color: colors.danger,
      fontSize: FONT_SIZES.xs,
      marginTop: SPACING.xs,
    },
  });
}
