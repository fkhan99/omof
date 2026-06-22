import { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Text,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { editProfileSchema, EditProfileFormData } from '@/utils/validation';
import { pickProfilePhotoFromLibrary } from '@/utils/pickProfilePhoto';
import { updateUserProfile, uploadProfilePhoto } from '@/services/firebase/users';
import { useAuthStore } from '@/store/authStore';
import { getUserProfile } from '@/services/firebase/auth';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { FONT_SIZES, SPACING, ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';

export default function EditProfileScreen() {
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const { profile, setProfile } = useAuthStore();
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { control, handleSubmit, formState: { errors, isSubmitting } } = useForm<EditProfileFormData>({
    resolver: zodResolver(editProfileSchema),
    defaultValues: {
      displayName: profile?.displayName ?? '',
      bio: profile?.bio ?? '',
    },
  });

  const pickImage = async () => {
    const uri = await pickProfilePhotoFromLibrary();
    if (uri) {
      setPhotoUri(uri);
    }
  };

  const onSubmit = async (data: EditProfileFormData) => {
    if (!profile) return;
    setError(null);

    try {
      let photoURL = profile.photoURL;
      if (photoUri) {
        photoURL = await uploadProfilePhoto(profile.id, photoUri);
      }

      await updateUserProfile(profile.id, {
        displayName: data.displayName,
        bio: data.bio,
        photoURL,
      });

      const updated = await getUserProfile(profile.id);
      if (updated) setProfile(updated);
      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile');
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <TouchableOpacity
        style={styles.photoSection}
        onPress={pickImage}
        accessibilityRole="button"
        accessibilityLabel="Change profile photo"
      >
        <Avatar uri={photoUri ?? profile?.photoURL ?? null} name={profile?.displayName} size={96} />
        <Text style={styles.photoHint}>Tap to change photo</Text>
      </TouchableOpacity>

      <Controller
        control={control}
        name="displayName"
        render={({ field: { onChange, onBlur, value } }) => (
          <Input
            label="Display Name"
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            error={errors.displayName?.message}
          />
        )}
      />

      <Controller
        control={control}
        name="bio"
        render={({ field: { onChange, onBlur, value } }) => (
          <Input
            label="Bio"
            value={value ?? ''}
            onChangeText={onChange}
            onBlur={onBlur}
            error={errors.bio?.message}
            multiline
            numberOfLines={3}
          />
        )}
      />

      {error && <Text style={styles.error}>{error}</Text>}

      <Button title="Save Changes" onPress={handleSubmit(onSubmit)} loading={isSubmitting} />
    </ScrollView>
    </KeyboardAvoidingView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      padding: SPACING.lg,
    },
    photoSection: {
      alignItems: 'center',
      marginBottom: SPACING.xl,
    },
    photoHint: {
      fontSize: FONT_SIZES.sm,
      color: colors.textMuted,
      marginTop: SPACING.sm,
    },
    error: {
      color: colors.danger,
      fontSize: FONT_SIZES.sm,
      marginBottom: SPACING.md,
    },
  });
}
