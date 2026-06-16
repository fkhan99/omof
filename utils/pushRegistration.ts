import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { updateFcmToken } from '@/services/firebase/pushToken';

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

export function isPushSupportedPlatform(): boolean {
  return Platform.OS !== 'web' && Device.isDevice;
}

export async function registerForPushNotifications(userId: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    console.log('[push] skipped — web platform');
    return null;
  }

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
