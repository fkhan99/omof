import { ModerationClassification } from '@/types/moderation';
import { MODERATION_COPY } from '@/constants/moderation';
import {
  buildModerationFields,
  classifyContent,
  mergeReflectionIntoCaption,
} from '@/utils/moderation/classifyContent';

export interface PrePublishModerationResult {
  canPublish: boolean;
  classification: ModerationClassification;
  caption: string;
  moderationFields: ReturnType<typeof buildModerationFields>;
  blockedMessage?: string;
  requiresSupportFlow?: boolean;
  requiresGrowthFlow?: boolean;
  requiresReviewAck?: boolean;
}

export function evaluatePrePublish(
  caption: string,
  options: {
    submitForReview?: boolean;
    reflectionApplied?: boolean;
  } = {},
): PrePublishModerationResult {
  const classification = classifyContent(caption);
  let finalClassification = classification;
  let finalCaption = caption;

  if (options.reflectionApplied && classification.status === 'NEEDS_GROWTH') {
    finalClassification = classifyContent(finalCaption);
  }

  if (finalClassification.status === 'BLOCKED' || finalClassification.status === 'SPAM') {
    return {
      canPublish: false,
      classification: finalClassification,
      caption: finalCaption,
      moderationFields: buildModerationFields(finalClassification),
      blockedMessage:
        finalClassification.status === 'SPAM' ? MODERATION_COPY.spam : MODERATION_COPY.blocked,
    };
  }

  if (finalClassification.status === 'SUPPORT_NEEDED') {
    if (options.submitForReview) {
      const moderationFields = buildModerationFields(finalClassification, {
        forceReview: true,
        forceHidden: true,
      });
      return {
        canPublish: true,
        classification: { ...finalClassification, status: 'REVIEW' },
        caption: finalCaption,
        moderationFields,
        requiresReviewAck: true,
      };
    }

    return {
      canPublish: false,
      classification: finalClassification,
      caption: finalCaption,
      moderationFields: buildModerationFields(finalClassification),
      requiresSupportFlow: true,
    };
  }

  if (finalClassification.status === 'NEEDS_GROWTH' && !options.reflectionApplied) {
    return {
      canPublish: false,
      classification: finalClassification,
      caption: finalCaption,
      moderationFields: buildModerationFields(finalClassification),
      requiresGrowthFlow: true,
    };
  }

  if (finalClassification.status === 'REVIEW' || options.submitForReview) {
    const moderationFields = buildModerationFields(finalClassification, {
      forceReview: true,
      forceHidden: true,
    });
    return {
      canPublish: true,
      classification: finalClassification,
      caption: finalCaption,
      moderationFields,
      requiresReviewAck: true,
    };
  }

  return {
    canPublish: true,
    classification: finalClassification,
    caption: finalCaption,
    moderationFields: buildModerationFields(finalClassification),
  };
}

export function applyReflectionToCaption(
  caption: string,
  reflection: {
    whatHappened: string;
    supportLookingFor: string;
    hopingToImprove: string;
  },
): string {
  return mergeReflectionIntoCaption(caption, reflection);
}
