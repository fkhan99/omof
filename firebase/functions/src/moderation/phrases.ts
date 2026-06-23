/** Keep in sync with constants/moderation.ts */

export const REVIEW_REPORT_THRESHOLD = 3;

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

/** Minimal profanity list for targeted-insult detection (server-side). */
export const PROFANITY_TOKENS = [
  'fuck',
  'shit',
  'bitch',
  'asshole',
  'bastard',
  'damn',
  'cunt',
  'dick',
  'piss',
];
