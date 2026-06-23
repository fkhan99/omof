import { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { Image, type ImageLoadEventData } from 'expo-image';
import { useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { createPostSchema, CreatePostFormData } from '@/utils/validation';
import { createPost } from '@/services/firebase/posts';
import { useAuthStore } from '@/store/authStore';
import { queryClient } from '@/lib/queryClient';
import { MOOD_TAGS, MoodTag, PostMediaType } from '@/types';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { CrisisSupportModal } from '@/components/safety/CrisisSupportModal';
import { containsCrisisLanguage } from '@/utils';
import { generateVideoThumbnail, persistDataUrlThumbnail, prepareVideoForUpload } from '@/utils/media';
import {
  FONT_SIZES,
  SPACING,
  BORDER_RADIUS,
  CAPTION_MAX_LENGTH,
  VIDEO_MAX_DURATION_SEC,
  VIDEO_MAX_SIZE_BYTES,
  ThemeColors,
} from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/hooks/useTheme';

interface SelectedMedia {
  mediaType: PostMediaType;
  uri: string;
  thumbnailUri?: string;
  mimeType?: string | null;
}

export default function CreatePostScreen() {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const { height: windowHeight } = useWindowDimensions();
  const maxPreviewHeight =
    Platform.OS === 'web' ? Math.min(Math.round(windowHeight * 0.42), 520) : undefined;
  const router = useRouter();
  const profile = useAuthStore((s) => s.profile);
  const firebaseUser = useAuthStore((s) => s.firebaseUser);
  const [selectedMedia, setSelectedMedia] = useState<SelectedMedia | null>(null);
  const [previewAspectRatio, setPreviewAspectRatio] = useState(1);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const previewRequestRef = useRef(0);
  const [showCrisisModal, setShowCrisisModal] = useState(false);
  const [pendingData, setPendingData] = useState<CreatePostFormData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { control, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } = useForm<CreatePostFormData>({
    resolver: zodResolver(createPostSchema),
    defaultValues: { caption: '', moodTag: undefined },
  });

  const caption = watch('caption');
  const selectedMood = watch('moodTag');

  const clearMedia = () => {
    previewRequestRef.current += 1;
    setSelectedMedia(null);
    setPreviewAspectRatio(1);
    setIsLoadingPreview(false);
  };

  const handlePreviewLoad = (event: ImageLoadEventData) => {
    const { width, height } = event.source;
    if (width && height) {
      setPreviewAspectRatio(width / height);
    }
  };

  const loadVideoPreview = (videoUri: string) => {
    const requestId = previewRequestRef.current + 1;
    previewRequestRef.current = requestId;
    setIsLoadingPreview(true);

    void (async () => {
      try {
        const thumbnailUri = await generateVideoThumbnail(videoUri);
        if (previewRequestRef.current !== requestId) return;

        const persistedThumbnail = thumbnailUri
          ? thumbnailUri.startsWith('data:image')
            ? await persistDataUrlThumbnail(thumbnailUri)
            : thumbnailUri
          : undefined;

        if (previewRequestRef.current !== requestId) return;

        if (persistedThumbnail) {
          setSelectedMedia((current) => {
            if (!current || current.uri !== videoUri) return current;
            return { ...current, thumbnailUri: persistedThumbnail };
          });
        }
      } catch (err) {
        if (__DEV__) {
          console.warn('[pickVideo] preview failed', err);
        }
      } finally {
        if (previewRequestRef.current === requestId) {
          setIsLoadingPreview(false);
        }
      }
    })();
  };

  const ensureMediaPermission = async (): Promise<boolean> => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        'Permission needed',
        'Allow photo library access to add photos and videos to your posts.',
      );
      return false;
    }
    return true;
  };

  const pickImage = async () => {
    if (!(await ensureMediaPermission())) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setSelectedMedia({
        mediaType: 'image',
        uri: asset.uri,
        mimeType: asset.mimeType,
      });
      setIsLoadingPreview(false);
    }
  };

  const pickVideo = async () => {
    if (!(await ensureMediaPermission())) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      allowsEditing: false,
      videoMaxDuration: VIDEO_MAX_DURATION_SEC,
      preferredAssetRepresentationMode:
        ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
    });

    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];

    if (asset.fileSize && asset.fileSize > VIDEO_MAX_SIZE_BYTES) {
      Alert.alert('Video too large', 'Please choose a video under 50 MB.');
      return;
    }

    setError(null);

    try {
      const localUri = await prepareVideoForUpload(asset.uri);
      setSelectedMedia({
        mediaType: 'video',
        uri: localUri,
        mimeType: asset.mimeType,
      });
      loadVideoPreview(localUri);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not read the selected video.';
      setError(message);
      Alert.alert('Video error', message);
    }
  };

  const submitPost = async (data: CreatePostFormData) => {
    if (!profile || !firebaseUser || !selectedMedia) {
      Alert.alert('Missing info', 'Please add a photo or video and fill in all fields.');
      return;
    }

    setError(null);
    try {
      await createPost(
        {
          id: firebaseUser.uid,
          username: profile.username,
          displayName: profile.displayName,
          photoURL: profile.photoURL,
        },
        selectedMedia,
        data.caption,
        data.moodTag as MoodTag,
      );
      queryClient.invalidateQueries({ queryKey: ['myPosts', firebaseUser.uid] });
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      setSelectedMedia(null);
      setIsLoadingPreview(false);
      setValue('caption', '');
      setValue('moodTag', undefined as unknown as MoodTag);
      router.push('/(tabs)');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create post';
      setError(message);
      Alert.alert('Could not share post', message);
    }
  };

  const onSubmit = async (data: CreatePostFormData) => {
    if (!selectedMedia) {
      Alert.alert('Media required', 'Please select a photo or video for your post.');
      return;
    }

    if (containsCrisisLanguage(data.caption)) {
      setPendingData(data);
      setShowCrisisModal(true);
      return;
    }

    await submitPost(data);
  };

  const handleCrisisEdit = () => {
    setShowCrisisModal(false);
    setPendingData(null);
  };

  const handleCrisisDismiss = () => {
    setShowCrisisModal(false);
    setPendingData(null);
  };

  const previewUri =
    selectedMedia?.mediaType === 'video'
      ? selectedMedia.thumbnailUri
      : selectedMedia?.uri;

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
      <Text style={styles.heading}>New post</Text>
      <Text style={styles.subheading}>
        Share what's real. Photos and videos up to {VIDEO_MAX_DURATION_SEC}s.
      </Text>
      <Text style={styles.requiredNote}>* Required fields</Text>

      <Text style={styles.label} accessibilityRole="header">
        Photo or video<Text style={styles.required}>*</Text>
      </Text>

      <View
        style={[
          styles.mediaPicker,
          maxPreviewHeight ? { maxHeight: maxPreviewHeight, aspectRatio: undefined } : null,
        ]}
      >
        {selectedMedia ? (
          <View style={styles.previewWrap}>
            {previewUri ? (
              <Image
                source={{ uri: previewUri }}
                style={[
                  styles.preview,
                  maxPreviewHeight
                    ? { aspectRatio: previewAspectRatio, maxHeight: maxPreviewHeight }
                    : null,
                ]}
                contentFit="contain"
                onLoad={handlePreviewLoad}
                accessibilityLabel={
                  selectedMedia.mediaType === 'video' ? 'Video preview' : 'Photo preview'
                }
              />
            ) : (
              <View style={styles.videoPlaceholder}>
                <Ionicons name="videocam" size={40} color={colors.textMuted} />
                <Text style={styles.videoPlaceholderText}>
                  {isLoadingPreview ? 'Loading preview...' : 'Video ready'}
                </Text>
                {isLoadingPreview ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : null}
              </View>
            )}

            {selectedMedia.mediaType === 'video' && previewUri ? (
              <View style={styles.videoBadge} pointerEvents="none">
                <Ionicons name="videocam" size={16} color={colors.white} />
              </View>
            ) : null}

            <TouchableOpacity
              style={styles.removeMedia}
              onPress={clearMedia}
              accessibilityRole="button"
              accessibilityLabel="Remove selected media"
            >
              <Ionicons name="close-circle" size={28} color={colors.white} />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.mediaPlaceholder}>
            <Ionicons name="images-outline" size={36} color={colors.textMuted} />
            <Text style={styles.mediaPlaceholderText}>Add photo or video</Text>
            <View style={styles.mediaActions}>
              <Button title="Photo" variant="secondary" size="sm" onPress={pickImage} />
              <Button title="Video" variant="secondary" size="sm" onPress={pickVideo} />
            </View>
          </View>
        )}
      </View>

      <Text style={styles.label}>
        How are you feeling?<Text style={styles.required}>*</Text>
      </Text>
      <View style={styles.moodGrid}>
        {MOOD_TAGS.map((mood) => (
          <TouchableOpacity
            key={mood}
            style={[styles.moodChip, selectedMood === mood && styles.moodChipSelected]}
            onPress={() => setValue('moodTag', mood)}
            accessibilityRole="button"
            accessibilityLabel={`Mood: ${mood}`}
            accessibilityState={{ selected: selectedMood === mood }}
          >
            <Text
              style={[styles.moodText, selectedMood === mood && styles.moodTextSelected]}
            >
              {mood}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      {errors.moodTag && <Text style={styles.error}>{errors.moodTag.message}</Text>}

      <Controller
        control={control}
        name="caption"
        render={({ field: { onChange, onBlur, value } }) => (
          <Input
            label="Caption"
            required
            placeholder="What's on your mind?"
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            error={errors.caption?.message}
            multiline
            numberOfLines={4}
            maxLength={CAPTION_MAX_LENGTH}
          />
        )}
      />
      <Text style={styles.charCount}>
        {caption?.length ?? 0}/{CAPTION_MAX_LENGTH}
      </Text>

      {error && <Text style={styles.error} accessibilityRole="alert">{error}</Text>}

      <Button
        title="Share"
        onPress={handleSubmit(onSubmit)}
        loading={isSubmitting}
        disabled={!selectedMedia || !selectedMood || isSubmitting}
      />

      <CrisisSupportModal
        visible={showCrisisModal}
        onEdit={handleCrisisEdit}
        onDismiss={handleCrisisDismiss}
      />
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
    heading: {
      fontSize: FONT_SIZES.xl,
      fontWeight: '700',
      color: colors.text,
      marginBottom: SPACING.xs,
    },
    subheading: {
      fontSize: FONT_SIZES.sm,
      color: colors.textSecondary,
      marginBottom: SPACING.lg,
      lineHeight: 20,
    },
    mediaPicker: {
      aspectRatio: 1,
      backgroundColor: colors.surfaceMuted,
      borderRadius: BORDER_RADIUS.lg,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: SPACING.lg,
      overflow: 'hidden',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderStyle: 'dashed',
    },
    previewWrap: {
      width: '100%',
      height: '100%',
    },
    preview: {
      width: '100%',
      height: '100%',
      alignSelf: 'center',
    },
    videoPlaceholder: {
      flex: 1,
      width: '100%',
      height: '100%',
      alignItems: 'center',
      justifyContent: 'center',
      gap: SPACING.sm,
      backgroundColor: colors.surfaceMuted,
    },
    videoPlaceholderText: {
      color: colors.textMuted,
      fontSize: FONT_SIZES.sm,
      fontWeight: '600',
    },
    videoBadge: {
      position: 'absolute',
      bottom: SPACING.sm,
      left: SPACING.sm,
      backgroundColor: colors.overlay,
      borderRadius: BORDER_RADIUS.full,
      width: 32,
      height: 32,
      alignItems: 'center',
      justifyContent: 'center',
    },
    removeMedia: {
      position: 'absolute',
      top: SPACING.sm,
      right: SPACING.sm,
      backgroundColor: colors.overlay,
      borderRadius: BORDER_RADIUS.full,
    },
    mediaPlaceholder: {
      alignItems: 'center',
      gap: SPACING.sm,
      padding: SPACING.lg,
    },
    mediaPlaceholderText: {
      color: colors.textMuted,
      fontSize: FONT_SIZES.sm,
      fontWeight: '600',
    },
    mediaActions: {
      flexDirection: 'row',
      gap: SPACING.sm,
      marginTop: SPACING.sm,
    },
    label: {
      fontSize: FONT_SIZES.xs,
      color: colors.textMuted,
      marginBottom: SPACING.sm,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    required: {
      color: colors.danger,
      textTransform: 'none',
      letterSpacing: 0,
    },
    moodGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: SPACING.sm,
      marginBottom: SPACING.md,
    },
    moodChip: {
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
      borderRadius: BORDER_RADIUS.full,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      minHeight: 36,
      justifyContent: 'center',
    },
    moodChipSelected: {
      backgroundColor: colors.accentSoft,
      borderColor: colors.primary,
    },
    moodText: {
      fontSize: FONT_SIZES.sm,
      color: colors.textSecondary,
    },
    moodTextSelected: {
      color: colors.primary,
      fontWeight: '600',
    },
    charCount: {
      fontSize: FONT_SIZES.xs,
      color: colors.textMuted,
      textAlign: 'right',
      marginTop: -SPACING.sm,
      marginBottom: SPACING.md,
    },
    error: {
      color: colors.danger,
      fontSize: FONT_SIZES.sm,
      marginBottom: SPACING.md,
    },
  });
}
