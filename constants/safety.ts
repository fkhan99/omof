export const CRISIS_PHRASES = [
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

/**
 * Number of distinct users who must flag a post before it is automatically
 * removed. Large platforms don't publish exact figures, but automated
 * community-moderation systems (e.g. Reddit's AutoModerator, Discord AutoMod)
 * typically act after a small handful of independent reports. For a community
 * this size, 5 distinct reporters is a reasonable bar: high enough to prevent a
 * lone user (or a couple of friends) from silencing someone, low enough to pull
 * genuinely objectionable content quickly.
 */
export const AUTO_REMOVAL_REPORT_THRESHOLD = 5;

export const CRISIS_RESOURCES = [
  { name: '988 Suicide & Crisis Lifeline (US)', contact: 'Call or text 988' },
  { name: 'Crisis Text Line (US)', contact: 'Text HOME to 741741' },
  { name: 'International Association for Suicide Prevention', contact: 'https://www.iasp.info/resources/Crisis_Centres/' },
];
