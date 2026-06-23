export const MOOD_TAGS = [
  'Frustrated',
  'Embarrassed',
  'Overwhelmed',
  'Lonely',
  'Disappointed',
  'Exhausted',
  'Anxious',
  'Other',
] as const;

export type MoodTag = (typeof MOOD_TAGS)[number];

export const REACTION_TYPES = [
  'relate',
  'been_there',
  'sending_support',
] as const;

export type ReactionType = (typeof REACTION_TYPES)[number];

export const REACTION_LABELS: Record<ReactionType, string> = {
  relate: 'I relate',
  been_there: "I've been there",
  sending_support: 'Sending support',
};

export const REPORT_REASONS = [
  'obscenity',
  'harassment',
  'hate_speech',
  'spam',
  'inappropriate_content',
  'self_harm',
  'not_in_omof_style',
  'other',
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number];

export type { ModerationStatus, ModerationFields, ModerationClassification } from '@/types/moderation';
export { MODERATION_STATUSES } from '@/types/moderation';

export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  obscenity: 'Obscene or explicit content',
  harassment: 'Harassment or bullying',
  hate_speech: 'Hate speech',
  spam: 'Spam',
  inappropriate_content: 'Inappropriate content',
  self_harm: 'Self-harm or dangerous content',
  not_in_omof_style: 'Not in OMOF style',
  other: 'Other',
};

export type NotificationType =
  | 'follow'
  | 'follow_request'
  | 'follow_accepted'
  | 'comment'
  | 'reaction'
  | 'like'
  | 'growth_update'
  | 'post_removed';

export const POST_KINDS = ['moment', 'growth_update'] as const;
export type PostKind = (typeof POST_KINDS)[number];

export interface Notification {
  id: string;
  recipientId: string;
  actorId: string;
  actorUsername: string;
  actorDisplayName: string;
  actorPhotoURL: string | null;
  type: NotificationType;
  postId: string | null;
  postImageURL: string | null;
  commentText: string | null;
  commentId: string | null;
  reactionType: ReactionType | null;
  read: boolean;
  createdAt: Date;
}

export interface CreateNotificationData {
  recipientId: string;
  actorId: string;
  actorUsername: string;
  actorDisplayName: string;
  actorPhotoURL?: string | null;
  type: NotificationType;
  postId?: string | null;
  postImageURL?: string | null;
  commentText?: string | null;
  commentId?: string | null;
  reactionType?: ReactionType | null;
}

export interface User {
  id: string;
  email: string;
  username: string;
  fullName: string;
  displayName: string;
  bio: string;
  photoURL: string | null;
  location: string;
  followerCount: number;
  followingCount: number;
  fcmToken: string | null;
  isPrivate: boolean;
  onboardingComplete: boolean;
  termsAcceptedAt: Date | null;
  privacyPolicyVersion: string | null;
  termsVersion: string | null;
  ageConfirmedAt: Date | null;
  plan: UserPlan;
  promotionCredits: number;
  stats: UserStats;
  badges: BadgeId[];
  isAdmin: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type PostMediaType = 'image' | 'video';

export interface Post {
  id: string;
  authorId: string;
  authorUsername: string;
  authorDisplayName: string;
  authorPhotoURL: string | null;
  mediaType: PostMediaType;
  imageURL: string;
  videoURL: string | null;
  caption: string;
  moodTag: MoodTag;
  postKind: PostKind;
  parentPostId: string | null;
  parentCaption: string | null;
  /** Follow-up reflection stored on the same post as the original moment. */
  growthCaption: string | null;
  growthUpdatedAt: Date | null;
  moderationStatus: ModerationStatus;
  moderationReason: string;
  moderationConfidence: number;
  reviewRequired: boolean;
  isHidden: boolean;
  reportCount: number;
  reactionCounts: Record<ReactionType, number>;
  commentCount: number;
  createdAt: Date;
}

export interface Comment {
  id: string;
  postId: string;
  authorId: string;
  authorUsername: string;
  authorDisplayName: string;
  authorPhotoURL: string | null;
  text: string;
  parentCommentId: string | null;
  replyToUserId: string | null;
  replyToUsername: string | null;
  moderationStatus: ModerationStatus;
  moderationReason: string;
  moderationConfidence: number;
  reviewRequired: boolean;
  isHidden: boolean;
  reportCount: number;
  createdAt: Date;
}

export interface Reaction {
  id: string;
  postId: string;
  userId: string;
  type: ReactionType;
  createdAt: Date;
  updatedAt: Date;
}

export interface Follow {
  id: string;
  followerId: string;
  followingId: string;
  createdAt: Date;
}

export interface FollowRequest {
  id: string;
  requesterId: string;
  targetId: string;
  createdAt: Date;
}

export type FollowRelationship =
  | 'self'
  | 'following'
  | 'not_following'
  | 'requested'
  | 'blocked';

export interface Report {
  id: string;
  reporterId: string;
  targetType: 'post' | 'comment';
  targetId: string;
  reason: ReportReason;
  details: string | null;
  createdAt: Date;
}

export interface BlockedUser {
  id: string;
  blockerId: string;
  blockedId: string;
  blockedUsername: string;
  blockedDisplayName: string;
  createdAt: Date;
}

export interface PaginatedResult<T> {
  items: T[];
  lastDoc: unknown | null;
  hasMore: boolean;
  nextCursor?: Date | null;
}

export type UserPlan = 'free' | 'plus';

export interface UserStats {
  postsCount: number;
  commentsCount: number;
  supportiveCommentsCount: number;
  reactionsGiven: number;
  reactionsReceived: number;
  streakDays: number;
  points: number;
  lastActiveDate: string | null;
}

export const BADGE_IDS = [
  'first_real_post',
  'supportive_friend',
  'authenticity_streak_7',
  'community_builder',
] as const;

export type BadgeId = (typeof BADGE_IDS)[number];

export type PromotionGoal = 'views' | 'reactions' | 'profile_visits';

export const PROMOTION_GOALS: PromotionGoal[] = ['views', 'reactions', 'profile_visits'];

export const PROMOTION_GOAL_LABELS: Record<PromotionGoal, string> = {
  views: 'Reach more people',
  reactions: 'More support',
  profile_visits: 'More profile visits',
};

export type PromotionDurationDays = 1 | 3 | 7;

export const PROMOTION_DURATIONS: PromotionDurationDays[] = [1, 3, 7];

export type PromotionStatus = 'active' | 'expired' | 'paused';

export interface Promotion {
  id: string;
  postId: string;
  ownerId: string;
  goal: PromotionGoal;
  durationDays: PromotionDurationDays;
  status: PromotionStatus;
  createdAt: Date;
  expiresAt: Date;
  impressions: number;
  clicks: number;
}

export interface PostWithPromotion extends Post {
  promotionId?: string;
  isPromoted?: boolean;
}
