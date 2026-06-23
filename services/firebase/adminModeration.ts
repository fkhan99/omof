import { getFunctions, httpsCallable } from 'firebase/functions';
import { getFirebaseApp } from '@/services/firebase/config';
import { ModerationStatus } from '@/types/moderation';

export interface ModerationQueueItem {
  id: string;
  targetType: 'post' | 'comment';
  authorId: string;
  authorUsername: string;
  text: string;
  postId?: string | null;
  moderationStatus: ModerationStatus;
  moderationReason: string;
  moderationConfidence: number;
  reportCount: number;
  reviewRequired: boolean;
  isHidden: boolean;
  createdAt: number | null;
}

export type AdminModerationAction = 'approve' | 'reject' | 'mark_spam' | 'mark_blocked';

export async function fetchModerationQueue(limit = 30): Promise<ModerationQueueItem[]> {
  const functions = getFunctions(getFirebaseApp());
  const callable = httpsCallable<{ limit?: number }, { items: ModerationQueueItem[] }>(
    functions,
    'adminListModerationQueue',
  );
  const result = await callable({ limit });
  return result.data.items ?? [];
}

export async function performModerationAction(
  targetType: 'post' | 'comment',
  targetId: string,
  action: AdminModerationAction,
  note?: string,
): Promise<void> {
  const functions = getFunctions(getFirebaseApp());
  const callable = httpsCallable(functions, 'adminModerationAction');
  await callable({ targetType, targetId, action, note });
}
