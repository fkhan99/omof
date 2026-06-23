import { Post } from '@/types';

export function isVideoPost(post: Post): boolean {
  return post.mediaType === 'video' && !!post.videoURL;
}

/** @deprecated Separate growth_update child posts — hidden from feeds/grids. */
export function isStandaloneGrowthPost(post: Post): boolean {
  return post.postKind === 'growth_update' && !!post.parentPostId;
}

export function hasGrowthUpdate(post: Post): boolean {
  return Boolean(post.growthCaption?.trim());
}

export function filterPrimaryPosts(posts: Post[]): Post[] {
  return posts.filter((post) => !isStandaloneGrowthPost(post));
}

export function getPostPreviewURL(post: Post): string {
  return post.imageURL;
}

/** Legacy video posts stored the author's profile photo when thumbnail extraction failed. */
export function needsVideoThumbnailRegen(post: Post): boolean {
  if (!isVideoPost(post)) return false;
  if (post.imageURL.includes('_thumb')) return false;
  if (post.authorPhotoURL && post.imageURL === post.authorPhotoURL) return true;
  if (post.imageURL.includes('/profiles/') || post.imageURL.includes('%2Fprofiles%2F')) {
    return true;
  }
  return false;
}
