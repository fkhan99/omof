import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/store/authStore';
import { useNotificationStore } from '@/store/notificationStore';
import { getUnreadCount } from '@/services/firebase/notifications';
import { isFirebaseConfigured } from '@/services/firebase/config';
import {
  getRouteForPushData,
  registerForPushNotifications,
  PushNotificationData,
} from '@/utils/pushNotifications';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export function usePushNotifications() {
  const { firebaseUser } = useAuthStore();
  const { setUnreadCount } = useNotificationStore();
  const router = useRouter();
  const handledResponseIds = useRef(new Set<string>());

  useEffect(() => {
    if (!firebaseUser || !isFirebaseConfigured()) return;

    void registerForPushNotifications(firebaseUser.uid);
    void refreshUnreadCount();

    const receivedSub = Notifications.addNotificationReceivedListener(() => {
      void refreshUnreadCount();
    });

    const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
      const id = response.notification.request.identifier;
      if (handledResponseIds.current.has(id)) return;
      handledResponseIds.current.add(id);

      const data = (response.notification.request.content.data ?? {}) as PushNotificationData;
      const route = getRouteForPushData(data);
      console.log('[push] notification tapped', { route, data });
      router.push(route as never);
    });

    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (!response) return;
      const id = response.notification.request.identifier;
      if (handledResponseIds.current.has(id)) return;
      handledResponseIds.current.add(id);

      const data = (response.notification.request.content.data ?? {}) as PushNotificationData;
      const route = getRouteForPushData(data);
      router.push(route as never);
    });

    return () => {
      receivedSub.remove();
      responseSub.remove();
    };
  }, [firebaseUser, router]);

  async function refreshUnreadCount() {
    if (!firebaseUser) return;
    const count = await getUnreadCount(firebaseUser.uid);
    setUnreadCount(count);
    await Notifications.setBadgeCountAsync(count);
  }

  return { refreshUnreadCount };
}
