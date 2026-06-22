import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';

function getDb() {
  return admin.firestore();
}

const POINT_VALUES = {
  createPost: 10,
  supportiveComment: 5,
  reactionGiven: 3,
  reactionReceived: 2,
} as const;

type BadgeId =
  | 'first_real_post'
  | 'supportive_friend'
  | 'authenticity_streak_7'
  | 'community_builder';

interface UserStats {
  postsCount: number;
  commentsCount: number;
  supportiveCommentsCount: number;
  reactionsGiven: number;
  reactionsReceived: number;
  streakDays: number;
  points: number;
  lastActiveDate: string | null;
}

function localDateKey(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function todayKey(now: Date = new Date()): string {
  return localDateKey(now);
}

function yesterdayKey(now: Date = new Date()): string {
  const date = new Date(now);
  date.setDate(date.getDate() - 1);
  return localDateKey(date);
}

function computeNextStreak(
  lastActiveDate: string | null,
  streakDays: number,
  now: Date = new Date(),
): number {
  if (lastActiveDate === todayKey(now)) {
    return streakDays;
  }
  if (lastActiveDate === yesterdayKey(now)) {
    return streakDays + 1;
  }
  return 1;
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
 * Reconcile counts, points, and badges from live Firestore data.
 * Used after deletions so other users' stats stay accurate.
 */
export async function reconcileUserGamification(userId: string): Promise<void> {
  const userRef = getDb().collection('users').doc(userId);
  const snap = await userRef.get();
  if (!snap.exists) return;

  const currentStats = normalizeStats(snap.data()?.stats as Partial<UserStats> | undefined);

  const [postsSnap, commentsSnap, reactionsGivenSnap, reactionsReceivedSnap] = await Promise.all([
    getDb().collection('posts').where('authorId', '==', userId).get(),
    getDb().collection('comments').where('authorId', '==', userId).get(),
    getDb().collection('reactions').where('userId', '==', userId).get(),
    getDb().collection('reactions').where('postAuthorId', '==', userId).get(),
  ]);

  const ownPostIds = new Set(postsSnap.docs.map((postDoc) => postDoc.id));
  let supportiveCommentsCount = 0;
  commentsSnap.docs.forEach((commentDoc) => {
    const postId = commentDoc.data().postId as string | undefined;
    if (postId && !ownPostIds.has(postId)) supportiveCommentsCount += 1;
  });

  const reactionsGiven = reactionsGivenSnap.size;
  const reactionsReceived = reactionsReceivedSnap.docs.filter(
    (reactionDoc) => reactionDoc.data().userId !== userId,
  ).length;

  const streakDays = computeNextStreak(currentStats.lastActiveDate, currentStats.streakDays);

  const nextStats: UserStats = {
    postsCount: postsSnap.size,
    commentsCount: commentsSnap.size,
    supportiveCommentsCount,
    reactionsGiven,
    reactionsReceived,
    streakDays,
    points: 0,
    lastActiveDate: currentStats.lastActiveDate,
  };
  nextStats.points = computePointsFromCounts(nextStats);

  const nextBadges = computeBadgesFromStats(nextStats);

  await userRef.update({
    stats: nextStats,
    badges: nextBadges,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  functions.logger.info('[gamification] reconciled', {
    userId,
    points: nextStats.points,
    postsCount: nextStats.postsCount,
    reactionsGiven: nextStats.reactionsGiven,
    reactionsReceived: nextStats.reactionsReceived,
  });
}

async function applyGamificationUpdate(
  userId: string,
  statsPatch: Partial<UserStats>,
  pointsDelta: number,
): Promise<void> {
  const userRef = getDb().collection('users').doc(userId);
  const snap = await userRef.get();
  if (!snap.exists) return;

  const currentStats = normalizeStats(snap.data()?.stats as Partial<UserStats> | undefined);
  const currentBadges = (snap.data()?.badges as BadgeId[]) ?? [];

  const nextStats: UserStats = {
    ...currentStats,
    ...statsPatch,
    points: currentStats.points + pointsDelta,
    streakDays: computeNextStreak(currentStats.lastActiveDate, currentStats.streakDays),
    lastActiveDate: todayKey(),
  };

  const newBadges = badgesToUnlock(nextStats, currentBadges);
  const allBadges = [...currentBadges, ...newBadges];

  await userRef.update({
    stats: nextStats,
    badges: allBadges,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  functions.logger.info('[gamification] updated', {
    userId,
    pointsDelta,
    totalPoints: nextStats.points,
    newBadges,
  });
}

export async function handlePostCreatedGamification(authorId: string): Promise<void> {
  const userRef = getDb().collection('users').doc(authorId);
  const snap = await userRef.get();
  if (!snap.exists) return;

  const currentStats = normalizeStats(snap.data()?.stats as Partial<UserStats> | undefined);

  await applyGamificationUpdate(
    authorId,
    { postsCount: currentStats.postsCount + 1 },
    POINT_VALUES.createPost,
  );
}

export async function handleCommentCreatedGamification(
  authorId: string,
  isOwnPost: boolean,
): Promise<void> {
  const userRef = getDb().collection('users').doc(authorId);
  const snap = await userRef.get();
  if (!snap.exists) return;

  const currentStats = normalizeStats(snap.data()?.stats as Partial<UserStats> | undefined);
  const patch: Partial<UserStats> = {
    commentsCount: currentStats.commentsCount + 1,
  };

  let points = 0;
  if (!isOwnPost) {
    patch.supportiveCommentsCount = currentStats.supportiveCommentsCount + 1;
    points = POINT_VALUES.supportiveComment;
  }

  await applyGamificationUpdate(authorId, patch, points);
}

export async function handleReactionGivenGamification(userId: string): Promise<void> {
  const userRef = getDb().collection('users').doc(userId);
  const snap = await userRef.get();
  if (!snap.exists) return;

  const currentStats = normalizeStats(snap.data()?.stats as Partial<UserStats> | undefined);

  await applyGamificationUpdate(
    userId,
    { reactionsGiven: currentStats.reactionsGiven + 1 },
    POINT_VALUES.reactionGiven,
  );
}

export async function handleReactionReceivedGamification(userId: string): Promise<void> {
  const userRef = getDb().collection('users').doc(userId);
  const snap = await userRef.get();
  if (!snap.exists) return;

  const currentStats = normalizeStats(snap.data()?.stats as Partial<UserStats> | undefined);

  await applyGamificationUpdate(
    userId,
    { reactionsReceived: currentStats.reactionsReceived + 1 },
    POINT_VALUES.reactionReceived,
  );
}

export async function syncFollowCounts(followerId: string, followingId: string): Promise<void> {
  await Promise.all([
    syncUserFollowCounts(followerId),
    syncUserFollowCounts(followingId),
  ]);
}

async function syncUserFollowCounts(userId: string): Promise<void> {
  const [followingSnap, followersSnap] = await Promise.all([
    getDb().collection('follows').where('followerId', '==', userId).get(),
    getDb().collection('follows').where('followingId', '==', userId).get(),
  ]);

  await getDb().collection('users').doc(userId).update({
    followerCount: followersSnap.size,
    followingCount: followingSnap.size,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}
