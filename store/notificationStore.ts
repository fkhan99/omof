import { create } from 'zustand';
import { Notification } from '@/types';
import { getActivityReadKey } from '@/utils/activityRead';
import { computeActivityBadgeCount } from '@/utils/activityBadge';
import { upsertActivityNotification } from '@/services/firebase/activityFeed';

interface NotificationState {
  unreadCount: number;
  activityItems: Notification[];
  readKeysVersion: number;
  setUnreadCount: (count: number) => void;
  setActivityItems: (items: Notification[]) => void;
  syncActivityBadge: (pendingFollowRequestCount: number) => void;
  notifyReadKeysChanged: () => void;
  upsertActivityItem: (item: Notification) => void;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  unreadCount: 0,
  activityItems: [],
  readKeysVersion: 0,
  setUnreadCount: (unreadCount) => set({ unreadCount }),
  setActivityItems: (activityItems) => set({ activityItems }),
  syncActivityBadge: (pendingFollowRequestCount) => {
    set({
      unreadCount: computeActivityBadgeCount(get().activityItems, pendingFollowRequestCount),
    });
  },
  notifyReadKeysChanged: () => set((state) => ({ readKeysVersion: state.readKeysVersion + 1 })),
  upsertActivityItem: (item) =>
    set((state) => ({
      activityItems: upsertActivityNotification(state.activityItems, item),
    })),
}));

export function getActivityReadKeys(items: Notification[]): Set<string> {
  return new Set(items.map(getActivityReadKey));
}
