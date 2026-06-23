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
import { onboardingSchema, OnboardingFormData, validateUsername } from '@/utils/validation';
import { pickProfilePhotoFromLibrary } from '@/utils/pickProfilePhoto';
import { createUserProfile, isUsernameAvailable, loadAuthUserProfile, logOut } from '@/services/firebase/auth';
import { deleteAuthOnly } from '@/services/firebase/accountDeletion';
import { uploadProfilePhoto } from '@/services/firebase/users';
import { useAuthStore } from '@/store/authStore';
import { isEmailVerificationLink } from '@/utils/firebaseEmailActions';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { FONT_SIZES, SPACING, ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';

export default function OnboardingScreen() {
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const { firebaseUser, setProfile, reset, pendingSignupCompliance, isInitialized, isLoading } =
    useAuthStore();
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showRemoveSignIn, setShowRemoveSignIn] = useState(false);
  const [removePassword, setRemovePassword] = useState('');
  const [removingSignIn, setRemovingSignIn] = useState(false);

  const { control, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<OnboardingFormData>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: { username: '', displayName: '', bio: '' },
  });

  const displayName = watch('displayName');
  const username = watch('username');
  const [usernameStatus, setUsernameStatus] = useState<
    'idle' | 'checking' | 'available' | 'taken'
  >('idle');

  useEffect(() => {
    const trimmed = username?.trim() ?? '';

    if (!trimmed || validateUsername(trimmed)) {
      setUsernameStatus('idle');
      return;
    }

    let cancelled = false;
    setUsernameStatus('checking');

    const handle = setTimeout(async () => {
      try {
        const available = await isUsernameAvailable(trimmed);
        if (!cancelled) {
          setUsernameStatus(available ? 'available' : 'taken');
        }
      } catch {
        if (!cancelled) setUsernameStatus('idle');
      }
    }, 450);

    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [username]);

  useEffect(() => {
    if (!isInitialized || isLoading) return;
    if (
      Platform.OS === 'web' &&
      typeof window !== 'undefined' &&
      isEmailVerificationLink(window.location.search)
    ) {
      return;
    }
    if (!firebaseUser) {
      router.replace('/(auth)/login');
    }
  }, [firebaseUser, isInitialized, isLoading, router]);

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

  const handleSignInInstead = async () => {
    await logOut();
    reset();
    router.replace('/(auth)/login');
  };

  const handleRemoveSignIn = async () => {
    if (!firebaseUser?.email) {
      setError('No email on this sign-in. Use a different account instead.');
      return;
    }
    if (!removePassword.trim()) {
      setError('Enter your password to remove this sign-in.');
      return;
    }

    setRemovingSignIn(true);
    setError(null);

    try {
      await deleteAuthOnly(firebaseUser.email, removePassword);
      reset();
      router.replace('/(auth)/login');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove sign-in');
    } finally {
      setRemovingSignIn(false);
    }
  };

  const pickImage = async () => {
    const uri = await pickProfilePhotoFromLibrary();
    if (uri) {
      setPhotoUri(uri);
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
              onChangeText={(text) => onChange(text.replace(/\s/g, ''))}
              onBlur={onBlur}
              error={errors.username?.message}
              autoCapitalize="none"
            />
          )}
        />

        {!errors.username && usernameStatus === 'checking' && (
          <Text style={styles.usernameHint}>Checking availability…</Text>
        )}
        {!errors.username && usernameStatus === 'available' && (
          <Text style={[styles.usernameHint, styles.usernameAvailable]}>
            Username is available
          </Text>
        )}
        {!errors.username && usernameStatus === 'taken' && (
          <Text style={[styles.usernameHint, styles.usernameTaken]}>
            This username is already taken
          </Text>
        )}

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

        <Button
          title="Continue"
          onPress={handleSubmit(onSubmit)}
          loading={isSubmitting}
          disabled={usernameStatus === 'taken' || usernameStatus === 'checking'}
        />

        <TouchableOpacity
          style={styles.signInLink}
          onPress={handleSignInInstead}
          accessibilityRole="button"
        >
          <Text style={styles.signInText}>Sign in with a different account</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.signInLink}
          onPress={() => setShowRemoveSignIn((value) => !value)}
          accessibilityRole="button"
        >
          <Text style={styles.signInText}>
            {showRemoveSignIn ? 'Hide remove sign-in' : 'Remove this sign-in completely'}
          </Text>
        </TouchableOpacity>

        {showRemoveSignIn && (
          <View style={styles.removeSignInSection}>
            <Text style={styles.removeHint}>
              Your data was already removed. Enter your password to delete this sign-in so the same email can be used again.
            </Text>
            <Input
              label="Password"
              placeholder="Your account password"
              value={removePassword}
              onChangeText={setRemovePassword}
              secureTextEntry
              autoCapitalize="none"
            />
            <Button
              title="Remove sign-in"
              onPress={handleRemoveSignIn}
              loading={removingSignIn}
              variant="danger"
            />
          </View>
        )}
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
    usernameHint: {
      fontSize: FONT_SIZES.sm,
      color: colors.textSecondary,
      marginTop: -SPACING.sm,
      marginBottom: SPACING.md,
    },
    usernameAvailable: {
      color: colors.success,
    },
    usernameTaken: {
      color: colors.danger,
    },
    signInLink: {
      alignSelf: 'center',
      marginTop: SPACING.lg,
      paddingVertical: SPACING.sm,
    },
    signInText: {
      color: colors.primary,
      fontSize: FONT_SIZES.md,
      fontWeight: '600',
    },
    removeSignInSection: {
      marginTop: SPACING.md,
      gap: SPACING.md,
    },
    removeHint: {
      fontSize: FONT_SIZES.sm,
      color: colors.textSecondary,
    },
  });
}
