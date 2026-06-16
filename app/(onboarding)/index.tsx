import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as ImagePicker from 'expo-image-picker';
import { onboardingSchema, OnboardingFormData } from '@/utils/validation';
import { createUserProfile, isUsernameAvailable, loadAuthUserProfile } from '@/services/firebase/auth';
import { uploadProfilePhoto } from '@/services/firebase/users';
import { useAuthStore } from '@/store/authStore';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { FONT_SIZES, SPACING, ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';

export default function OnboardingScreen() {
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const { firebaseUser, setProfile, pendingSignupCompliance } = useAuthStore();
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { control, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<OnboardingFormData>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: { username: '', displayName: '', bio: '' },
  });

  const displayName = watch('displayName');

  useEffect(() => {
    if (!firebaseUser?.uid) return;

    loadAuthUserProfile(firebaseUser.uid).then((existing) => {
      if (existing) {
        console.log('[Onboarding] users/{uid} already exists — redirecting to main app', {
          uid: firebaseUser.uid,
        });
        setProfile(existing);
        router.replace('/(tabs)');
      } else {
        console.log('[Onboarding] users/{uid} missing — showing setup', {
          uid: firebaseUser.uid,
        });
      }
    });
  }, [firebaseUser?.uid, router, setProfile]);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const onSubmit = async (data: OnboardingFormData) => {
    if (!firebaseUser) return;
    setError(null);

    try {
      const existing = await loadAuthUserProfile(firebaseUser.uid);
      if (existing) {
        console.log('[Onboarding] profile already exists on submit — skipping create', {
          uid: firebaseUser.uid,
        });
        setProfile(existing);
        router.replace('/(tabs)');
        return;
      }

      const available = await isUsernameAvailable(data.username);
      if (!available) {
        setError('This username is already taken');
        return;
      }

      let photoURL: string | null = null;
      if (photoUri) {
        photoURL = await uploadProfilePhoto(firebaseUser.uid, photoUri);
      }

      const profile = await createUserProfile(firebaseUser.uid, firebaseUser.email!, {
        username: data.username,
        displayName: data.displayName,
        bio: data.bio,
        photoURL,
        compliance: pendingSignupCompliance ?? undefined,
      });

      setProfile(profile);
      router.replace('/(tabs)');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to complete onboarding');
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.title} accessibilityRole="header">Welcome to OMOF</Text>
        <Text style={styles.subtitle}>Set up your profile to get started.</Text>

        <TouchableOpacity style={styles.photoSection} onPress={pickImage} accessibilityRole="button" accessibilityLabel="Upload profile photo">
          <Avatar uri={photoUri} name={displayName} size={96} />
          <Text style={styles.photoHint}>Tap to add a photo (optional)</Text>
        </TouchableOpacity>

        <Controller
          control={control}
          name="username"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              label="Username"
              placeholder="your_username"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={errors.username?.message}
              autoCapitalize="none"
            />
          )}
        />

        <Controller
          control={control}
          name="displayName"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              label="Display Name"
              placeholder="How you'd like to be called"
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
              label="Bio (optional)"
              placeholder="A few words about you"
              value={value ?? ''}
              onChangeText={onChange}
              onBlur={onBlur}
              error={errors.bio?.message}
              multiline
              numberOfLines={3}
            />
          )}
        />

        {error && <Text style={styles.error} accessibilityRole="alert">{error}</Text>}

        <Button title="Continue" onPress={handleSubmit(onSubmit)} loading={isSubmitting} />
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
    scroll: {
      padding: SPACING.lg,
      paddingTop: SPACING.xxl,
    },
    title: {
      fontSize: FONT_SIZES.xxl,
      fontWeight: '700',
      color: colors.text,
      marginBottom: SPACING.sm,
    },
    subtitle: {
      fontSize: FONT_SIZES.md,
      color: colors.textSecondary,
      marginBottom: SPACING.xl,
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
