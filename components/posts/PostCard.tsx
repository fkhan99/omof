import { memo, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { PostWithPromotion } from '@/types';
import { Avatar } from '@/components/ui/Avatar';
import { MoodTagBadge } from '@/components/ui/MoodTagBadge';
import { PostMedia } from '@/components/posts/PostMedia';
import { PromotedLabel } from '@/components/posts/PromotedLabel';
import { ReactionBar } from '@/components/reactions/ReactionBar';
import { PostComments } from '@/components/comments/PostComments';
import { FONT_SIZES, SPACING, BORDER_RADIUS, ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { usePostReaction } from '@/hooks/usePostReaction';
import { usePostLiveCounts } from '@/hooks/usePostLiveCounts';
import { formatRelativeTime, formatReactionCount } from '@/utils';
import { trackPromotionClick, trackPromotionImpression } from '@/services/firebase/promotions';

interface PostCardProps {
  post: PostWithPromotion;
  variant?: 'feed' | 'card';
}

function PostCardComponent({ post, variant = 'feed' }: PostCardProps) {
  const router = useRouter();
  const styles = useThemedStyles(createStyles);
  const isFeed = variant === 'feed';
  const impressionTracked = useRef(false);
  const { userReaction, react } = usePostReaction(post.id);
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
  const totalReactions =
    post.reactionCounts.relate +
    post.reactionCounts.been_there +
    post.reactionCounts.sending_support;

  return (
    <View style={[styles.card, isFeed ? styles.cardFeed : styles.cardRounded]}>
      <TouchableOpacity
        style={styles.header}
        onPress={openProfile}
        accessibilityRole="button"
        accessibilityLabel={`View profile of ${post.authorDisplayName}`}
      >
        <Avatar uri={post.authorPhotoURL} name={post.authorDisplayName} size={40} showRing />
        <View style={styles.headerText}>
          <Text style={styles.displayName}>{post.authorDisplayName}</Text>
          <Text style={styles.meta}>@{post.authorUsername}</Text>
        </View>
        <Text style={styles.time}>{formatRelativeTime(post.createdAt)}</Text>
      </TouchableOpacity>

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

        <ReactionBar userReaction={userReaction} onReact={react} />

        {isFeed ? (
          <PostComments
            postId={post.id}
            commentCount={post.commentCount}
            variant="feed"
          />
        ) : null}
      </View>
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
      marginBottom: SPACING.md,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm + 2,
    },
    headerText: {
      marginLeft: SPACING.sm,
      flex: 1,
    },
    displayName: {
      fontSize: FONT_SIZES.sm,
      fontWeight: '700',
      color: colors.text,
    },
    meta: {
      fontSize: FONT_SIZES.xs,
      color: colors.textMuted,
      marginTop: 1,
    },
    time: {
      fontSize: FONT_SIZES.xs,
      color: colors.textMuted,
    },
    body: {
      paddingHorizontal: SPACING.md,
      paddingBottom: SPACING.md,
      paddingTop: SPACING.sm,
      gap: SPACING.xs,
    },
    moodRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    reactionCount: {
      fontSize: FONT_SIZES.sm,
      fontWeight: '700',
      color: colors.text,
    },
    caption: {
      fontSize: FONT_SIZES.sm,
      color: colors.text,
      lineHeight: 20,
    },
    captionUser: {
      fontWeight: '700',
      color: colors.text,
    },
  });
}
