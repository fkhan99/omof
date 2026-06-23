/**
 * Number of distinct users who must flag content before it is hidden for review.
 * Replaces the previous auto-delete behavior.
 */
export { REVIEW_REPORT_THRESHOLD } from '@/constants/moderation';
export { SUPPORT_NEEDED_PHRASES as CRISIS_PHRASES } from '@/constants/moderation';

export const CRISIS_RESOURCES = [
  { name: '988 Suicide & Crisis Lifeline (US)', contact: 'Call or text 988', action: 'tel:988' },
  { name: 'Crisis Text Line (US)', contact: 'Text HOME to 741741', action: 'sms:741741' },
  {
    name: 'International Association for Suicide Prevention',
    contact: 'https://www.iasp.info/resources/Crisis_Centres/',
    action: 'https://www.iasp.info/resources/Crisis_Centres/',
  },
];
