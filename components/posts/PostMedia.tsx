import { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
} from 'react-native';
import { Image, type ImageLoadEventData } from 'expo-image';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useEvent } from 'expo';
import { Ionicons } from '@expo/vector-icons';
import { Post } from '@/types';
import { SPACING, ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/hooks/useTheme';
import { useVideoThumbnailBackfill } from '@/hooks/useVideoThumbnailBackfill';
import { isVideoPost } from '@/utils/posts';

interface PostMediaProps {
  post: Post;
  mode: 'preview' | 'feed' | 'player';
  onPress?: () => void;
}

// Keep extreme aspect ratios in check so very tall/wide media stays usable.
const MIN_ASPECT_RATIO = 0.5;
const MAX_ASPECT_RATIO = 3;

function clampAspectRatio(ratio: number): number {
  if (!Number.isFinite(ratio) || ratio <= 0) return 1;
  return Math.min(MAX_ASPECT_RATIO, Math.max(MIN_ASPECT_RATIO, ratio));
}

function useMaxMediaHeight(): number {
  const { height } = useWindowDimensions();
  return Math.round(height * 0.8);
}

function FullVideo({ uri }: { uri: string }) {
  const styles = useThemedStyles(createStyles);
  const maxHeight = useMaxMediaHeight();
  const [aspectRatio, setAspectRatio] = useState(1);

  const player = useVideoPlayer(uri, (instance) => {
    instance.loop = true;
    // Browsers start an autoplayed/preloaded <video> muted to satisfy autoplay
    // policy; assert audio on so user-initiated playback has sound on web.
    instance.muted = false;
    instance.volume = 1.0;
  });

  const sourceLoad = useEvent(player, 'sourceLoad');

  useEffect(() => {
    const size = sourceLoad?.availableVideoTracks?.[0]?.size;
    if (size?.width && size?.height) {
      setAspectRatio(clampAspectRatio(size.width / size.height));
    }
  }, [sourceLoad]);

  return (
    <VideoView
      player={player}
      style={[styles.fullMedia, { aspectRatio, maxHeight }]}
      contentFit="contain"
      nativeControls
      playsInline
    />
  );
}

function FullImage({ uri }: { uri: string }) {
  const styles = useThemedStyles(createStyles);
  const maxHeight = useMaxMediaHeight();
  const [aspectRatio, setAspectRatio] = useState(1);

  const handleLoad = (event: ImageLoadEventData) => {
    const { width, height } = event.source;
    if (width && height) {
      setAspectRatio(clampAspectRatio(width / height));
    }
  };

  return (
    <Image
      source={{ uri }}
      style={[styles.fullMedia, { aspectRatio, maxHeight }]}
      contentFit="contain"
      onLoad={handleLoad}
      accessibilityLabel="Post image"
    />
  );
}

export function PostMedia({ post, mode, onPress }: PostMediaProps) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const isVideo = isVideoPost(post);
  const previewURL = useVideoThumbnailBackfill(post);

  if (mode === 'player' && isVideo && post.videoURL) {
    return <FullVideo uri={post.videoURL} />;
  }

  if (mode === 'player' && !isVideo && post.imageURL) {
    return <FullImage uri={post.imageURL} />;
  }

  const content = (
    <View style={styles.mediaWrap}>
      <Image
        source={{ uri: previewURL }}
        style={styles.media}
        contentFit="cover"
        accessibilityLabel={isVideo ? 'Video thumbnail' : 'Post image'}
      />
      {isVideo ? (
        <View style={styles.playOverlay} pointerEvents="none">
          <View style={styles.playButton}>
            <Ionicons name="play" size={28} color={colors.white} />
          </View>
        </View>
      ) : null}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.95} accessibilityRole="button">
        {content}
      </TouchableOpacity>
    );
  }

  return content;
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    mediaWrap: {
      position: 'relative',
    },
    media: {
      width: '100%',
      aspectRatio: 1,
      backgroundColor: colors.surfaceMuted,
    },
    fullMedia: {
      width: '100%',
      alignSelf: 'center',
      backgroundColor: colors.black,
    },
    playOverlay: {
      ...StyleSheet.absoluteFill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0, 0, 0, 0.15)',
    },
    playButton: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: colors.overlay,
      alignItems: 'center',
      justifyContent: 'center',
      paddingLeft: SPACING.xs,
    },
  });
}
