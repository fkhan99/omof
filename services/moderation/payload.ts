import { ModerationFields } from '@/types/moderation';

export type ModerationWritePayload = Pick<
  ModerationFields,
  | 'moderationStatus'
  | 'moderationReason'
  | 'moderationConfidence'
  | 'reviewRequired'
  | 'isHidden'
  | 'reportCount'
>;

export function moderationPayload(fields: ModerationWritePayload) {
  return {
    moderationStatus: fields.moderationStatus,
    moderationReason: fields.moderationReason,
    moderationConfidence: fields.moderationConfidence,
    reviewRequired: fields.reviewRequired,
    isHidden: fields.isHidden,
    reportCount: fields.reportCount ?? 0,
  };
}
