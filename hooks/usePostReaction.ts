import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getUserReaction, setReaction } from '@/services/firebase/reactions';
import { useAuthStore } from '@/store/authStore';
import { ReactionType } from '@/types';

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
    mutationFn: (type: ReactionType) => setReaction(postId, userId!, type),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['post', postId] });
      queryClient.invalidateQueries({ queryKey: ['reaction', postId] });
      queryClient.invalidateQueries({ queryKey: ['feed'] });
    },
    onError: (error) => {
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
