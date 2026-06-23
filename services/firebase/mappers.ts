import {
  Timestamp,
  DocumentData,
  QueryDocumentSnapshot,
} from 'firebase/firestore';
import {
  User,
  Post,
  Comment,
  Reaction,
  Follow,
  FollowRequest,
  Notification,
  Report,
  BlockedUser,
  MoodTag,
  ReactionType,
  ReportReason,
  NotificationType,
  UserPlan,
  UserStats,
  BadgeId,
  Promotion,
} from '@/types';
import { DEFAULT_USER_STATS } from '@/constants/gamification';

export function timestampToDate(value: Timestamp | Date | null | undefined): Date {
  if (!value) return new Date();
  if (value instanceof Date) return value;
  return value.toDate();
}

export function mapUserDoc(id: string, data: DocumentData): User {
  const hasProfileFields = Boolean(data.username && data.displayName);
  const rawStats = data.stats as Partial<UserStats> | undefined;

  return {
    id,
    email: data.email ?? '',
    username: data.username ?? '',
    displayName: data.displayName ?? '',
    bio: data.bio ?? '',
    photoURL: data.photoURL ?? null,
    followerCount: data.followerCount ?? 0,
    followingCount: data.followingCount ?? 0,
    fcmToken: data.fcmToken ?? null,
    isPrivate: data.isPrivate ?? false,
    onboardingComplete: data.onboardingComplete ?? hasProfileFields,
    termsAcceptedAt: data.termsAcceptedAt ? timestampToDate(data.termsAcceptedAt) : null,
    privacyPolicyVersion: data.privacyPolicyVersion ?? null,
    termsVersion: data.termsVersion ?? null,
    ageConfirmedAt: data.ageConfirmedAt ? timestampToDate(data.ageConfirmedAt) : null,
    plan: (data.plan as UserPlan) ?? 'free',
    promotionCredits: data.promotionCredits ?? 0,
    stats: {
      postsCount: rawStats?.postsCount ?? 0,
      commentsCount: rawStats?.commentsCount ?? 0,
      supportiveCommentsCount: rawStats?.supportiveCommentsCount ?? 0,
      reactionsGiven: rawStats?.reactionsGiven ?? 0,
      reactionsReceived: rawStats?.reactionsReceived ?? 0,
      streakDays: rawStats?.streakDays ?? 0,
      points: rawStats?.points ?? 0,
      lastActiveDate: rawStats?.lastActiveDate ?? null,
    },
    badges: (data.badges as BadgeId[]) ?? [],
    createdAt: timestampToDate(data.createdAt),
    updatedAt: timestampToDate(data.updatedAt),
  };
}

export function mapPostDoc(id: string, data: DocumentData): Post {
  return {
    id,
    authorId: data.authorId,
    authorUsername: data.authorUsername,
    authorDisplayName: data.authorDisplayName,
    authorPhotoURL: data.authorPhotoURL ?? null,
    mediaType: (data.mediaType as Post['mediaType']) ?? 'image',
    imageURL: data.imageURL,
    videoURL: data.videoURL ?? null,
    caption: data.caption,
    moodTag: data.moodTag as MoodTag,
    postKind: (data.postKind as Post['postKind']) ?? 'moment',
    parentPostId: data.parentPostId ?? null,
    parentCaption: data.parentCaption ?? null,
    reactionCounts: data.reactionCounts ?? {
      relate: 0,
      been_there: 0,
      sending_support: 0,
    },
    commentCount: data.commentCount ?? 0,
    createdAt: timestampToDate(data.createdAt),
  };
}

export function mapCommentDoc(id: string, data: DocumentData): Comment {
  return {
    id,
    postId: data.postId,
    authorId: data.authorId,
    authorUsername: data.authorUsername,
    authorDisplayName: data.authorDisplayName,
    authorPhotoURL: data.authorPhotoURL ?? null,
    text: data.text,
    createdAt: timestampToDate(data.createdAt),
  };
}

export function mapReactionDoc(id: string, data: DocumentData): Reaction {
  return {
    id,
    postId: data.postId,
    userId: data.userId,
    type: data.type as ReactionType,
    createdAt: timestampToDate(data.createdAt),
    updatedAt: timestampToDate(data.updatedAt),
  };
}

export function mapFollowDoc(id: string, data: DocumentData): Follow {
  return {
    id,
    followerId: data.followerId,
    followingId: data.followingId,
    createdAt: timestampToDate(data.createdAt),
  };
}

export function mapFollowRequestDoc(id: string, data: DocumentData): FollowRequest {
  return {
    id,
    requesterId: data.requesterId,
    targetId: data.targetId,
    createdAt: timestampToDate(data.createdAt),
  };
}

export function mapNotificationDoc(id: string, data: DocumentData): Notification {
  return {
    id,
    recipientId: data.recipientId,
    actorId: data.actorId,
    actorUsername: data.actorUsername,
    actorDisplayName: data.actorDisplayName,
    actorPhotoURL: data.actorPhotoURL ?? null,
    type: data.type as NotificationType,
    postId: data.postId ?? null,
    postImageURL: data.postImageURL ?? null,
    commentText: data.commentText ?? null,
    commentId: data.commentId ?? null,
    reactionType: (data.reactionType as ReactionType) ?? null,
    read: data.read ?? false,
    createdAt: timestampToDate(data.activityAt ?? data.createdAt),
  };
}

export function mapReportDoc(id: string, data: DocumentData): Report {
  return {
    id,
    reporterId: data.reporterId,
    targetType: data.targetType,
    targetId: data.targetId,
    reason: data.reason as ReportReason,
    details: data.details ?? null,
    createdAt: timestampToDate(data.createdAt),
  };
}

export function mapBlockedUserDoc(id: string, data: DocumentData): BlockedUser {
  return {
    id,
    blockerId: data.blockerId,
    blockedId: data.blockedId,
    blockedUsername: data.blockedUsername,
    blockedDisplayName: data.blockedDisplayName,
    createdAt: timestampToDate(data.createdAt),
  };
}

export function mapPromotionDoc(id: string, data: DocumentData): Promotion {
  return {
    id,
    postId: data.postId,
    ownerId: data.ownerId,
    goal: data.goal,
    durationDays: data.durationDays,
    status: data.status,
    createdAt: timestampToDate(data.createdAt),
    expiresAt: timestampToDate(data.expiresAt),
    impressions: data.impressions ?? 0,
    clicks: data.clicks ?? 0,
  };
}

export function getDefaultUserFields() {
  return {
    plan: 'free' as UserPlan,
    promotionCredits: 0,
    stats: DEFAULT_USER_STATS,
    badges: [] as BadgeId[],
  };
}

export function getDocIdFromSnapshot(
  doc: QueryDocumentSnapshot<DocumentData>,
): string {
  return doc.id;
}
