import { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  getComments,
  addComment,
  deleteComment,
  CommentReplyTarget,
} from '@/services/firebase/comments';
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
import { RESPONSES } from '@/constants/copy';
import { patchPostInCaches } from '@/lib/postQueryCache';

interface PostCommentsProps {
  postId: string;
  commentCount: number;
  variant?: 'feed' | 'detail';
}

function groupComments(comments: Comment[]) {
  const topLevel = comments.filter((comment) => !comment.parentCommentId);
  const repliesByParent = new Map<string, Comment[]>();

  comments.forEach((comment) => {
    if (!comment.parentCommentId) return;
    const bucket = repliesByParent.get(comment.parentCommentId) ?? [];
    bucket.push(comment);
    repliesByParent.set(comment.parentCommentId, bucket);
  });

  return { topLevel, repliesByParent };
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
  const [replyTarget, setReplyTarget] = useState<CommentReplyTarget | null>(null);
  const [showBlockedModal, setShowBlockedModal] = useState(false);
  const [blockedMessage, setBlockedMessage] = useState<string | undefined>();
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [showGrowthModal, setShowGrowthModal] = useState(false);
  const [pendingCommentText, setPendingCommentText] = useState<string | null>(null);

  const {
    data: comments = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['comments', postId],
    queryFn: async () => {
      const result = await getComments(postId, undefined, undefined, authUid);
      return result.items;
    },
    enabled: !!postId && (variant === 'detail' || expanded || commentCount > 0),
  });

  const { topLevel, repliesByParent } = useMemo(() => groupComments(comments), [comments]);

  const { control, handleSubmit, reset, watch, formState: { isSubmitting } } = useForm<CommentFormData>({
    resolver: zodResolver(commentSchema),
    defaultValues: { text: '' },
  });

  const commentText = watch('text');
  const inputPlaceholder = replyTarget
    ? RESPONSES.replyPlaceholder(replyTarget.replyToUsername)
    : RESPONSES.placeholder;

  const addCommentMutation = useMutation({
    mutationFn: (payload: {
      text: string;
      moderation: ReturnType<typeof evaluatePrePublish>['moderationFields'];
      replyTo?: CommentReplyTarget;
    }) =>
      addComment(
        postId,
        {
          id: authUid!,
          username: profile!.username,
          displayName: profile!.displayName,
          photoURL: profile!.photoURL,
        },
        payload.text,
        payload.moderation,
        payload.replyTo,
      ),
    onMutate: async ({ text, replyTo, moderation }) => {
      if (moderation.isHidden) {
        return { previousComments: queryClient.getQueryData<Comment[]>(['comments', postId]) ?? [] };
      }

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
        parentCommentId: replyTo?.parentCommentId ?? null,
        replyToUserId: replyTo?.replyToUserId ?? null,
        replyToUsername: replyTo?.replyToUsername ?? null,
        moderationStatus: moderation.moderationStatus,
        moderationReason: moderation.moderationReason,
        moderationConfidence: moderation.moderationConfidence,
        reviewRequired: moderation.reviewRequired,
        isHidden: moderation.isHidden,
        reportCount: moderation.reportCount ?? 0,
        createdAt: new Date(),
      };

      queryClient.setQueryData<Comment[]>(['comments', postId], [...previousComments, optimisticComment]);
      patchPostInCaches(queryClient, postId, (post) => ({
        ...post,
        commentCount: post.commentCount + 1,
      }));

      return { previousComments };
    },
    onError: (err, _payload, context) => {
      if (context?.previousComments) {
        queryClient.setQueryData(['comments', postId], context.previousComments);
      }
      patchPostInCaches(queryClient, postId, (post) => ({
        ...post,
        commentCount: Math.max(0, post.commentCount - 1),
      }));
      setCommentError(err instanceof Error ? err.message : RESPONSES.addError);
    },
    onSuccess: (_data, variables) => {
      reset();
      setCommentError(null);
      setReplyTarget(null);
      setExpanded(true);
      if (variables.moderation.reviewRequired) {
        Alert.alert('Submitted for review', MODERATION_COPY.commentReviewPending);
      }
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

  const submitComment = (
    text: string,
    options: { submitForReview?: boolean; reflectionApplied?: boolean } = {},
  ) => {
    const evaluation = evaluatePrePublish(text, options);
    if (!evaluation.canPublish) {
      if (evaluation.blockedMessage) {
        setBlockedMessage(evaluation.blockedMessage);
        setShowBlockedModal(true);
        return;
      }
      if (evaluation.requiresSupportFlow) {
        setPendingCommentText(text);
        setShowSupportModal(true);
        return;
      }
      if (evaluation.requiresGrowthFlow) {
        setPendingCommentText(text);
        setShowGrowthModal(true);
        return;
      }
      return;
    }

    addCommentMutation.mutate({
      text: evaluation.caption,
      moderation: evaluation.moderationFields,
      replyTo: replyTarget ?? undefined,
    });
  };

  const onSubmitComment = async (data: CommentFormData) => {
    if (!profile || !authUid) return;
    setCommentError(null);
    submitComment(data.text);
  };

  const handleDeleteComment = (commentId: string) => {
    confirmAction(RESPONSES.deleteTitle, RESPONSES.deleteMessage, () => {
      deleteCommentMutation.mutate(commentId);
    });
  };

  const handleReply = (comment: Comment) => {
    if (!authUid || comment.authorId === authUid) return;
    setReplyTarget({
      parentCommentId: comment.parentCommentId ?? comment.id,
      replyToUserId: comment.authorId,
      replyToUsername: comment.authorUsername,
    });
    setExpanded(true);
  };

  const displayedCount = comments.length > 0 ? comments.length : commentCount;
  const showExpandToggle = variant === 'feed' && commentCount > 0 && !expanded;
  const showHideToggle = variant === 'feed' && expanded && commentCount > 0;

  const renderComment = (comment: Comment, isReply = false) => {
    const canDelete = !!authUid && comment.authorId === authUid;
    const showReplyAction = !!authUid && comment.authorId !== authUid;

    return (
      <CommentItem
        key={comment.id}
        comment={comment}
        isReply={isReply}
        canDelete={canDelete}
        showReplyAction={showReplyAction}
        isDeleting={
          deleteCommentMutation.isPending &&
          deleteCommentMutation.variables === comment.id
        }
        onDelete={() => handleDeleteComment(comment.id)}
        onReply={() => handleReply(comment)}
        onReport={() =>
          router.push({
            pathname: '/report',
            params: { targetType: 'comment', targetId: comment.id },
          })
        }
      />
    );
  };

  return (
    <View style={[styles.container, variant === 'detail' && styles.containerDetail]}>
      {variant === 'detail' ? (
        <Text style={styles.sectionTitle}>{RESPONSES.sectionTitle(displayedCount)}</Text>
      ) : null}

      {showExpandToggle ? (
        <TouchableOpacity
          onPress={() => setExpanded(true)}
          accessibilityRole="button"
          accessibilityLabel={RESPONSES.view(commentCount)}
        >
          <Text style={styles.viewComments}>{RESPONSES.view(commentCount)}</Text>
        </TouchableOpacity>
      ) : null}

      {showHideToggle ? (
        <TouchableOpacity
          onPress={() => {
            setExpanded(false);
            setReplyTarget(null);
          }}
          accessibilityRole="button"
          accessibilityLabel={RESPONSES.hide}
        >
          <Text style={styles.viewComments}>{RESPONSES.hide}</Text>
        </TouchableOpacity>
      ) : null}

      {expanded && isLoading ? (
        <Text style={styles.statusText}>{RESPONSES.loading}</Text>
      ) : null}

      {expanded && isError ? (
        <View style={styles.statusBlock}>
          <Text style={styles.statusText}>{RESPONSES.loadError}</Text>
          <TouchableOpacity onPress={() => refetch()}>
            <Text style={styles.retryLink}>Try again</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {expanded && !isLoading && !isError && comments.length === 0 ? (
        <Text style={styles.statusText}>{RESPONSES.empty}</Text>
      ) : null}

      {expanded
        ? topLevel.map((comment) => (
            <View key={comment.id}>
              {renderComment(comment)}
              {(repliesByParent.get(comment.id) ?? []).map((reply) => renderComment(reply, true))}
            </View>
          ))
        : null}

      {profile ? (
        <View style={styles.inputSection}>
          {replyTarget ? (
            <View style={styles.replyBanner}>
              <Text style={styles.replyBannerText}>
                {RESPONSES.replyPlaceholder(replyTarget.replyToUsername)}
              </Text>
              <TouchableOpacity onPress={() => setReplyTarget(null)} hitSlop={8}>
                <Text style={styles.replyCancel}>{RESPONSES.replyCancel}</Text>
              </TouchableOpacity>
            </View>
          ) : null}
          <View style={styles.inputRow}>
            <Avatar uri={profile.photoURL} name={profile.displayName} size={32} />
            <View style={styles.inputWrap}>
              <Controller
                control={control}
                name="text"
                render={({ field: { onChange, onBlur, value } }) => (
                  <Input
                    placeholder={inputPlaceholder}
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
              accessibilityLabel={RESPONSES.postA11y}
            >
              <Text
                style={[
                  styles.postButtonText,
                  (!commentText?.trim() || isSubmitting || addCommentMutation.isPending) &&
                    styles.postButtonDisabled,
                ]}
              >
                {isSubmitting || addCommentMutation.isPending ? '...' : RESPONSES.postButton}
              </Text>
            </TouchableOpacity>
          </View>
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
      fontWeight: '600',
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
    inputSection: {
      marginTop: SPACING.sm,
    },
    replyBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: SPACING.xs,
      gap: SPACING.sm,
    },
    replyBannerText: {
      flex: 1,
      fontSize: FONT_SIZES.xs,
      color: colors.textSecondary,
    },
    replyCancel: {
      fontSize: FONT_SIZES.xs,
      color: colors.primary,
      fontWeight: '700',
    },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
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
