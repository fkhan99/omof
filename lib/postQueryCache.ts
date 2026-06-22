import { QueryClient } from '@tanstack/react-query';
import { Post, PostWithPromotion, ReactionType } from '@/types';

type FeedData = { items: PostWithPromotion[]; hasMore?: boolean };

export function patchPostInCaches(
  queryClient: QueryClient,
  postId: string,
  patch: (post: Post) => Post,
): void {
  queryClient.setQueriesData<FeedData>({ queryKey: ['feed'] }, (old) => {
    if (!old?.items) return old;
    return {
      ...old,
      items: old.items.map((post) => (post.id === postId ? patch(post) : post)),
    };
  });

  queryClient.setQueryData<Post>(['post', postId], (old) => (old ? patch(old) : old));

  queryClient.setQueriesData<{ items: Post[]; hasMore?: boolean }>(
    { queryKey: ['myPosts'] },
    (old) => {
      if (!old?.items) return old;
      return {
        ...old,
        items: old.items.map((post) => (post.id === postId ? patch(post) : post)),
      };
    },
  );

  queryClient.setQueriesData<{ items: Post[]; hasMore?: boolean }>(
    { queryKey: ['authorPosts'] },
    (old) => {
      if (!old?.items) return old;
      return {
        ...old,
        items: old.items.map((post) => (post.id === postId ? patch(post) : post)),
      };
    },
  );
}

export function applyReactionCountDelta(
  post: Post,
  previousType: ReactionType | null,
  nextType: ReactionType | null,
): Post {
  const counts = { ...post.reactionCounts };
  if (previousType) {
    counts[previousType] = Math.max(0, counts[previousType] - 1);
  }
  if (nextType) {
    counts[nextType] = (counts[nextType] ?? 0) + 1;
  }
  return { ...post, reactionCounts: counts };
}
