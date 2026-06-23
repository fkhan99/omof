import {
  AUTHENTIC_STRUGGLE_PHRASES,
  BLOCKED_HARM_PHRASES,
  BLOCKED_THREAT_PHRASES,
  HATE_SPEECH_PATTERNS,
  NEEDS_GROWTH_PHRASES,
  PROFANITY_TOKENS,
  SPAM_LINK_PATTERN,
  SPAM_SCAM_PHRASES,
  SUPPORT_NEEDED_PHRASES,
} from './phrases';

export type ModerationStatus =
  | 'SAFE'
  | 'SUPPORT_NEEDED'
  | 'NEEDS_GROWTH'
  | 'REVIEW'
  | 'BLOCKED'
  | 'SPAM';

export interface ModerationClassification {
  status: ModerationStatus;
  reason: string;
  confidence: number;
}

function normalize(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ');
}

function includesAnyPhrase(text: string, phrases: string[]): string | null {
  for (const phrase of phrases) {
    if (text.includes(phrase)) return phrase;
  }
  return null;
}

function hasAuthenticStruggleSignal(text: string): boolean {
  return AUTHENTIC_STRUGGLE_PHRASES.some((phrase) => text.includes(phrase));
}

function repeatedCharacterSpam(text: string): boolean {
  return /(.)\1{7,}/.test(text);
}

function linkCount(text: string): number {
  return (text.match(SPAM_LINK_PATTERN) ?? []).length;
}

function isProfane(text: string): boolean {
  return PROFANITY_TOKENS.some((token) => text.includes(token));
}

export function classifyContent(rawText: string): ModerationClassification {
  const text = normalize(rawText);
  if (!text) {
    return { status: 'SAFE', reason: 'Empty content.', confidence: 1 };
  }

  if (repeatedCharacterSpam(text)) {
    return {
      status: 'SPAM',
      reason: 'Repeated characters suggest spam or bot-like content.',
      confidence: 0.92,
    };
  }

  const links = linkCount(text);
  if (links >= 3 || (links >= 1 && text.length < 40)) {
    return {
      status: 'SPAM',
      reason: 'Promotional or link-heavy content without enough context.',
      confidence: 0.88,
    };
  }

  const scamPhrase = includesAnyPhrase(text, SPAM_SCAM_PHRASES);
  if (scamPhrase) {
    return {
      status: 'SPAM',
      reason: `Possible scam or promotional spam (${scamPhrase}).`,
      confidence: 0.9,
    };
  }

  for (const pattern of HATE_SPEECH_PATTERNS) {
    if (pattern.test(text)) {
      return {
        status: 'BLOCKED',
        reason: 'Hate speech or slurs are not allowed on OMOF.',
        confidence: 0.97,
      };
    }
  }

  const harmPhrase = includesAnyPhrase(text, BLOCKED_HARM_PHRASES);
  if (harmPhrase) {
    return {
      status: 'BLOCKED',
      reason: 'Encouraging self-harm or targeted abuse is not allowed.',
      confidence: 0.96,
    };
  }

  const threatPhrase = includesAnyPhrase(text, BLOCKED_THREAT_PHRASES);
  if (threatPhrase) {
    return {
      status: 'BLOCKED',
      reason: 'Threats, doxxing, or violent language are not allowed.',
      confidence: 0.95,
    };
  }

  if (isProfane(text) && /@\w+/.test(text)) {
    return {
      status: 'BLOCKED',
      reason: 'Targeted insults or harassment are not allowed.',
      confidence: 0.84,
    };
  }

  const supportPhrase = includesAnyPhrase(text, SUPPORT_NEEDED_PHRASES);
  if (supportPhrase) {
    return {
      status: 'SUPPORT_NEEDED',
      reason: 'Content may indicate severe distress. Show crisis resources.',
      confidence: 0.9,
    };
  }

  const growthPhrase = includesAnyPhrase(text, NEEDS_GROWTH_PHRASES);
  if (growthPhrase && !hasAuthenticStruggleSignal(text) && text.length < 180) {
    return {
      status: 'NEEDS_GROWTH',
      reason: 'Content may read as vague hopelessness. Prompt for reflection.',
      confidence: 0.78,
    };
  }

  if (isProfane(text) && text.length < 30) {
    return {
      status: 'REVIEW',
      reason: 'Short profane content needs human review.',
      confidence: 0.7,
    };
  }

  if (hasAuthenticStruggleSignal(text)) {
    return {
      status: 'SAFE',
      reason: 'Authentic struggle shared without attacking others.',
      confidence: 0.94,
    };
  }

  return {
    status: 'SAFE',
    reason: 'Content aligns with OMOF community norms.',
    confidence: 0.85,
  };
}

export function moderationFieldsFromClassification(classification: ModerationClassification) {
  const isHidden =
    classification.status === 'REVIEW'
    || classification.status === 'BLOCKED'
    || classification.status === 'SPAM';

  return {
    moderationStatus: classification.status,
    moderationReason: classification.reason,
    moderationConfidence: classification.confidence,
    reviewRequired: classification.status === 'REVIEW',
    isHidden,
  };
}
