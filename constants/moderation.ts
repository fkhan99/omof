import { ModerationStatus } from '@/types/moderation';

/** Distinct reporters before content is hidden and sent to review. */
export const REVIEW_REPORT_THRESHOLD = 3;

/** Keep in sync with firebase/functions/src/moderation/config.ts */
export const MODERATION_PROVIDER_ENV = 'MODERATION_PROVIDER';

export const MODERATION_COPY = {
  blocked:
    "This doesn't align with OMOF's community goals. Please revise before posting.",
  spam: "This looks like spam. Please revise before posting.",
  needsGrowthTitle: 'Add a little more context',
  needsGrowthMessage:
    'OMOF is built for real experiences and support. Want to add a little more context so others can understand and support you?',
  supportTitle: "We're sorry you're going through this",
  supportMessage:
    "OMOF is not a crisis service. If you're in immediate danger, contact local emergency services or a trusted person now. You can also reach a crisis hotline in your country.",
  reviewPending:
    'Your post was submitted for review and will appear if approved.',
  commentReviewPending:
    'Your comment was submitted for review and will appear if approved.',
} as const;

export const MODERATION_REFLECTION_PROMPTS = {
  whatHappened: 'What happened?',
  supportLookingFor: 'What support are you looking for?',
  hopingToImprove: 'What are you hoping will improve?',
} as const;

/** Self-harm / severe distress — route to support, not auto-block. */
export const SUPPORT_NEEDED_PHRASES = [
  'kill myself',
  'want to die',
  'end my life',
  'suicide',
  'self harm',
  'self-harm',
  'hurt myself',
  'no reason to live',
  'better off dead',
  'going to end it',
];

/** Encouraging harm to others or self — block. */
export const BLOCKED_HARM_PHRASES = [
  'kill yourself',
  'kys',
  'go die',
  'you should die',
  'hope you die',
  'end yourself',
];

export const BLOCKED_THREAT_PHRASES = [
  'i will kill',
  "i'll kill",
  'going to kill you',
  'hurt you',
  'find you and',
  'doxx',
  'dox you',
  'leak your address',
];

export const HATE_SPEECH_PATTERNS = [
  /\bnigg(a|er|as|ers)\b/i,
  /\bfagg(o|ot|ots)\b/i,
  /\bretard(ed|s)?\b/i,
  /\bchink(s)?\b/i,
  /\bspic(s)?\b/i,
];

export const SPAM_LINK_PATTERN = /https?:\/\/[^\s]+/gi;
export const SPAM_SCAM_PHRASES = [
  'click here',
  'free money',
  'crypto giveaway',
  'dm me for',
  'whatsapp me',
  'telegram me',
  'investment opportunity',
  'make $',
  'work from home guaranteed',
];

/** Unconstructive doom-posting — prompt reflection, not block. */
export const NEEDS_GROWTH_PHRASES = [
  'nothing matters',
  'what is the point',
  "what's the point",
  'no point anymore',
  'everything is hopeless',
  'nothing will ever change',
  'life is meaningless',
  'give up on everything',
];

/** Authentic struggle signals — never escalate to NEEDS_GROWTH/BLOCKED alone. */
export const AUTHENTIC_STRUGGLE_PHRASES = [
  'failed',
  'embarrassed',
  'lonely',
  'burnout',
  'burned out',
  'anxious',
  'overwhelmed',
  'disappointed',
  'exhausted',
  'frustrated',
  'stressed',
  'setback',
  'struggling',
  'hard day',
  'tough day',
  'not my best',
  'learning',
  'growing',
  'support',
  'therapy',
  'journal',
];

export function shouldHideFromPublic(status: ModerationStatus): boolean {
  return status === 'REVIEW' || status === 'BLOCKED' || status === 'SPAM';
}

export function isPublishBlocked(status: ModerationStatus): boolean {
  return status === 'BLOCKED' || status === 'SPAM';
}
