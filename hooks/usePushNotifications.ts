import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/store/authStore';
import { useNotificationStore } from '@/store/notificationStore';
import { getUnreadCount } from '@/services/firebase/notifications';
import { isFirebaseConfigured } from '@/services/firebase/config';
import {
  getRouteForPushData,
  isPushSupportedPlatform,
  registerForPushNotifications,
  PushNotificationData,
} from '@/utils/pushRegistration';

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

export function usePushNotifications() {
  const { firebaseUser, profile } = useAuthStore();
  const { setUnreadCount } = useNotificationStore();
  const router = useRouter();
  const handledResponseIds = useRef(new Set<string>());

  useEffect(() => {
    if (!firebaseUser || !profile || !isFirebaseConfigured() || Platform.OS === 'web') return;

    function handleNotificationResponse(response: Notifications.NotificationResponse) {
      const id = response.notification.request.identifier;
      if (handledResponseIds.current.has(id)) return;
      handledResponseIds.current.add(id);

      const data = (response.notification.request.content.data ?? {}) as PushNotificationData;
      const route = getRouteForPushData(data);
      console.log('[push] notification tapped', { route, data });
      router.push(route as never);
    }

    registerForPushNotifications(firebaseUser.uid).catch((error) => {
      console.warn('[push] auto-registration failed', error);
    });
    void refreshUnreadCount();

    const receivedSub = Notifications.addNotificationReceivedListener(() => {
      void refreshUnreadCount();
    });

    const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
      handleNotificationResponse(response);
    });

    if (isPushSupportedPlatform()) {
      void Notifications.getLastNotificationResponseAsync().then((response) => {
        if (response) handleNotificationResponse(response);
      });
    }

    return () => {
      receivedSub.remove();
      responseSub.remove();
    };
  }, [firebaseUser, profile, router]);

  async function refreshUnreadCount() {
    if (!firebaseUser) return;
    const count = await getUnreadCount(firebaseUser.uid);
    setUnreadCount(count);
    if (Platform.OS !== 'web') {
      await Notifications.setBadgeCountAsync(count);
    }
  }

  return { refreshUnreadCount };
}
