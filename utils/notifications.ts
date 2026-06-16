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
    default:
      return 'interacted with you';
  }
}

export function getActivityMessage(notification: Notification): string {
  return `${notification.actorUsername} ${getActivityActionText(notification)}`;
}
