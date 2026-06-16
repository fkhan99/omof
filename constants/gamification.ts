import { BadgeId } from '@/types';

export const POINT_VALUES = {
  createPost: 10,
  supportiveComment: 5,
  reactionGiven: 3,
  reactionReceived: 2,
} as const;

export interface BadgeDefinition {
  id: BadgeId;
  title: string;
  description: string;
  icon: string;
}

export const BADGE_DEFINITIONS: Record<BadgeId, BadgeDefinition> = {
  first_real_post: {
    id: 'first_real_post',
    title: 'First Real Post',
    description: 'Shared your first authentic moment.',
    icon: 'leaf-outline',
  },
  supportive_friend: {
    id: 'supportive_friend',
    title: 'Supportive Friend',
    description: 'Left 5 supportive comments on others\' posts.',
    icon: 'heart-outline',
  },
  authenticity_streak_7: {
    id: 'authenticity_streak_7',
    title: '7-Day Authenticity Streak',
    description: 'Showed up authentically for 7 days in a row.',
    icon: 'flame-outline',
  },
  community_builder: {
    id: 'community_builder',
    title: 'Community Builder',
    description: 'Shared 10 posts with the community.',
    icon: 'people-outline',
  },
};

export const DEFAULT_USER_STATS = {
  postsCount: 0,
  commentsCount: 0,
  supportiveCommentsCount: 0,
  reactionsGiven: 0,
  reactionsReceived: 0,
  streakDays: 0,
  points: 0,
  lastActiveDate: null as string | null,
};
