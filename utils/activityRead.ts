import { Notification } from '@/types';

export function getActivityReadKey(notification: Notification): string {
  switch (notification.type) {
    case 'follow':
      return `follow:${notification.actorId}`;
    case 'follow_request':
      return `follow_request:${notification.actorId}`;
    case 'follow_accepted':
      return `follow_accepted:${notification.actorId}`;
    case 'comment':
      return `comment:${notification.commentId ?? `${notification.actorId}:${notification.postId}`}`;
    case 'reaction':
    case 'like':
      return `reaction:${notification.actorId}:${notification.postId}`;
    default:
      return notification.id;
  }
}

export function applyPersistedReadState(
  items: Notification[],
  readKeys: Set<string>,
): Notification[] {
  return items.map((item) => {
    const key = getActivityReadKey(item);
    return {
      ...item,
      read: item.read || readKeys.has(key),
    };
  });
}
