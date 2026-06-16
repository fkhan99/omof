import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { REACTION_LABELS } from '@/types';
import type { CreateNotificationData, NotificationType } from '@/types';
import { updateFcmToken } from '@/services/firebase/auth';
import { getUserById } from '@/services/firebase/users';

export function getExpoProjectId(): string | undefined {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  return extra?.eas?.projectId ?? Constants.easConfig?.projectId;
}

export async function ensureAndroidNotificationChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;

  await Notifications.setNotificationChannelAsync('default', {
    name: 'Activity',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#5C6B73',
  });
}

export function isExpoPushToken(token: string): boolean {
  return token.startsWith('ExponentPushToken[') || token.startsWith('ExpoPushToken[');
}

export async function registerForPushNotifications(userId: string): Promise<string | null> {
  if (!Device.isDevice) {
    console.log('[push] skipped — not a physical device');
    return null;
  }

  await ensureAndroidNotificationChannel();

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
      },
    });
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('[push] permission not granted');
    return null;
  }

  const projectId = getExpoProjectId();
  if (!projectId) {
    console.error('[push] missing EAS projectId — set extra.eas.projectId in app.json');
    return null;
  }

  const token = (
    await Notifications.getExpoPushTokenAsync({
      projectId,
    })
  ).data;

  if (!isExpoPushToken(token)) {
    console.warn('[push] unexpected token format', { tokenPrefix: token.slice(0, 24) });
  }

  await updateFcmToken(userId, token);
  console.log('[push] token registered', { userId, tokenPrefix: token.slice(0, 28) });

  return token;
}

export async function clearPushToken(userId: string): Promise<void> {
  await updateFcmToken(userId, null);
  console.log('[push] token cleared', { userId });
}

export type PushNotificationData = {
  type?: string;
  postId?: string;
  actorUsername?: string;
};

export function getRouteForPushData(data: PushNotificationData): string {
  const type = data.type;
  const actorUsername = data.actorUsername;
  const postId = data.postId;

  if (
    (type === 'follow' || type === 'follow_request' || type === 'follow_accepted')
    && actorUsername
  ) {
    return `/user/${actorUsername}`;
  }

  if (postId) {
    return `/post/${postId}`;
  }

  return '/(tabs)/notifications';
}

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
