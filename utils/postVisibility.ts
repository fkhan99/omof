import { Post } from '@/types';
import { getUserById } from '@/services/firebase/users';

/**
 * Filter posts for a viewer — public authors, connections, or own posts only.
 */
export async function filterPostsForViewer(
  posts: Post[],
  viewerId: string,
  followingIds: string[],
  blockedIds: string[],
): Promise<Post[]> {
  const followingSet = new Set(followingIds);
  const blockedSet = new Set(blockedIds);
  const authorCache = new Map<string, boolean>();

  const visible: Post[] = [];

  for (const post of posts) {
    if (blockedSet.has(post.authorId)) continue;
    if (post.authorId === viewerId) {
      visible.push(post);
      continue;
    }

    let isPublic = authorCache.get(post.authorId);
    if (isPublic === undefined) {
      const author = await getUserById(post.authorId);
      isPublic = author ? !author.isPrivate : false;
      authorCache.set(post.authorId, isPublic);
    }

    if (isPublic || followingSet.has(post.authorId)) {
      visible.push(post);
    }
  }

  return visible;
}
