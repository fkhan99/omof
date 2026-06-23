import { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useAuthStore } from '@/store/authStore';
import { DiscoverModeTabs } from '@/components/discover/DiscoverModeTabs';
import { PeopleDiscoverTab } from '@/components/discover/PeopleDiscoverTab';
import { PostsDiscoverTab } from '@/components/discover/PostsDiscoverTab';
import { OptionsMenu } from '@/components/ui/OptionsMenu';
import { useDiscoverFollowActions } from '@/hooks/useDiscoverFollowActions';
import { DiscoverMode } from '@/constants/copy';
import { SPACING, ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';

export default function SearchScreen() {
  const styles = useThemedStyles(createStyles);
  const profile = useAuthStore((s) => s.profile);
  const firebaseUser = useAuthStore((s) => s.firebaseUser);
  const authUid = firebaseUser?.uid;
  const [mode, setMode] = useState<DiscoverMode>('people');

  const {
    followingIds,
    requestedIds,
    userToUnfollow,
    setUserToUnfollow,
    handleFollowPress,
    unfollowMutation,
  } = useDiscoverFollowActions(authUid);

  return (
    <View style={styles.container}>
      <DiscoverModeTabs mode={mode} onModeChange={setMode} />

      {mode === 'people' ? (
        <PeopleDiscoverTab
          authUid={authUid}
          profile={profile}
          followingIds={followingIds}
          requestedIds={requestedIds}
          onFollowPress={handleFollowPress}
        />
      ) : (
        <PostsDiscoverTab authUid={authUid} profile={profile} followingIds={followingIds} />
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
      paddingTop: SPACING.sm,
    },
  });
}
