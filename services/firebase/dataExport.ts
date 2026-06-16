import { collection, getDocs, query, where } from 'firebase/firestore';
import { getFirebaseDb, getFirebaseAuth } from './config';
import { getUserProfile } from './auth';
import { PRIVACY_POLICY_VERSION, TERMS_VERSION } from '@/constants/legal';

export async function exportUserData(userId: string): Promise<string> {
  const authUid = getFirebaseAuth().currentUser?.uid;
  if (!authUid || authUid !== userId) {
    throw new Error('You must be signed in to export your data.');
  }

  const db = getFirebaseDb();
  const profile = await getUserProfile(userId);

  const [postsSnap, commentsSnap, reactionsSnap, followsOutSnap, followsInSnap, blocksSnap, notifSnap] =
    await Promise.all([
      getDocs(query(collection(db, 'posts'), where('authorId', '==', userId))),
      getDocs(query(collection(db, 'comments'), where('authorId', '==', userId))),
      getDocs(query(collection(db, 'reactions'), where('userId', '==', userId))),
      getDocs(query(collection(db, 'follows'), where('followerId', '==', userId))),
      getDocs(query(collection(db, 'follows'), where('followingId', '==', userId))),
      getDocs(query(collection(db, 'blockedUsers'), where('blockerId', '==', userId))),
      getDocs(query(collection(db, 'notifications'), where('recipientId', '==', userId))),
    ]);

  const exportPayload = {
    exportedAt: new Date().toISOString(),
    formatVersion: '1.0',
    privacyPolicyVersion: PRIVACY_POLICY_VERSION,
    termsVersion: TERMS_VERSION,
    profile: profile
      ? {
          id: profile.id,
          email: profile.email,
          username: profile.username,
          displayName: profile.displayName,
          bio: profile.bio,
          photoURL: profile.photoURL,
          plan: profile.plan,
          stats: profile.stats,
          badges: profile.badges,
          isPrivate: profile.isPrivate,
          createdAt: profile.createdAt.toISOString(),
          updatedAt: profile.updatedAt.toISOString(),
        }
      : null,
    posts: postsSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
    comments: commentsSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
    reactions: reactionsSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
    following: followsOutSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
    followers: followsInSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
    blockedUsers: blocksSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
    notifications: notifSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
  };

  console.log('[compliance] data export generated', { userId, bytes: JSON.stringify(exportPayload).length });

  return JSON.stringify(exportPayload, null, 2);
}
