export const MODERATION_STATUSES = [
  'SAFE',
  'SUPPORT_NEEDED',
  'NEEDS_GROWTH',
  'REVIEW',
  'BLOCKED',
  'SPAM',
] as const;

export type ModerationStatus = (typeof MODERATION_STATUSES)[number];

export interface ModerationFields {
  moderationStatus: ModerationStatus;
  moderationReason: string;
  moderationConfidence: number;
  reviewRequired: boolean;
  isHidden: boolean;
  reportCount: number;
}

export interface ModerationClassification {
  status: ModerationStatus;
  reason: string;
  confidence: number;
}

export type ModerationProvider = 'rules' | 'openai';

export interface ModerationReflectionAnswers {
  whatHappened: string;
  supportLookingFor: string;
  hopingToImprove: string;
}
