import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { getFirebaseDb } from './config';
import { mapBlockedUserDoc, mapReportDoc } from './mappers';
import { BlockedUser, Report, ReportReason } from '@/types';
import { getBlockDocId } from '@/utils';

export async function blockUser(
  blockerId: string,
  blockedUser: { id: string; username: string; displayName: string },
): Promise<BlockedUser> {
  const db = getFirebaseDb();
  const blockId = getBlockDocId(blockerId, blockedUser.id);

  await setDoc(doc(db, 'blockedUsers', blockId), {
    blockerId,
    blockedId: blockedUser.id,
    blockedUsername: blockedUser.username,
    blockedDisplayName: blockedUser.displayName,
    createdAt: serverTimestamp(),
  });

  const snap = await getDoc(doc(db, 'blockedUsers', blockId));
  return mapBlockedUserDoc(snap.id, snap.data()!);
}

export async function unblockUser(blockerId: string, blockedId: string): Promise<void> {
  const db = getFirebaseDb();
  const blockId = getBlockDocId(blockerId, blockedId);
  await deleteDoc(doc(db, 'blockedUsers', blockId));
}

export async function isUserBlocked(blockerId: string, blockedId: string): Promise<boolean> {
  const db = getFirebaseDb();
  const blockId = getBlockDocId(blockerId, blockedId);
  const snap = await getDoc(doc(db, 'blockedUsers', blockId));
  return snap.exists();
}

export async function getBlockedUsers(blockerId: string): Promise<BlockedUser[]> {
  const db = getFirebaseDb();
  const q = query(collection(db, 'blockedUsers'), where('blockerId', '==', blockerId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => mapBlockedUserDoc(d.id, d.data()));
}

export async function getBlockedUserIds(blockerId: string): Promise<string[]> {
  const blocked = await getBlockedUsers(blockerId);
  return blocked.map((b) => b.blockedId);
}

export async function reportContent(
  reporterId: string,
  targetType: 'post' | 'comment',
  targetId: string,
  reason: ReportReason,
  details?: string,
): Promise<Report> {
  const db = getFirebaseDb();

  // Deterministic id => one flag per user per target. This keeps the
  // auto-moderation count honest (distinct reporters == report docs) and
  // prevents a single user from inflating the count by reporting repeatedly.
  const reportId = `${targetId}_${reporterId}`;
  const reportRef = doc(db, 'reports', reportId);

  const existing = await getDoc(reportRef);
  if (existing.exists()) {
    return mapReportDoc(existing.id, existing.data()!);
  }

  let postAuthorId: string | null = null;
  if (targetType === 'post') {
    const postSnap = await getDoc(doc(db, 'posts', targetId));
    postAuthorId = postSnap.exists() ? postSnap.data().authorId ?? null : null;
  }

  await setDoc(reportRef, {
    reporterId,
    targetType,
    targetId,
    postAuthorId,
    reason,
    details: details ?? null,
    createdAt: serverTimestamp(),
  });

  const snap = await getDoc(reportRef);
  return mapReportDoc(snap.id, snap.data()!);
}
