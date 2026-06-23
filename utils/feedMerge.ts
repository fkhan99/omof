import { Post, PostWithPromotion } from '@/types';

export type FeedListItem =
  | { type: 'header'; id: string; title: string; subtitle?: string }
  | { type: 'post'; id: string; post: PostWithPromotion };

/**
 * Build a feed list with labeled sections — spotlight first, then chronological connections.
 */
export function buildFeedList(
  feedPosts: Post[],
  promotedPosts: PostWithPromotion[],
): FeedListItem[] {
  const promotedIds = new Set(promotedPosts.map((p) => p.id));
  const regular = feedPosts.filter((p) => !promotedIds.has(p.id));
  const items: FeedListItem[] = [];

  if (promotedPosts.length > 0) {
    items.push({
      type: 'header',
      id: 'header-spotlight',
      title: 'Community spotlight',
      subtitle: 'Optional promoted posts — your circle feed below stays chronological.',
    });
    for (const post of promotedPosts) {
      items.push({ type: 'post', id: `promoted-${post.id}`, post: { ...post, isPromoted: true } });
    }
  }

  if (regular.length > 0) {
    items.push({
      type: 'header',
      id: 'header-connections',
      title: 'From your connections',
    });
    for (const post of regular) {
      items.push({ type: 'post', id: post.id, post: { ...post, isPromoted: false } });
    }
  }

  return items;
}

/** @deprecated Use buildFeedList for sectioned feeds. */
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
