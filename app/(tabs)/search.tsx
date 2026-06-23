import { useState } from 'react';
import { View, FlatList, StyleSheet, Alert, Text, RefreshControl } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { searchUsers, getUsersByLocation } from '@/services/firebase/users';
import { getPostsByMoodTag } from '@/services/firebase/posts';
import { useAuthStore } from '@/store/authStore';
import { getBlockedUserIds } from '@/services/firebase/safety';
import {
  getFollowingIds,
  followUser,
  unfollowUser,
} from '@/services/firebase/follows';
import { getOutgoingFollowRequestIds } from '@/services/firebase/followRequests';
import {
  invalidateFollowQueries,
  invalidateFollowSideEffects,
  setFollowRelationshipCache,
  adjustFollowCountsOptimistically,
} from '@/utils/followCache';
import { Input } from '@/components/ui/Input';
import { UserListItem } from '@/components/users/UserListItem';
import { PostCard } from '@/components/posts/PostCard';
import { MoodFilterBar } from '@/components/shared/MoodFilterBar';
import { ContactsDiscoverSection } from '@/components/discover/ContactsDiscoverSection';
import { OptionsMenu } from '@/components/ui/OptionsMenu';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import { SHARED_EXPERIENCES } from '@/constants/copy';
import { SPACING, FONT_SIZES, ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/hooks/useTheme';
import { RefreshGear } from '@/components/ui/RefreshGear';
import { MoodTag, User } from '@/types';

export default function SearchScreen() {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const profile = useAuthStore((s) => s.profile);
  const firebaseUser = useAuthStore((s) => s.firebaseUser);
  const queryClient = useQueryClient();
  const authUid = firebaseUser?.uid;
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMood, setSelectedMood] = useState<MoodTag | 'all' | 'growth'>('all');
  const [userToUnfollow, setUserToUnfollow] = useState<User | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const { data: followingIds = [] } = useQuery({
    queryKey: ['followingIds', authUid],
    queryFn: () => getFollowingIds(authUid!),
    enabled: !!authUid,
    staleTime: 0,
  });

  const { data: requestedIds = [] } = useQuery({
    queryKey: ['followRequestedIds', authUid],
    queryFn: () => getOutgoingFollowRequestIds(authUid!),
    enabled: !!authUid,
    staleTime: 0,
  });

  const locationLower = profile?.location?.trim().toLowerCase() ?? '';

  const { data: nearbyUsers = [] } = useQuery({
    queryKey: ['nearbyUsers', authUid, locationLower, followingIds.join(',')],
    queryFn: async () => {
      if (!profile || !locationLower) return [];
      const blockedIds = await getBlockedUserIds(profile.id);
      return getUsersByLocation(locationLower, profile.id, followingIds, blockedIds);
    },
    enabled: !!authUid && !!locationLower && searchTerm.length < 2,
  });

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['search', searchTerm],
    queryFn: async () => {
      if (!searchTerm.trim() || searchTerm.length < 2) return [];
      const results = await searchUsers(searchTerm);
      if (!profile) return results;
      const blockedIds = await getBlockedUserIds(profile.id);
      return results.filter((u) => !blockedIds.includes(u.id) && u.id !== profile.id);
    },
    enabled: searchTerm.length >= 2,
  });

  const moodTag = selectedMood !== 'all' && selectedMood !== 'growth' ? selectedMood : null;
  const postKind = selectedMood === 'growth' ? ('growth_update' as const) : null;

  const { data: sharedPosts = [], isLoading: sharedLoading, refetch: refetchShared } = useQuery({
    queryKey: ['sharedExperiences', authUid, selectedMood],
    queryFn: async () => {
      if (!profile) return [];
      const blockedIds = await getBlockedUserIds(profile.id);
      const result = await getPostsByMoodTag(moodTag, profile.id, followingIds, blockedIds, {
        postKind,
      });
      return result.items;
    },
    enabled: !!authUid && searchTerm.length < 2,
  });

  const followMutation = useMutation({
    mutationFn: async (targetUser: User) => followUser(authUid!, targetUser.id),
    onMutate: (targetUser) => {
      const nextState = targetUser.isPrivate
        ? { following: false, requested: true }
        : { following: true, requested: false };
      setFollowRelationshipCache(queryClient, authUid!, targetUser.id, nextState);
      if (!targetUser.isPrivate) {
        adjustFollowCountsOptimistically(queryClient, authUid!, targetUser.id, {
          followingDelta: 1,
          followerDelta: 1,
        });
      }
    },
    onSuccess: (_data, targetUser) => {
      invalidateFollowSideEffects(queryClient, authUid, targetUser.id);
    },
    onError: (err) => {
      invalidateFollowQueries(queryClient, authUid);
      Alert.alert(
        'Could not connect',
        err instanceof Error ? err.message : 'Please try again.',
      );
    },
  });

  const unfollowMutation = useMutation({
    mutationFn: (targetUserId: string) => unfollowUser(authUid!, targetUserId),
    onMutate: (targetUserId) => {
      setUserToUnfollow(null);
      const wasFollowing = followingIds.includes(targetUserId);
      setFollowRelationshipCache(queryClient, authUid!, targetUserId, {
        following: false,
        requested: false,
      });
      if (wasFollowing) {
        adjustFollowCountsOptimistically(queryClient, authUid!, targetUserId, {
          followingDelta: -1,
          followerDelta: -1,
        });
      }
    },
    onSuccess: (_data, targetUserId) => {
      invalidateFollowSideEffects(queryClient, authUid, targetUserId);
    },
    onError: (err) => {
      invalidateFollowQueries(queryClient, authUid);
      Alert.alert(
        'Could not disconnect',
        err instanceof Error ? err.message : 'Please try again.',
      );
    },
  });

  const handleFollowPress = (user: User) => {
    if (followingIds.includes(user.id)) {
      setUserToUnfollow(user);
      return;
    }

    if (requestedIds.includes(user.id)) {
      unfollowMutation.mutate(user.id);
      return;
    }

    followMutation.mutate(user);
  };

  const renderDiscoverHeader = () => (
    <View>
      <View style={styles.discoverHeader}>
        <Text style={styles.discoverTitle}>{SHARED_EXPERIENCES.title}</Text>
        <Text style={styles.discoverSubtitle}>{SHARED_EXPERIENCES.subtitle}</Text>
      </View>

      {profile?.location ? (
        <View style={styles.nearbySection}>
          <Text style={styles.nearbyTitle}>{SHARED_EXPERIENCES.nearbyTitle}</Text>
          <Text style={styles.nearbyLocation}>{profile.location}</Text>
          {nearbyUsers.length === 0 ? (
            <Text style={styles.nearbyEmpty}>{SHARED_EXPERIENCES.nearbyEmpty}</Text>
          ) : (
            nearbyUsers.map((user) => (
              <UserListItem
                key={user.id}
                user={user}
                showFollowButton
                isFollowing={followingIds.includes(user.id)}
                isRequested={requestedIds.includes(user.id)}
                onFollow={() => handleFollowPress(user)}
                onUnfollow={() => handleFollowPress(user)}
              />
            ))
          )}
        </View>
      ) : null}

      <ContactsDiscoverSection
        followingIds={followingIds}
        requestedIds={requestedIds}
        onFollowPress={handleFollowPress}
      />

      <MoodFilterBar selectedMood={selectedMood} onSelect={setSelectedMood} />
    </View>
  );

  const onRefreshDiscover = async () => {
    setRefreshing(true);
    await refetchShared();
    setRefreshing(false);
  };

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <Input
          placeholder={SHARED_EXPERIENCES.searchPlaceholder}
          value={searchTerm}
          onChangeText={setSearchTerm}
          autoCapitalize="none"
          autoCorrect={false}
          leftIcon="search"
        />
      </View>

      {searchTerm.length < 2 ? (
        sharedLoading ? (
          <LoadingState message={SHARED_EXPERIENCES.loading} />
        ) : (
          <FlatList
            data={sharedPosts}
            keyExtractor={(item) => item.id}
            ListHeaderComponent={() => (
              <View>
                {renderDiscoverHeader()}
                <RefreshGear visible={refreshing} />
              </View>
            )}
            renderItem={({ item }) => <PostCard post={{ ...item, isPromoted: false }} variant="card" />}
            contentContainerStyle={styles.exploreList}
            keyboardShouldPersistTaps="handled"
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => void onRefreshDiscover()}
                tintColor={colors.primary}
                colors={[colors.primary]}
              />
            }
            extraData={`${followingIds.join(',')}-${requestedIds.join(',')}-${nearbyUsers.length}`}
            ListEmptyComponent={
              <EmptyState
                icon="heart-outline"
                title={SHARED_EXPERIENCES.emptyTitle}
                message={SHARED_EXPERIENCES.emptyMessage}
              />
            }
          />
        )
      ) : isLoading ? (
        <LoadingState message="Searching..." />
      ) : users.length === 0 ? (
        <EmptyState icon="person-outline" title="No results" message="Try a different search term." />
      ) : (
        <FlatList
          data={users}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <UserListItem
              user={item}
              showFollowButton
              isFollowing={followingIds.includes(item.id)}
              isRequested={requestedIds.includes(item.id)}
              onFollow={() => handleFollowPress(item)}
              onUnfollow={() => handleFollowPress(item)}
            />
          )}
          keyboardShouldPersistTaps="handled"
            extraData={`${followingIds.join(',')}-${requestedIds.join(',')}-${nearbyUsers.length}`}
        />
      )}

      <OptionsMenu
        visible={!!userToUnfollow}
        title={userToUnfollow ? `@${userToUnfollow.username}` : undefined}
        onClose={() => setUserToUnfollow(null)}
        options={
          userToUnfollow
            ? [
                {
                  label: `Disconnect from ${userToUnfollow.username}`,
                  destructive: true,
                  onPress: () => unfollowMutation.mutate(userToUnfollow.id),
                },
              ]
            : []
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
    searchContainer: {
      padding: SPACING.md,
      paddingBottom: SPACING.sm,
    },
    discoverHeader: {
      paddingHorizontal: SPACING.md,
      paddingTop: SPACING.sm,
      paddingBottom: SPACING.xs,
    },
    discoverTitle: {
      fontSize: FONT_SIZES.lg,
      fontWeight: '700',
      color: colors.text,
    },
    discoverSubtitle: {
      fontSize: FONT_SIZES.sm,
      color: colors.textMuted,
      marginTop: 4,
      lineHeight: 20,
    },
    nearbySection: {
      marginBottom: SPACING.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    nearbyTitle: {
      fontSize: FONT_SIZES.md,
      fontWeight: '700',
      color: colors.text,
      paddingHorizontal: SPACING.md,
      paddingTop: SPACING.sm,
    },
    nearbyLocation: {
      fontSize: FONT_SIZES.sm,
      color: colors.textSecondary,
      paddingHorizontal: SPACING.md,
      paddingBottom: SPACING.xs,
    },
    nearbyEmpty: {
      fontSize: FONT_SIZES.sm,
      color: colors.textMuted,
      paddingHorizontal: SPACING.md,
      paddingBottom: SPACING.md,
      lineHeight: 20,
    },
    exploreList: {
      paddingBottom: SPACING.xl,
    },
  });
}
