import {
  doc,
  getDoc,
  getDocs,
  updateDoc,
  collection,
  query,
  where,
  serverTimestamp,
  increment,
} from 'firebase/firestore';
import { getFirebaseDb } from './config';
import { BadgeId, UserStats } from '@/types';
import { BADGE_DEFINITIONS, DEFAULT_USER_STATS, POINT_VALUES } from '@/constants/gamification';

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function yesterdayKey(): string {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  return date.toISOString().slice(0, 10);
}

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
  const today = todayKey();
  const yesterday = yesterdayKey();

  if (current.lastActiveDate === today) {
    return current.streakDays;
  }

  if (current.lastActiveDate === yesterday) {
    return current.streakDays + 1;
  }

  return 1;
}

function badgesToUnlock(stats: UserStats, existing: BadgeId[]): BadgeId[] {
  const unlocked: BadgeId[] = [];

  if (stats.postsCount >= 1 && !existing.includes('first_real_post')) {
    unlocked.push('first_real_post');
  }
  if (stats.supportiveCommentsCount >= 5 && !existing.includes('supportive_friend')) {
    unlocked.push('supportive_friend');
  }
  if (stats.streakDays >= 7 && !existing.includes('authenticity_streak_7')) {
    unlocked.push('authenticity_streak_7');
  }
  if (stats.postsCount >= 10 && !existing.includes('community_builder')) {
    unlocked.push('community_builder');
  }

  return unlocked;
}

async function applyGamificationUpdate(
  userId: string,
  statsPatch: Partial<UserStats>,
  pointsDelta: number,
): Promise<void> {
  const db = getFirebaseDb();
  const userRef = doc(db, 'users', userId);
  const snap = await getDoc(userRef);
  if (!snap.exists()) return;

  const currentStats = normalizeStats(snap.data().stats as Partial<UserStats> | undefined);
  const currentBadges = (snap.data().badges as BadgeId[]) ?? [];

  // Compute the streak from the EXISTING lastActiveDate before overwriting it
  // to today — otherwise the check always sees "today" and never advances.
  const nextStats: UserStats = {
    ...currentStats,
    ...statsPatch,
    points: currentStats.points + pointsDelta,
    streakDays: computeStreakDays(currentStats),
    lastActiveDate: todayKey(),
  };

  const newBadges = badgesToUnlock(nextStats, currentBadges);
  const allBadges = [...currentBadges, ...newBadges];

  await updateDoc(userRef, {
    stats: nextStats,
    badges: allBadges,
    updatedAt: serverTimestamp(),
  });

  console.log('[gamification] points update', {
    userId,
    pointsDelta,
    totalPoints: nextStats.points,
    stats: nextStats,
  });

  for (const badgeId of newBadges) {
    console.log('[gamification] badge unlocked', {
      userId,
      badgeId,
      title: BADGE_DEFINITIONS[badgeId].title,
    });
  }
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

  const alreadyActiveToday = currentStats.lastActiveDate === todayKey();
  const streakDays = alreadyActiveToday
    ? currentStats.streakDays
    : computeStreakDays(currentStats);

  const nextStats: UserStats = {
    ...currentStats,
    postsCount: postsSnap.size,
    commentsCount: commentsSnap.size,
    supportiveCommentsCount,
    reactionsGiven,
    reactionsReceived,
    streakDays,
    lastActiveDate: todayKey(),
  };

  const newBadges = badgesToUnlock(nextStats, currentBadges);
  const allBadges = [...currentBadges, ...newBadges];

  const statsChanged =
    nextStats.postsCount !== currentStats.postsCount
    || nextStats.commentsCount !== currentStats.commentsCount
    || nextStats.supportiveCommentsCount !== currentStats.supportiveCommentsCount
    || nextStats.reactionsGiven !== currentStats.reactionsGiven
    || nextStats.reactionsReceived !== currentStats.reactionsReceived
    || nextStats.streakDays !== currentStats.streakDays
    || nextStats.lastActiveDate !== currentStats.lastActiveDate;

  if (statsChanged || newBadges.length > 0) {
    await updateDoc(userRef, {
      stats: nextStats,
      badges: allBadges,
      updatedAt: serverTimestamp(),
    });

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

  return nextStats;
}

export async function onPostCreated(userId: string): Promise<void> {
  const db = getFirebaseDb();
  const userRef = doc(db, 'users', userId);
  const snap = await getDoc(userRef);
  if (!snap.exists()) return;

  const currentStats = normalizeStats(snap.data().stats as Partial<UserStats> | undefined);

  await applyGamificationUpdate(
    userId,
    { postsCount: currentStats.postsCount + 1 },
    POINT_VALUES.createPost,
  );
}

export async function onCommentCreated(userId: string, isOwnPost: boolean): Promise<void> {
  const db = getFirebaseDb();
  const userRef = doc(db, 'users', userId);
  const snap = await getDoc(userRef);
  if (!snap.exists()) return;

  const currentStats = normalizeStats(snap.data().stats as Partial<UserStats> | undefined);
  const patch: Partial<UserStats> = {
    commentsCount: currentStats.commentsCount + 1,
  };

  let points = 0;
  if (!isOwnPost) {
    patch.supportiveCommentsCount = currentStats.supportiveCommentsCount + 1;
    points = POINT_VALUES.supportiveComment;
  }

  await applyGamificationUpdate(userId, patch, points);
}

export async function onReactionGiven(userId: string): Promise<void> {
  const db = getFirebaseDb();
  const userRef = doc(db, 'users', userId);
  const snap = await getDoc(userRef);
  if (!snap.exists()) return;

  const currentStats = normalizeStats(snap.data().stats as Partial<UserStats> | undefined);

  await applyGamificationUpdate(
    userId,
    { reactionsGiven: currentStats.reactionsGiven + 1 },
    POINT_VALUES.reactionGiven,
  );
}

export async function onReactionReceived(userId: string): Promise<void> {
  const db = getFirebaseDb();
  const userRef = doc(db, 'users', userId);
  const snap = await getDoc(userRef);
  if (!snap.exists()) return;

  const currentStats = normalizeStats(snap.data().stats as Partial<UserStats> | undefined);

  await applyGamificationUpdate(
    userId,
    { reactionsReceived: currentStats.reactionsReceived + 1 },
    POINT_VALUES.reactionReceived,
  );
}

export async function awardPoints(userId: string, amount: number, reason: string): Promise<void> {
  await applyGamificationUpdate(userId, {}, amount);
  console.log('[gamification] manual points award', { userId, amount, reason });
}
