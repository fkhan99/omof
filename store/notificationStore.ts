import { create } from 'zustand';
import { Notification } from '@/types';
import { getActivityReadKey } from '@/utils/activityRead';
import { upsertActivityNotification } from '@/services/firebase/activityFeed';

interface NotificationState {
  unreadCount: number;
  activityItems: Notification[];
  readKeysVersion: number;
  setUnreadCount: (count: number) => void;
  setActivityItems: (items: Notification[]) => void;
  notifyReadKeysChanged: () => void;
  upsertActivityItem: (item: Notification) => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  unreadCount: 0,
  activityItems: [],
  readKeysVersion: 0,
  setUnreadCount: (unreadCount) => set({ unreadCount }),
  setActivityItems: (activityItems) => set({ activityItems }),
  notifyReadKeysChanged: () => set((state) => ({ readKeysVersion: state.readKeysVersion + 1 })),
  upsertActivityItem: (item) =>
    set((state) => {
      const activityItems = upsertActivityNotification(state.activityItems, item);
      const unreadCount = activityItems.filter(
        (entry) => !entry.read && entry.type !== 'follow_request',
      ).length;
      return { activityItems, unreadCount };
    }),
}));

export function getActivityReadKeys(items: Notification[]): Set<string> {
  return new Set(items.map(getActivityReadKey));
}
