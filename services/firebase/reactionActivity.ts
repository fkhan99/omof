import { DocumentData } from 'firebase/firestore';
import { timestampToDate } from './mappers';

/** Display time for reaction activity — always the latest reaction update. */
export function reactionActivityTimestamp(data: DocumentData): Date {
  return timestampToDate(data.updatedAt ?? data.activityAt ?? data.createdAt);
}
