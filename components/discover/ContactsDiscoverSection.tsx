import { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { useMutation } from '@tanstack/react-query';
import { findUsersByEmails } from '@/services/firebase/users';
import { useAuthStore } from '@/store/authStore';
import { UserListItem } from '@/components/users/UserListItem';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { SHARED_EXPERIENCES } from '@/constants/copy';
import { FONT_SIZES, SPACING, ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { importContactEmails, parseEmailList } from '@/utils/contactImport';
import { User } from '@/types';

interface ContactsDiscoverSectionProps {
  followingIds: string[];
  requestedIds: string[];
  onFollowPress: (user: User) => void;
}

export function ContactsDiscoverSection({
  followingIds,
  requestedIds,
  onFollowPress,
}: ContactsDiscoverSectionProps) {
  const styles = useThemedStyles(createStyles);
  const authUid = useAuthStore((s) => s.firebaseUser?.uid);
  const [emailInput, setEmailInput] = useState('');
  const [matches, setMatches] = useState<User[]>([]);

  const searchMutation = useMutation({
    mutationFn: async (emails: string[]) => {
      const users = await findUsersByEmails(emails);
      if (!authUid) return users;
      return users.filter((user) => user.id !== authUid);
    },
    onSuccess: (users) => {
      setMatches(users);
      if (users.length === 0) {
        Alert.alert('No matches', SHARED_EXPERIENCES.contactsNone);
      }
    },
    onError: (error) => {
      Alert.alert(
        'Search failed',
        error instanceof Error ? error.message : 'Could not search contacts.',
      );
    },
  });

  const handleImportContacts = async () => {
    const imported = await importContactEmails();
    if (imported.length === 0) {
      Alert.alert(
        'Contacts unavailable',
        'Paste your friends’ emails below, or use a browser that supports contact import.',
      );
      return;
    }
    setEmailInput(imported.join(', '));
    searchMutation.mutate(imported);
  };

  const handleSearchEmails = () => {
    const emails = parseEmailList(emailInput);
    if (emails.length === 0) {
      Alert.alert('Enter emails', 'Add one or more email addresses to search.');
      return;
    }
    searchMutation.mutate(emails);
  };

  return (
    <View style={styles.section}>
      <Text style={styles.title}>{SHARED_EXPERIENCES.contactsTitle}</Text>
      <Text style={styles.hint}>{SHARED_EXPERIENCES.contactsHint}</Text>

      <Button
        title={SHARED_EXPERIENCES.contactsImport}
        variant="secondary"
        size="sm"
        onPress={() => void handleImportContacts()}
        style={styles.importButton}
      />

      <Input
        label={SHARED_EXPERIENCES.contactsPasteLabel}
        placeholder={SHARED_EXPERIENCES.contactsPastePlaceholder}
        value={emailInput}
        onChangeText={setEmailInput}
        autoCapitalize="none"
        autoCorrect={false}
      />

      <Button
        title={SHARED_EXPERIENCES.contactsSearch}
        size="sm"
        onPress={handleSearchEmails}
        loading={searchMutation.isPending}
      />

      {matches.map((user) => (
        <UserListItem
          key={user.id}
          user={user}
          showFollowButton
          isFollowing={followingIds.includes(user.id)}
          isRequested={requestedIds.includes(user.id)}
          onFollow={() => onFollowPress(user)}
          onUnfollow={() => onFollowPress(user)}
        />
      ))}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    section: {
      paddingBottom: SPACING.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
      gap: SPACING.sm,
    },
    title: {
      fontSize: FONT_SIZES.md,
      fontWeight: '700',
      color: colors.text,
      paddingHorizontal: SPACING.md,
      paddingTop: SPACING.sm,
    },
    hint: {
      fontSize: FONT_SIZES.sm,
      color: colors.textMuted,
      paddingHorizontal: SPACING.md,
      lineHeight: 20,
    },
    importButton: {
      marginHorizontal: SPACING.md,
    },
  });
}
