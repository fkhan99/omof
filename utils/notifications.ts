import { Notification, REACTION_LABELS, ReactionType } from '@/types';

export function getActivityActionText(notification: Notification): string {
  switch (notification.type) {
    case 'follow':
      return 'started following you';
    case 'follow_request':
      return 'requested to follow you';
    case 'follow_accepted':
      return 'accepted your follow request';
    case 'comment':
      return `commented: ${notification.commentText ?? ''}`;
    case 'reaction': {
      const label = notification.reactionType
        ? REACTION_LABELS[notification.reactionType as ReactionType]
        : null;
      return label
        ? `reacted with "${label}" to your post`
        : 'reacted to your post';
    }
    case 'like':
      return 'liked your post';
    case 'post_removed':
      return 'Your post was removed after being flagged by multiple people for violating community guidelines.';
    default:
      return 'interacted with you';
  }
}

/** System notifications have no acting user and render as a standalone message. */
export function isSystemNotification(notification: Notification): boolean {
  return notification.type === 'post_removed';
}

export function getActivityMessage(notification: Notification): string {
  return `${notification.actorUsername} ${getActivityActionText(notification)}`;
}
