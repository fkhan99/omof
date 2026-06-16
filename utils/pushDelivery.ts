import { REACTION_LABELS } from '@/types';
import type { CreateNotificationData, NotificationType } from '@/types';
import { getUserById } from '@/services/firebase/users';
import { isExpoPushToken, type PushNotificationData } from '@/utils/pushRegistration';

export function buildPushNotificationBody(data: {
  type: NotificationType;
  actorUsername: string;
  commentText?: string | null;
  reactionType?: string | null;
}): string {
  switch (data.type) {
    case 'comment':
      return `${data.actorUsername} commented: ${data.commentText ?? ''}`;
    case 'reaction': {
      const label = data.reactionType
        ? REACTION_LABELS[data.reactionType as keyof typeof REACTION_LABELS] ?? 'reacted to'
        : 'reacted to';
      return `${data.actorUsername} ${label} your post`;
    }
    case 'like':
      return `${data.actorUsername} liked your post`;
    case 'follow':
      return `${data.actorUsername} followed you`;
    case 'follow_request':
      return `${data.actorUsername} requested to follow you`;
    case 'follow_accepted':
      return `${data.actorUsername} accepted your follow request`;
    default:
      return `${data.actorUsername} sent you a notification`;
  }
}

export async function sendExpoPushNotification(
  expoPushToken: string,
  title: string,
  body: string,
  data: PushNotificationData = {},
): Promise<boolean> {
  if (!isExpoPushToken(expoPushToken)) {
    console.warn('[push] skipped send — token is not an Expo push token');
    return false;
  }

  const payload = {
    to: expoPushToken,
    title,
    body,
    data: Object.fromEntries(
      Object.entries(data)
        .filter(([, value]) => value != null && value !== '')
        .map(([key, value]) => [key, String(value)]),
    ),
    sound: 'default' as const,
    channelId: 'default',
    priority: 'high' as const,
  };

  try {
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.warn('[push] Expo API HTTP error', {
        status: response.status,
        statusText: response.statusText,
      });
      return false;
    }

    const result = (await response.json()) as {
      data?: Array<{ status: string; message?: string; details?: { error?: string } }>;
    };
    const ticket = result.data?.[0];

    if (!ticket || ticket.status === 'error') {
      console.warn('[push] Expo push failed', ticket);
      return false;
    }

    console.log('[push] sent', { title, body });
    return true;
  } catch (error) {
    console.warn('[push] Expo push request failed', error);
    return false;
  }
}

export async function dispatchPushForNotification(data: CreateNotificationData): Promise<void> {
  const recipient = await getUserById(data.recipientId);
  if (!recipient?.fcmToken) {
    console.log('[push] skipped — recipient has no token', { recipientId: data.recipientId });
    return;
  }

  const body = buildPushNotificationBody(data);
  await sendExpoPushNotification(recipient.fcmToken, 'OMOF', body, {
    type: data.type,
    postId: data.postId ?? '',
    actorUsername: data.actorUsername,
  });
}
