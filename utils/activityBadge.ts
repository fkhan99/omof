import { Notification } from '@/types';

/** Badge = unread activity + pending incoming follow requests (deduped from follow_request notifications). */
export function computeActivityBadgeCount(
  notifications: Notification[],
  pendingFollowRequestCount: number,
): number {
  const unreadNonFollowRequest = notifications.filter(
    (item) => !item.read && item.type !== 'follow_request',
  ).length;

  return unreadNonFollowRequest + pendingFollowRequestCount;
}
