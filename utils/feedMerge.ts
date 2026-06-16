import { Post, PostWithPromotion } from '@/types';

/**
 * Merge promoted posts into a feed list — promoted items appear first, deduped by post id.
 */
export function mergeFeedWithPromoted(
  feedPosts: Post[],
  promotedPosts: PostWithPromotion[],
): PostWithPromotion[] {
  const promotedIds = new Set(promotedPosts.map((p) => p.id));
  const regular = feedPosts
    .filter((p) => !promotedIds.has(p.id))
    .map((p) => ({ ...p, isPromoted: false }));

  return [...promotedPosts, ...regular];
}
