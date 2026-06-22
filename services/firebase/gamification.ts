import {
  doc,
  getDoc,
  getDocs,
  updateDoc,
  collection,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { getFirebaseDb } from './config';
import { BadgeId, UserStats } from '@/types';
import { POINT_VALUES } from '@/constants/gamification';
import { computeNextStreak, todayKey } from '@/utils/streak';

function normalizeStats(raw: Partial<UserStats> | undefined): UserStats {
  return {
    postsCount: raw?.postsCount ?? 0,
    commentsCount: raw?.commentsCount ?? 0,
    supportiveCommentsCount: raw?.supportiveCommentsCount ?? 0,
    reactionsGiven: raw?.reactionsGiven ?? 0,
    reactionsReceived: raw?.reactionsReceived ?? 0,
    streakDays: raw?.streakDays ?? 0,
    points: raw?.points ?? 0,
    lastActiveDate: raw?.lastActiveDate ?? null,
  };
}

function computeStreakDays(current: UserStats): number {
  return computeNextStreak(current.lastActiveDate, current.streakDays);
}

function computePointsFromCounts(
  stats: Pick<UserStats, 'postsCount' | 'supportiveCommentsCount' | 'reactionsGiven' | 'reactionsReceived'>,
): number {
  return (
    stats.postsCount * POINT_VALUES.createPost
    + stats.supportiveCommentsCount * POINT_VALUES.supportiveComment
    + stats.reactionsGiven * POINT_VALUES.reactionGiven
    + stats.reactionsReceived * POINT_VALUES.reactionReceived
  );
}

function computeBadgesFromStats(stats: UserStats): BadgeId[] {
  const badges: BadgeId[] = [];
  if (stats.postsCount >= 1) badges.push('first_real_post');
  if (stats.supportiveCommentsCount >= 5) badges.push('supportive_friend');
  if (stats.streakDays >= 7) badges.push('authenticity_streak_7');
  if (stats.postsCount >= 10) badges.push('community_builder');
  return badges;
}

/**
 * Sync a user's progress when they open the app:
 *  - advances the day streak based on the last active date, and
 *  - reconciles posts / comments / supportive / reactions counts from the
 *    actual collections (so activity from before counters existed, or any
 *    drift, is reflected).
 * Writes only when something actually changed.
 */
export async function syncUserProgress(userId: string): Promise<UserStats | null> {
  const db = getFirebaseDb();
  const userRef = doc(db, 'users', userId);
  const snap = await getDoc(userRef);
  if (!snap.exists()) return null;

  const currentStats = normalizeStats(snap.data().stats as Partial<UserStats> | undefined);
  const currentBadges = (snap.data().badges as BadgeId[]) ?? [];

  const [postsSnap, commentsSnap, reactionsGivenSnap, reactionsReceivedSnap] = await Promise.all([
    getDocs(query(collection(db, 'posts'), where('authorId', '==', userId))),
    getDocs(query(collection(db, 'comments'), where('authorId', '==', userId))),
    getDocs(query(collection(db, 'reactions'), where('userId', '==', userId))),
    getDocs(query(collection(db, 'reactions'), where('postAuthorId', '==', userId))),
  ]);

  // A "supportive" comment is one made on a post the user does not own.
  const ownPostIds = new Set(postsSnap.docs.map((postDoc) => postDoc.id));
  let supportiveCommentsCount = 0;
  commentsSnap.docs.forEach((commentDoc) => {
    const postId = commentDoc.data().postId as string | undefined;
    if (postId && !ownPostIds.has(postId)) supportiveCommentsCount += 1;
  });

  const reactionsGiven = reactionsGivenSnap.size;
  // Received excludes self-reactions, matching the live counter behavior.
  const reactionsReceived = reactionsReceivedSnap.docs.filter(
    (reactionDoc) => reactionDoc.data().userId !== userId,
  ).length;

  const streakDays = computeStreakDays(currentStats);

  const nextStats: UserStats = {
    postsCount: postsSnap.size,
    commentsCount: commentsSnap.size,
    supportiveCommentsCount,
    reactionsGiven,
    reactionsReceived,
    streakDays,
    points: 0,
    lastActiveDate: todayKey(),
  };
  nextStats.points = computePointsFromCounts(nextStats);

  const allBadges = computeBadgesFromStats(nextStats);

  const statsChanged =
    nextStats.postsCount !== currentStats.postsCount
    || nextStats.commentsCount !== currentStats.commentsCount
    || nextStats.supportiveCommentsCount !== currentStats.supportiveCommentsCount
    || nextStats.reactionsGiven !== currentStats.reactionsGiven
    || nextStats.reactionsReceived !== currentStats.reactionsReceived
    || nextStats.streakDays !== currentStats.streakDays
    || nextStats.points !== currentStats.points
    || nextStats.lastActiveDate !== currentStats.lastActiveDate;

  const badgesChanged =
    allBadges.length !== currentBadges.length
    || allBadges.some((badge) => !currentBadges.includes(badge))
    || currentBadges.some((badge) => !allBadges.includes(badge));

  if (statsChanged || badgesChanged) {
    await updateDoc(userRef, {
      stats: nextStats,
      badges: allBadges,
      updatedAt: serverTimestamp(),
    });

    if (__DEV__) {
      console.log('[gamification] progress synced', {
        userId,
        postsCount: nextStats.postsCount,
        commentsCount: nextStats.commentsCount,
        supportiveCommentsCount: nextStats.supportiveCommentsCount,
        reactionsGiven: nextStats.reactionsGiven,
        reactionsReceived: nextStats.reactionsReceived,
        streakDays: nextStats.streakDays,
      });
    }
  }

  return nextStats;
}
