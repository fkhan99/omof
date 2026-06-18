import { View, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { VideoView, useVideoPlayer } from 'expo-video';
import { Ionicons } from '@expo/vector-icons';
import { Post } from '@/types';
import { SPACING, ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/hooks/useTheme';
import { useVideoThumbnailBackfill } from '@/hooks/useVideoThumbnailBackfill';
import { isVideoPost } from '@/utils/posts';

interface PostMediaProps {
  post: Post;
  mode: 'preview' | 'player';
  onPress?: () => void;
}

function VideoPlayer({ uri, style }: { uri: string; style: ViewStyle }) {
  const player = useVideoPlayer(uri, (instance) => {
    instance.loop = true;
    // Browsers start an autoplayed/preloaded <video> muted to satisfy autoplay
    // policy; assert audio on so user-initiated playback has sound on web.
    instance.muted = false;
    instance.volume = 1.0;
  });

  return (
    <VideoView
      player={player}
      style={style}
      contentFit="cover"
      nativeControls
      playsInline
    />
  );
}

export function PostMedia({ post, mode, onPress }: PostMediaProps) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const isVideo = isVideoPost(post);
  const previewURL = useVideoThumbnailBackfill(post);

  if (mode === 'player' && isVideo && post.videoURL) {
    return <VideoPlayer uri={post.videoURL} style={styles.media} />;
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
