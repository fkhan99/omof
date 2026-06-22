import { useEffect } from 'react';
import { Tabs, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Platform, StyleSheet } from 'react-native';
import { useNotificationStore } from '@/store/notificationStore';
import { useAuthStore } from '@/store/authStore';
import { useTheme } from '@/hooks/useTheme';
import { TabBarIconWithBadge } from '@/components/navigation/TabBarIconWithBadge';
import { OmofWordmark } from '@/components/branding/OmofWordmark';

type TabIconName = keyof typeof Ionicons.glyphMap;

const TAB_ICONS: Record<string, { active: TabIconName; inactive: TabIconName }> = {
  index: { active: 'home', inactive: 'home-outline' },
  search: { active: 'search', inactive: 'search-outline' },
  create: { active: 'add-circle', inactive: 'add-circle-outline' },
  notifications: { active: 'notifications', inactive: 'notifications-outline' },
  profile: { active: 'person-circle', inactive: 'person-circle-outline' },
};

export default function TabLayout() {
  const unreadCount = useNotificationStore((s) => s.unreadCount);
  const { colors } = useTheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.text,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
          marginBottom: Platform.OS === 'ios' ? 0 : 4,
        },
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: StyleSheet.hairlineWidth,
          height: Platform.OS === 'ios' ? 88 : 64,
          paddingTop: 8,
        },
        headerStyle: {
          backgroundColor: colors.surface,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
        headerTintColor: colors.text,
        headerTitleStyle: {
          color: colors.text,
          fontWeight: '700',
          fontSize: 18,
        },
        headerShadowVisible: false,
        headerRight: () => <OmofWordmark />,
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Feed',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? TAB_ICONS.index.active : TAB_ICONS.index.inactive}
              size={26}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: 'Search',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? TAB_ICONS.search.active : TAB_ICONS.search.inactive}
              size={26}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="create"
        options={{
          title: 'Share',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? TAB_ICONS.create.active : TAB_ICONS.create.inactive}
              size={28}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: 'Activity',
          tabBarBadge: undefined,
          tabBarIcon: ({ color, focused }) => (
            <TabBarIconWithBadge
              name={focused ? TAB_ICONS.notifications.active : TAB_ICONS.notifications.inactive}
              color={color}
              badgeCount={unreadCount}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? TAB_ICONS.profile.active : TAB_ICONS.profile.inactive}
              size={26}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}
