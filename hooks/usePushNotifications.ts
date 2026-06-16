import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { useAuthStore } from '@/store/authStore';
import { updateFcmToken } from '@/services/firebase/auth';
import { useNotificationStore } from '@/store/notificationStore';
import { getUnreadCount } from '@/services/firebase/notifications';
import { isFirebaseConfigured } from '@/services/firebase/config';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export function usePushNotifications() {
  const { firebaseUser } = useAuthStore();
  const { setUnreadCount } = useNotificationStore();

  useEffect(() => {
    if (!firebaseUser || !isFirebaseConfigured()) return;

    async function register() {
      if (!Device.isDevice) return;

      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') return;

      const token = (await Notifications.getExpoPushTokenAsync()).data;
      await updateFcmToken(firebaseUser!.uid, token);

      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.DEFAULT,
        });
      }
    }

    register();
    refreshUnreadCount();

    const subscription = Notifications.addNotificationReceivedListener(() => {
      refreshUnreadCount();
    });

    return () => subscription.remove();
  }, [firebaseUser]);

  async function refreshUnreadCount() {
    if (!firebaseUser) return;
    const count = await getUnreadCount(firebaseUser.uid);
    setUnreadCount(count);
  }

  return { refreshUnreadCount };
}
