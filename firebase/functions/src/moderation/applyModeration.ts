import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { classifyWithProvider } from './provider';
import { ModerationClassification, moderationFieldsFromClassification } from './classifyContent';

const FieldValue = admin.firestore.FieldValue;

interface ExistingModeration {
  reviewRequired?: boolean;
  moderationStatus?: string;
}

export async function applyServerModeration(
  ref: admin.firestore.DocumentReference,
  text: string,
  existing: ExistingModeration = {},
): Promise<ModerationClassification> {
  const classification = await classifyWithProvider(text);
  const fields = moderationFieldsFromClassification(classification);

  let moderationStatus = fields.moderationStatus;
  let reviewRequired = fields.reviewRequired;
  let isHidden = fields.isHidden;
  let moderationReason = fields.moderationReason;
  let moderationConfidence = fields.moderationConfidence;

  const clientRequestedReview = existing.reviewRequired === true;

  if (clientRequestedReview && classification.status !== 'BLOCKED' && classification.status !== 'SPAM') {
    reviewRequired = true;
    isHidden = true;
    if (classification.status === 'SUPPORT_NEEDED' || classification.status === 'REVIEW') {
      moderationStatus = classification.status;
    } else {
      moderationStatus = 'REVIEW';
      moderationReason = `Submitted for review. Server: ${classification.reason}`;
    }
  }

  await ref.update({
    moderationStatus,
    moderationReason,
    moderationConfidence,
    reviewRequired,
    isHidden,
    moderationUpdatedAt: FieldValue.serverTimestamp(),
  });

  functions.logger.info('[moderation] applied', {
    docPath: ref.path,
    moderationStatus,
    reviewRequired,
    isHidden,
    confidence: moderationConfidence,
  });

  return { status: moderationStatus as ModerationClassification['status'], reason: moderationReason, confidence: moderationConfidence };
}

export function getPostModerationText(post: {
  caption?: unknown;
  growthCaption?: unknown;
}): string {
  const caption = typeof post.caption === 'string' ? post.caption : '';
  const growth = typeof post.growthCaption === 'string' ? post.growthCaption : '';
  return [caption, growth].filter(Boolean).join('\n\n');
}
