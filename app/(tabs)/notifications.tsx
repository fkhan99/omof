import { useCallback, useRef, useState } from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  View,
  Text,
  Alert,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';
import {
  loadActivityFeed,
  markNotificationRead,
  markAllNotificationsRead,
} from '@/services/firebase/notifications';
import {
  acceptFollowRequest,
  rejectFollowRequest,
  getIncomingFollowRequestsWithRequesters,
  FollowRequestWithRequester,
} from '@/services/firebase/followRequests';
import { followUser } from '@/services/firebase/follows';
import { useNotificationStore } from '@/store/notificationStore';
import { ActivityItem } from '@/components/notifications/ActivityItem';
import { FollowRequestItem } from '@/components/users/FollowRequestItem';
import { LoadingState } from '@/components/ui/LoadingState';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { PullRefreshFlatList } from '@/components/ui/PullRefreshFlatList';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { Notification } from '@/types';
import { computeActivityBadgeCount } from '@/utils/activityBadge';
import { adjustFollowCountsOptimistically, invalidateFollowSideEffects } from '@/utils/followCache';
import { FONT_SIZES, SPACING, ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { getActivityReadKey } from '@/utils/activityRead';

function isConnectBackEligible(notification: Notification) {
  return notification.type === 'follow' || notification.type === 'follow_accepted';
}

export default function ActivityScreen() {
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const firebaseUser = useAuthStore((s) => s.firebaseUser);
  const notifications = useNotificationStore((state) => state.activityItems);
  const setActivityItems = useNotificationStore((state) => state.setActivityItems);
  const setUnreadCount = useNotificationStore((state) => state.setUnreadCount);
  const notifyReadKeysChanged = useNotificationStore((state) => state.notifyReadKeysChanged);
  const queryClient = useQueryClient();
  const authUid = firebaseUser?.uid;
  const [activeRequestId, setActiveRequestId] = useState<string | null>(null);
  const [connectBackTargetId, setConnectBackTargetId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [markingAllRead, setMarkingAllRead] = useState(false);
  const followRequestCountRef = useRef(0);

  const { data: followingIds = [] } = useQuery({
    queryKey: ['followingIds', authUid],
    queryFn: async () => {
      const { getFollowingIds } = await import('@/services/firebase/follows');
      return getFollowingIds(authUid!);
    },
    enabled: !!authUid,
    staleTime: 0,
  });

  const { data: followRequests = [] } = useQuery({
    queryKey: ['followRequests', authUid],
    queryFn: () => getIncomingFollowRequestsWithRequesters(authUid!),
    enabled: !!authUid,
    staleTime: 0,
  });

  followRequestCountRef.current = followRequests.length;

  const loadActivity = useCallback(async () => {
    if (!authUid) return;
    setLoadError(null);
    try {
      const items = await loadActivityFeed(authUid);
      setActivityItems(items);
      setUnreadCount(computeActivityBadgeCount(items, followRequestCountRef.current));
      queryClient.setQueryData(['activity', authUid], items);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Couldn't load activity.");
    } finally {
      setIsLoading(false);
    }
  }, [authUid, queryClient, setActivityItems, setUnreadCount]);

  const { refreshing, onRefresh: handleRefresh } = usePullToRefresh(loadActivity);

  useFocusEffect(
    useCallback(() => {
      if (!authUid) return;
      void loadActivity();
    }, [authUid, loadActivity]),
  );

  const updateBadgeCount = useCallback(
    (items: Notification[]) => {
      setUnreadCount(computeActivityBadgeCount(items, followRequests.length));
    },
    [followRequests.length, setUnreadCount],
  );

  const markReadMutation = useMutation({
    mutationFn: markNotificationRead,
    onSuccess: (_data, notification) => {
      const next = useNotificationStore.getState().activityItems.map((item) =>
        getActivityReadKey(item) === getActivityReadKey(notification)
          ? { ...item, read: true }
          : item,
      );
      setActivityItems(next);
      updateBadgeCount(next);
      notifyReadKeysChanged();
    },
  });

  const acceptMutation = useMutation({
    mutationFn: (requesterId: string) => acceptFollowRequest(authUid!, requesterId),
    onMutate: (requesterId) => {
      setActiveRequestId(requesterId);
      queryClient.setQueryData<FollowRequestWithRequester[]>(
        ['followRequests', authUid],
        (old) => old?.filter((item) => item.request.requesterId !== requesterId) ?? [],
      );
    },
    onSuccess: (_data, requesterId) => {
      adjustFollowCountsOptimistically(queryClient, requesterId, authUid!, {
        followingDelta: 1,
        followerDelta: 1,
      });
      updateBadgeCount(useNotificationStore.getState().activityItems);
    },
    onSettled: () => {
      setActiveRequestId(null);
      queryClient.invalidateQueries({ queryKey: ['isFollowing'] });
      queryClient.invalidateQueries({ queryKey: ['followRequested'] });
      queryClient.invalidateQueries({ queryKey: ['followRequestedIds'] });
      queryClient.invalidateQueries({ queryKey: ['followingIds'] });
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      queryClient.invalidateQueries({ queryKey: ['user'] });
      queryClient.invalidateQueries({ queryKey: ['followRequests', authUid] });
    },
    onError: (err) => {
      queryClient.invalidateQueries({ queryKey: ['followRequests', authUid] });
      Alert.alert(
        'Could not confirm request',
        err instanceof Error ? err.message : 'Please try again.',
      );
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (requesterId: string) => rejectFollowRequest(authUid!, requesterId),
    onMutate: (requesterId) => {
      setActiveRequestId(requesterId);
      queryClient.setQueryData<FollowRequestWithRequester[]>(
        ['followRequests', authUid],
        (old) => old?.filter((item) => item.request.requesterId !== requesterId) ?? [],
      );
      updateBadgeCount(useNotificationStore.getState().activityItems);
    },
    onError: (err) => {
      queryClient.invalidateQueries({ queryKey: ['followRequests', authUid] });
      Alert.alert(
        'Could not decline request',
        err instanceof Error ? err.message : 'Please try again.',
      );
    },
    onSettled: () => {
      setActiveRequestId(null);
      queryClient.invalidateQueries({ queryKey: ['followRequests', authUid] });
    },
  });

  const connectBackMutation = useMutation({
    mutationFn: (targetUserId: string) => followUser(authUid!, targetUserId),
    onMutate: (targetUserId) => {
      setConnectBackTargetId(targetUserId);
    },
    onSuccess: (_data, targetUserId) => {
      adjustFollowCountsOptimistically(queryClient, authUid!, targetUserId, {
        followingDelta: 1,
        followerDelta: 1,
      });
      invalidateFollowSideEffects(queryClient, authUid, targetUserId);
    },
    onError: (err) => {
      Alert.alert(
        'Could not connect',
        err instanceof Error ? err.message : 'Please try again.',
      );
    },
    onSettled: () => {
      setConnectBackTargetId(null);
    },
  });

  const markAllRead = useCallback(async () => {
    if (!authUid || markingAllRead) return;
    setMarkingAllRead(true);

    const previous = notifications;
    const next = previous.map((item) => ({ ...item, read: true }));
    setActivityItems(next);
    updateBadgeCount(next);

    try {
      await markAllNotificationsRead(authUid, previous);
      notifyReadKeysChanged();
    } catch (error) {
      setActivityItems(previous);
      updateBadgeCount(previous);
      Alert.alert(
        'Could not mark all as read',
        error instanceof Error ? error.message : 'Please try again.',
      );
    } finally {
      setMarkingAllRead(false);
    }
  }, [
    authUid,
    markingAllRead,
    notifications,
    notifyReadKeysChanged,
    setActivityItems,
    updateBadgeCount,
  ]);

  const handlePress = async (notification: Notification) => {
    if (!notification.read) {
      await markReadMutation.mutateAsync(notification);
    }

    if (
      notification.type === 'follow'
      || notification.type === 'follow_request'
      || notification.type === 'follow_accepted'
    ) {
      router.push(`/user/${notification.actorUsername}`);
    } else if (notification.postId) {
      router.push(`/post/${notification.postId}`);
    }
  };


  if (!authUid || (isLoading && notifications.length === 0 && followRequests.length === 0)) {
    return <LoadingState message="Loading activity..." />;
  }

  if (loadError && notifications.length === 0 && followRequests.length === 0) {
    return (
      <ErrorState
        message={loadError}
        onRetry={() => {
          setIsLoading(true);
          void loadActivity();
        }}
      />
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={() => void markAllRead()}
          disabled={markingAllRead}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Mark all notifications as read"
        >
          <Text style={[styles.markAllText, markingAllRead && styles.markAllDisabled]}>
            {markingAllRead ? 'Marking read...' : 'Mark all read'}
          </Text>
        </TouchableOpacity>
      </View>

      <PullRefreshFlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        ListHeaderComponent={
          followRequests.length > 0 ? (
            <View style={styles.requestsSection}>
              <Text style={styles.requestsTitle}>Follow requests</Text>
              {followRequests.map((item) => (
                <FollowRequestItem
                  key={item.request.id}
                  request={item.request}
                  requesterName={item.requesterName}
                  requesterUsername={item.requesterUsername}
                  requesterPhotoURL={item.requesterPhotoURL}
                  loading={activeRequestId === item.request.requesterId}
                  onAccept={() => acceptMutation.mutate(item.request.requesterId)}
                  onReject={() => rejectMutation.mutate(item.request.requesterId)}
                />
              ))}
            </View>
          ) : null
        }
        renderItem={({ item }) => {
          const showConnectBack =
            isConnectBackEligible(item)
            && item.actorId !== authUid
            && !followingIds.includes(item.actorId);

          return (
            <ActivityItem
              notification={item}
              onPress={() => void handlePress(item)}
              showConnectBack={showConnectBack}
              connectBackLoading={connectBackMutation.isPending && connectBackTargetId === item.actorId}
              onConnectBack={() => connectBackMutation.mutate(item.actorId)}
            />
          );
        }}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          followRequests.length === 0 ? (
            <EmptyState
              icon="notifications-outline"
              title="No activity yet"
              message="When someone follows, comments, or reacts to your posts, you'll see it here."
            />
          ) : null
        }
      />
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
      backgroundColor: colors.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    markAllText: {
      color: colors.primary,
      fontSize: FONT_SIZES.sm,
      fontWeight: '600',
    },
    markAllDisabled: {
      opacity: 0.5,
    },
    requestsSection: {
      backgroundColor: colors.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    requestsTitle: {
      fontSize: FONT_SIZES.sm,
      fontWeight: '700',
      color: colors.text,
      paddingHorizontal: SPACING.md,
      paddingTop: SPACING.md,
      paddingBottom: SPACING.sm,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    list: {
      flexGrow: 1,
      paddingBottom: SPACING.lg,
    },
  });
}
