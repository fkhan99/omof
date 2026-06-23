import { Notification, REACTION_LABELS, ReactionType } from '@/types';
import { ACTIVITY } from '@/constants/copy';

export function getActivityActionText(notification: Notification): string {
  switch (notification.type) {
    case 'follow':
      return ACTIVITY.follow;
    case 'follow_request':
      return ACTIVITY.followRequest;
    case 'follow_accepted':
      return ACTIVITY.followAccepted;
    case 'comment':
      return ACTIVITY.commented(notification.commentText ?? '');
    case 'reaction': {
      const label = notification.reactionType
        ? REACTION_LABELS[notification.reactionType as ReactionType]
        : null;
      return label ? ACTIVITY.reacted(label) : ACTIVITY.reactedGeneric;
    }
    case 'like':
      return ACTIVITY.reactedGeneric;
    case 'growth_update':
      return ACTIVITY.growthUpdate;
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
