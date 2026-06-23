export { classifyContent, buildModerationFields, mergeReflectionIntoCaption } from './classifyContent';

export function isContentPubliclyVisible(item: {
  isHidden?: boolean;
  moderationStatus?: string;
  authorId: string;
}, viewerId?: string): boolean {
  if (viewerId && item.authorId === viewerId) return true;
  if (item.isHidden) return false;
  const status = item.moderationStatus ?? 'SAFE';
  return status !== 'REVIEW' && status !== 'BLOCKED' && status !== 'SPAM';
}
