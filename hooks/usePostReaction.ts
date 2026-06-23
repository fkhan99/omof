import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getUserReaction, toggleReaction } from '@/services/firebase/reactions';
import { useAuthStore } from '@/store/authStore';
import { Reaction, ReactionType } from '@/types';
import { applyReactionCountDelta, patchPostInCaches } from '@/lib/postQueryCache';

export function usePostReaction(postId: string, postAuthorId?: string) {
  const { firebaseUser } = useAuthStore();
  const queryClient = useQueryClient();
  const userId = firebaseUser?.uid;

  const { data: userReaction } = useQuery({
    queryKey: ['reaction', postId, userId],
    queryFn: () => getUserReaction(postId, userId!),
    enabled: !!postId && !!userId,
  });

  const mutation = useMutation({
    mutationFn: (type: ReactionType) => toggleReaction(postId, userId!, type),
    onMutate: async (type) => {
      await queryClient.cancelQueries({ queryKey: ['reaction', postId, userId] });
      const previous = queryClient.getQueryData<Reaction | null>(['reaction', postId, userId]);
      const previousType = previous?.type ?? null;
      const nextType = previousType === type ? null : type;

      if (previous?.type === type) {
        queryClient.setQueryData(['reaction', postId, userId], null);
      } else {
        queryClient.setQueryData(['reaction', postId, userId], {
          id: previous?.id ?? `${postId}_${userId}`,
          postId,
          userId: userId!,
          type,
          createdAt: previous?.createdAt ?? new Date(),
          updatedAt: new Date(),
        } satisfies Reaction);
      }

      patchPostInCaches(queryClient, postId, (post) =>
        applyReactionCountDelta(post, previousType, nextType),
      );

      return { previous, previousType, nextType };
    },
    onSuccess: (result) => {
      queryClient.setQueryData(['reaction', postId, userId], result);
      queryClient.invalidateQueries({ queryKey: ['post', postId] });
      queryClient.invalidateQueries({ queryKey: ['feed'] });
    },
    onError: (error, _type, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(['reaction', postId, userId], context.previous);
      }
      if (context?.previousType !== undefined && context?.nextType !== undefined) {
        patchPostInCaches(queryClient, postId, (post) =>
          applyReactionCountDelta(post, context.nextType, context.previousType),
        );
      }
      console.error('[reactions] failed to save reaction', error);
    },
  });

  return {
    userReaction: userReaction?.type ?? null,
    react: (type: ReactionType) => {
      if (!userId) return;
      if (postAuthorId && postAuthorId === userId) return;
      mutation.mutate(type);
    },
    isReacting: mutation.isPending,
  };
}
