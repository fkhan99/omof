import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getUserReaction, toggleReaction } from '@/services/firebase/reactions';
import { useAuthStore } from '@/store/authStore';
import { Reaction, ReactionType } from '@/types';

export function usePostReaction(postId: string) {
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

      return { previous };
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
      console.error('[reactions] failed to save reaction', error);
    },
  });

  return {
    userReaction: userReaction?.type ?? null,
    react: (type: ReactionType) => {
      if (userId) mutation.mutate(type);
    },
    isReacting: mutation.isPending,
  };
}
