import { User } from '@/types';

export function canViewUserPosts(
  profileUser: User,
  viewerId: string | null | undefined,
  isFollowing: boolean,
): boolean {
  if (!viewerId || viewerId === profileUser.id) return true;
  if (!profileUser.isPrivate) return true;
  return isFollowing;
}
