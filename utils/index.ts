import { Filter } from 'bad-words';
import { CRISIS_PHRASES } from '@/constants/safety';

export { validateUsername } from './validation';

const profanityFilter = new Filter();

export function containsProfanity(text: string): boolean {
  return profanityFilter.isProfane(text);
}

export function filterProfanity(text: string): string {
  return profanityFilter.clean(text);
}

export function containsCrisisLanguage(text: string): boolean {
  const normalized = text.toLowerCase();
  return CRISIS_PHRASES.some((phrase) => normalized.includes(phrase));
}

export function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString();
}

export function formatReactionCount(count: number): string {
  return count === 1 ? '1 person reacted' : `${count} people reacted`;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function getReactionDocId(postId: string, userId: string): string {
  return `${postId}_${userId}`;
}

export function getFollowDocId(followerId: string, followingId: string): string {
  return `${followerId}_${followingId}`;
}

export function getFollowRequestDocId(requesterId: string, targetId: string): string {
  return `${requesterId}_${targetId}`;
}

export function getBlockDocId(blockerId: string, blockedId: string): string {
  return `${blockerId}_${blockedId}`;
}
