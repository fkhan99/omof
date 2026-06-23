import { memo, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { PostWithPromotion } from '@/types';
import { Avatar } from '@/components/ui/Avatar';
import { MoodTagBadge } from '@/components/ui/MoodTagBadge';
import { PostMedia } from '@/components/posts/PostMedia';
import { PromotedLabel } from '@/components/posts/PromotedLabel';
import { PostGrowthSection } from '@/components/posts/PostGrowthSection';
import { ReactionBar } from '@/components/reactions/ReactionBar';
import { PostComments } from '@/components/comments/PostComments';
import { OptionsMenu } from '@/components/ui/OptionsMenu';
import { FONT_SIZES, SPACING, BORDER_RADIUS, ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/hooks/useTheme';
import { usePostReaction } from '@/hooks/usePostReaction';
import { usePostLiveCounts } from '@/hooks/usePostLiveCounts';
import { useAuthStore } from '@/store/authStore';
import { formatRelativeTime, formatReactionCount } from '@/utils';
import { hasGrowthUpdate } from '@/utils/posts';
import { trackPromotionClick, trackPromotionImpression } from '@/services/firebase/promotions';

interface PostCardProps {
  post: PostWithPromotion;
  variant?: 'feed' | 'card';
}

function PostCardComponent({ post, variant = 'feed' }: PostCardProps) {
  const router = useRouter();
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const authUid = useAuthStore((s) => s.firebaseUser?.uid);
  const isFeed = variant === 'feed';
  const isOwnPost = authUid === post.authorId;
  const [menuVisible, setMenuVisible] = useState(false);
  const impressionTracked = useRef(false);
  const { userReaction, react } = usePostReaction(post.id, post.authorId);
  usePostLiveCounts(post.id);

  useEffect(() => {
    if (post.isPromoted && post.promotionId && !impressionTracked.current) {
      impressionTracked.current = true;
      void trackPromotionImpression(post.promotionId);
    }
  }, [post.isPromoted, post.promotionId]);

  const openPost = () => {
    if (post.isPromoted && post.promotionId) {
      void trackPromotionClick(post.promotionId);
    }
    router.push(`/post/${post.id}`);
  };

  const openProfile = () => {
    if (post.isPromoted && post.promotionId) {
      void trackPromotionClick(post.promotionId);
    }
    router.push(`/user/${post.authorUsername}`);
  };

  const handleReportPost = () => {
    router.push({
      pathname: '/report',
      params: { targetType: 'post', targetId: post.id },
    });
  };

  const totalReactions =
    post.reactionCounts.relate +
    post.reactionCounts.been_there +
    post.reactionCounts.sending_support;

  return (
    <View style={[styles.card, isFeed ? styles.cardFeed : styles.cardRounded]}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerMain}
          onPress={openProfile}
          accessibilityRole="button"
          accessibilityLabel={`View profile of ${post.authorDisplayName}`}
        >
          <Avatar uri={post.authorPhotoURL} name={post.authorDisplayName} size={40} showRing />
          <View style={styles.headerText}>
            <Text style={styles.displayName}>{post.authorDisplayName}</Text>
            <Text style={styles.meta}>@{post.authorUsername}</Text>
          </View>
        </TouchableOpacity>
        <View style={styles.headerAside}>
          <Text style={styles.time}>{formatRelativeTime(post.createdAt)}</Text>
          <TouchableOpacity
            style={styles.menuButton}
            onPress={() => setMenuVisible(true)}
            accessibilityRole="button"
            accessibilityLabel={isOwnPost ? 'Post options' : 'Report post'}
            hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
          >
            <Ionicons name="ellipsis-horizontal" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      </View>

      <PostMedia post={post} mode="feed" onPress={openPost} />

      <View style={styles.body}>
        {post.isPromoted ? <PromotedLabel /> : null}
        <View style={styles.moodRow}>
          <MoodTagBadge mood={post.moodTag} />
        </View>

        {totalReactions > 0 ? (
          <Text style={styles.reactionCount}>{formatReactionCount(totalReactions)}</Text>
        ) : null}

        <Text style={styles.caption} numberOfLines={3}>
          <Text style={styles.captionUser}>{post.authorUsername} </Text>
          {post.caption}
        </Text>

        {hasGrowthUpdate(post) ? (
          <PostGrowthSection
            growthCaption={post.growthCaption!}
            updatedAt={post.growthUpdatedAt}
            compact
          />
        ) : null}

        <ReactionBar userReaction={userReaction} onReact={react} disabled={isOwnPost} />

        <PostComments
          postId={post.id}
          commentCount={post.commentCount}
          variant="feed"
        />
      </View>

      <OptionsMenu
        visible={menuVisible}
        title={isOwnPost ? 'Post options' : undefined}
        onClose={() => setMenuVisible(false)}
        options={
          isOwnPost
            ? [{ label: 'View post', onPress: openPost }]
            : [{ label: 'Report post', destructive: true, onPress: handleReportPost }]
        }
      />
    </View>
  );
}

export const PostCard = memo(PostCardComponent);

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      overflow: 'hidden',
    },
    cardFeed: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
      marginBottom: SPACING.sm,
    },
    cardRounded: {
      borderRadius: BORDER_RADIUS.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      marginHorizontal: SPACING.md,
      marginBottom: SPACING.md,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: SPACING.md,
      paddingBottom: SPACING.sm,
    },
    headerMain: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
    },
    headerAside: {
      alignItems: 'flex-end',
      gap: SPACING.xs,
    },
    headerText: {
      marginLeft: SPACING.sm,
      flex: 1,
    },
    displayName: {
      fontSize: FONT_SIZES.md,
      fontWeight: '600',
      color: colors.text,
    },
    meta: {
      fontSize: FONT_SIZES.sm,
      color: colors.textMuted,
    },
    time: {
      fontSize: FONT_SIZES.xs,
      color: colors.textMuted,
    },
    menuButton: {
      padding: SPACING.xs,
    },
    body: {
      paddingHorizontal: SPACING.md,
      paddingBottom: SPACING.md,
    },
    moodRow: {
      marginBottom: SPACING.sm,
    },
    reactionCount: {
      fontSize: FONT_SIZES.sm,
      color: colors.textSecondary,
      marginBottom: SPACING.xs,
    },
    caption: {
      fontSize: FONT_SIZES.md,
      color: colors.text,
      lineHeight: 22,
      marginBottom: SPACING.sm,
    },
    captionUser: {
      fontWeight: '600',
    },
  });
}
