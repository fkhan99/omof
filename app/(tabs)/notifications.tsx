import { useCallback, useRef, useState } from 'react';
import { FlatList, StyleSheet, TouchableOpacity, View, Text, Alert } from 'react-native';
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
import { useNotificationStore } from '@/store/notificationStore';
import { ActivityItem } from '@/components/notifications/ActivityItem';
import { FollowRequestItem } from '@/components/users/FollowRequestItem';
import { LoadingState } from '@/components/ui/LoadingState';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Notification } from '@/types';
import { computeActivityBadgeCount } from '@/utils/activityBadge';
import { adjustFollowCountsOptimistically } from '@/utils/followCache';
import { upsertActivityNotification } from '@/services/firebase/activityFeed';
import { FONT_SIZES, SPACING, ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';

export default function ActivityScreen() {
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const { firebaseUser } = useAuthStore();
  const notifications = useNotificationStore((state) => state.activityItems);
  const setActivityItems = useNotificationStore((state) => state.setActivityItems);
  const setUnreadCount = useNotificationStore((state) => state.setUnreadCount);
  const queryClient = useQueryClient();
  const authUid = firebaseUser?.uid;
  const [activeRequestId, setActiveRequestId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const followRequestCountRef = useRef(0);

  const { data: followRequests = [] } = useQuery({
    queryKey: ['followRequests', authUid],
    queryFn: () => getIncomingFollowRequestsWithRequesters(authUid!),
    enabled: !!authUid,
    staleTime: Infinity,
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
        item.id === notification.id ? { ...item, read: true } : item,
      );
      setActivityItems(next);
      updateBadgeCount(next);
    },
  });

  const acceptMutation = useMutation({
    mutationFn: (requesterId: string) => acceptFollowRequest(authUid!, requesterId),
    onMutate: (requesterId) => {
      setActiveRequestId(requesterId);
      const acceptedItem = followRequests.find(
        (item) => item.request.requesterId === requesterId,
      );
      queryClient.setQueryData<FollowRequestWithRequester[]>(
        ['followRequests', authUid],
        (old) => old?.filter((item) => item.request.requesterId !== requesterId) ?? [],
      );
      return { acceptedItem };
    },
    onSuccess: (_data, requesterId, context) => {
      adjustFollowCountsOptimistically(queryClient, requesterId, authUid!, {
        followingDelta: 1,
        followerDelta: 1,
      });

      const accepted = context?.acceptedItem;
      if (!accepted) return;

      const followNotification: Notification = {
        id: `optimistic_follow_${requesterId}`,
        recipientId: authUid!,
        actorId: requesterId,
        actorUsername: accepted.requesterUsername,
        actorDisplayName: accepted.requesterName,
        actorPhotoURL: accepted.requesterPhotoURL,
        type: 'follow',
        postId: null,
        postImageURL: null,
        commentText: null,
        commentId: null,
        reactionType: null,
        read: false,
        createdAt: new Date(),
      };

      const hasFollow = notifications.some(
        (item) => item.type === 'follow' && item.actorId === requesterId,
      );
      if (!hasFollow) {
        const next = upsertActivityNotification(notifications, followNotification);
        setActivityItems(next);
        updateBadgeCount(next);
      }
    },
    onSettled: () => {
      setActiveRequestId(null);
      queryClient.invalidateQueries({ queryKey: ['isFollowing'] });
      queryClient.invalidateQueries({ queryKey: ['followRequested'] });
      queryClient.invalidateQueries({ queryKey: ['followRequestedIds'] });
      queryClient.invalidateQueries({ queryKey: ['followingIds'] });
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      queryClient.invalidateQueries({ queryKey: ['user'] });
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
    },
    onError: (err) => {
      Alert.alert(
        'Could not decline request',
        err instanceof Error ? err.message : 'Please try again.',
      );
    },
    onSettled: () => {
      setActiveRequestId(null);
      queryClient.invalidateQueries({ queryKey: ['followRequests'] });
    },
  });

  const markAllRead = useCallback(async () => {
    if (!authUid) return;
    const previous = notifications;
    const next = notifications.map((item) => ({ ...item, read: true }));
    setActivityItems(next);
    updateBadgeCount(next);
    try {
      await markAllNotificationsRead(authUid, previous);
    } catch (error) {
      // Roll back the optimistic update so unread state stays accurate.
      setActivityItems(previous);
      updateBadgeCount(previous);
      Alert.alert(
        'Could not mark all as read',
        error instanceof Error ? error.message : 'Please try again.',
      );
    }
  }, [authUid, notifications, setActivityItems, updateBadgeCount]);

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
        <Text style={styles.topBarTitle}>Activity</Text>
        <TouchableOpacity onPress={markAllRead} hitSlop={8}>
          <Text style={styles.markAllText}>Mark all read</Text>
        </TouchableOpacity>
      </View>

      {followRequests.length > 0 ? (
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
      ) : null}

      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ActivityItem notification={item} onPress={() => handlePress(item)} />
        )}
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
      justifyContent: 'space-between',
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.md,
      backgroundColor: colors.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    topBarTitle: {
      fontSize: FONT_SIZES.md,
      fontWeight: '700',
      color: colors.text,
    },
    markAllText: {
      color: colors.primary,
      fontSize: FONT_SIZES.sm,
      fontWeight: '600',
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
