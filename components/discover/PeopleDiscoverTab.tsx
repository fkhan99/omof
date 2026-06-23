import { useState } from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { searchUsers, getUsersByLocation } from '@/services/firebase/users';
import { getBlockedUserIds } from '@/services/firebase/safety';
import { Input } from '@/components/ui/Input';
import { UserListItem } from '@/components/users/UserListItem';
import { ContactsDiscoverSection } from '@/components/discover/ContactsDiscoverSection';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import { DISCOVER_MODES } from '@/constants/copy';
import { SPACING, FONT_SIZES, ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { User } from '@/types';

interface PeopleDiscoverTabProps {
  authUid: string | undefined;
  profile: User | null;
  followingIds: string[];
  requestedIds: string[];
  onFollowPress: (user: User) => void;
}

export function PeopleDiscoverTab({
  authUid,
  profile,
  followingIds,
  requestedIds,
  onFollowPress,
}: PeopleDiscoverTabProps) {
  const styles = useThemedStyles(createStyles);
  const [searchTerm, setSearchTerm] = useState('');
  const copy = DISCOVER_MODES.people;

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

  const renderBrowseContent = () => (
    <View>
      <View style={styles.header}>
        <Text style={styles.title}>{copy.title}</Text>
        <Text style={styles.subtitle}>{copy.subtitle}</Text>
      </View>

      {profile?.location ? (
        <View style={styles.nearbySection}>
          <Text style={styles.sectionTitle}>{copy.nearbyTitle}</Text>
          <Text style={styles.nearbyLocation}>{profile.location}</Text>
          {nearbyUsers.length === 0 ? (
            <Text style={styles.nearbyEmpty}>{copy.nearbyEmpty}</Text>
          ) : (
            nearbyUsers.map((user) => (
              <UserListItem
                key={user.id}
                user={user}
                showFollowButton
                isFollowing={followingIds.includes(user.id)}
                isRequested={requestedIds.includes(user.id)}
                onFollow={() => onFollowPress(user)}
                onUnfollow={() => onFollowPress(user)}
              />
            ))
          )}
        </View>
      ) : null}

      <ContactsDiscoverSection
        followingIds={followingIds}
        requestedIds={requestedIds}
        onFollowPress={onFollowPress}
      />
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <Input
          placeholder={copy.searchPlaceholder}
          value={searchTerm}
          onChangeText={setSearchTerm}
          autoCapitalize="none"
          autoCorrect={false}
          leftIcon="search"
        />
      </View>

      {searchTerm.length >= 2 ? (
        isLoading ? (
          <LoadingState message={copy.searching} />
        ) : users.length === 0 ? (
          <EmptyState icon="person-outline" title={copy.noResultsTitle} message={copy.noResultsMessage} />
        ) : (
          <FlatList
            data={users}
            keyExtractor={(item) => item.id}
            ListHeaderComponent={
              <View style={styles.header}>
                <Text style={styles.title}>{copy.searchResultsTitle}</Text>
              </View>
            }
            renderItem={({ item }) => (
              <UserListItem
                user={item}
                showFollowButton
                isFollowing={followingIds.includes(item.id)}
                isRequested={requestedIds.includes(item.id)}
                onFollow={() => onFollowPress(item)}
                onUnfollow={() => onFollowPress(item)}
              />
            )}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.list}
            extraData={`${followingIds.join(',')}-${requestedIds.join(',')}`}
          />
        )
      ) : (
        <FlatList
          data={[]}
          renderItem={() => null}
          ListHeaderComponent={renderBrowseContent}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.list}
          extraData={`${followingIds.join(',')}-${requestedIds.join(',')}-${nearbyUsers.length}`}
        />
      )}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
    },
    searchContainer: {
      paddingHorizontal: SPACING.md,
      paddingBottom: SPACING.sm,
    },
    list: {
      paddingBottom: SPACING.xl,
    },
    header: {
      paddingHorizontal: SPACING.md,
      paddingTop: SPACING.xs,
      paddingBottom: SPACING.sm,
    },
    title: {
      fontSize: FONT_SIZES.lg,
      fontWeight: '700',
      color: colors.text,
    },
    subtitle: {
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
    sectionTitle: {
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
  });
}
