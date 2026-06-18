import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  limit,
  serverTimestamp,
  increment,
  Timestamp,
} from 'firebase/firestore';
import { getFirebaseDb, getFirebaseAuth } from './config';
import { mapPromotionDoc } from './mappers';
import { getPost } from './posts';
import { getUserById } from './users';
import {
  Promotion,
  PromotionDurationDays,
  PromotionGoal,
  Post,
  PostWithPromotion,
  UserPlan,
} from '@/types';
import { PROMOTION_CREDIT_COST } from '@/constants/plans';

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export async function createPromotion(
  ownerId: string,
  postId: string,
  goal: PromotionGoal,
  durationDays: PromotionDurationDays,
): Promise<Promotion> {
  const authUid = getFirebaseAuth().currentUser?.uid;
  if (!authUid || authUid !== ownerId) {
    throw new Error('You can only promote your own posts.');
  }

  const post = await getPost(postId);
  if (!post || post.authorId !== ownerId) {
    throw new Error('Post not found.');
  }

  const owner = await getUserById(ownerId);
  if (!owner) {
    throw new Error('User not found.');
  }

  const existing = await getActivePromotionForPost(postId);
  if (existing) {
    throw new Error('This post already has an active promotion.');
  }

  if (owner.plan === 'plus') {
    if (owner.promotionCredits < PROMOTION_CREDIT_COST) {
      throw new Error('No promotion credits left. Upgrade or wait for more credits.');
    }
  } else {
    const activeOwned = await getActivePromotionsByOwner(ownerId);
    if (activeOwned.length > 0) {
      throw new Error(
        'Free plan allows 1 active promotion at a time. Wait for it to end or upgrade to OMOF Plus.',
      );
    }
  }

  const db = getFirebaseDb();
  const now = new Date();
  const expiresAt = addDays(now, durationDays);

  const docRef = await addDoc(collection(db, 'promotions'), {
    postId,
    ownerId,
    goal,
    durationDays,
    status: 'active',
    createdAt: serverTimestamp(),
    expiresAt: Timestamp.fromDate(expiresAt),
    impressions: 0,
    clicks: 0,
  });

  if (owner.plan === 'plus') {
    await updateDoc(doc(db, 'users', ownerId), {
      promotionCredits: increment(-PROMOTION_CREDIT_COST),
      updatedAt: serverTimestamp(),
    });
  }

  const snap = await getDoc(docRef);
  const promotion = mapPromotionDoc(docRef.id, snap.data()!);

  console.log('[promotions] created promotion', {
    id: promotion.id,
    postId,
    goal,
    durationDays,
    expiresAt: promotion.expiresAt.toISOString(),
  });

  return promotion;
}

export async function getActivePromotions(): Promise<Promotion[]> {
  const db = getFirebaseDb();
  const snap = await getDocs(
    query(collection(db, 'promotions'), where('status', '==', 'active'), limit(100)),
  );

  const now = Date.now();
  const promotions: Promotion[] = [];

  for (const docSnap of snap.docs) {
    const promotion = mapPromotionDoc(docSnap.id, docSnap.data());
    if (promotion.expiresAt.getTime() <= now) {
      await updateDoc(doc(db, 'promotions', promotion.id), { status: 'expired' });
      continue;
    }
    promotions.push(promotion);
  }

  return promotions;
}

export async function getActivePromotionForPost(postId: string): Promise<Promotion | null> {
  const db = getFirebaseDb();
  const snap = await getDocs(
    query(
      collection(db, 'promotions'),
      where('postId', '==', postId),
      where('status', '==', 'active'),
      limit(1),
    ),
  );

  if (snap.empty) return null;

  const promotion = mapPromotionDoc(snap.docs[0].id, snap.docs[0].data());
  if (promotion.expiresAt.getTime() <= Date.now()) {
    await updateDoc(doc(db, 'promotions', promotion.id), { status: 'expired' });
    return null;
  }

  return promotion;
}

export async function getPromotedPosts(
  excludeUserIds: string[] = [],
  blockedUserIds: string[] = [],
): Promise<PostWithPromotion[]> {
  const promotions = await getActivePromotions();
  const excludeSet = new Set([...excludeUserIds, ...blockedUserIds]);
  const posts: PostWithPromotion[] = [];

  for (const promotion of promotions) {
    if (excludeSet.has(promotion.ownerId)) continue;

    const post = await getPost(promotion.postId);
    if (!post || excludeSet.has(post.authorId)) continue;

    posts.push({
      ...post,
      promotionId: promotion.id,
      isPromoted: true,
    });
  }

  posts.sort((a, b) => {
    const promoA = promotions.find((p) => p.postId === a.id);
    const promoB = promotions.find((p) => p.postId === b.id);
    const scoreA = (promoA?.clicks ?? 0) * 2 + (promoA?.impressions ?? 0);
    const scoreB = (promoB?.clicks ?? 0) * 2 + (promoB?.impressions ?? 0);
    return scoreB - scoreA;
  });

  return posts;
}

export async function trackPromotionImpression(promotionId: string): Promise<void> {
  const db = getFirebaseDb();
  await updateDoc(doc(db, 'promotions', promotionId), {
    impressions: increment(1),
  });
  console.log('[promotions] impression tracked', { promotionId });
}

export async function trackPromotionClick(promotionId: string): Promise<void> {
  const db = getFirebaseDb();
  await updateDoc(doc(db, 'promotions', promotionId), {
    clicks: increment(1),
  });
  console.log('[promotions] click tracked', { promotionId });
}

export function canUserPromote(plan: UserPlan, promotionCredits: number): boolean {
  if (plan === 'plus') {
    return promotionCredits >= PROMOTION_CREDIT_COST;
  }
  return true;
}
