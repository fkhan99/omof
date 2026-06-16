import {
  collection,
  doc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  serverTimestamp,
  updateDoc,
  setDoc,
} from 'firebase/firestore';
import { getFirebaseDb, getFirebaseAuth } from './config';
import { mapFollowDoc } from './mappers';
import { Follow, User } from '@/types';
import { getFollowDocId } from '@/utils';
import { getUserById } from './users';
import { createNotification } from './notifications';
import {
  createFollowRequest,
  hasPendingFollowRequest,
  cancelFollowRequest,
} from './followRequests';

export type FollowActionResult = 'followed' | 'requested';

export interface FollowCounts {
  followingCount: number;
  followerCount: number;
}

export function getAuthUserId(): string {
  const authUid = getFirebaseAuth().currentUser?.uid ?? null;
  if (!authUid) {
    throw new Error('You must be signed in to change who you follow.');
  }
  return authUid;
}

export async function getActualFollowCounts(userId: string): Promise<FollowCounts> {
  const db = getFirebaseDb();
  const [followingSnap, followersSnap] = await Promise.all([
    getDocs(query(collection(db, 'follows'), where('followerId', '==', userId))),
    getDocs(query(collection(db, 'follows'), where('followingId', '==', userId))),
  ]);

  return {
    followingCount: followingSnap.size,
    followerCount: followersSnap.size,
  };
}

export async function syncUserFollowCounts(userId: string): Promise<FollowCounts> {
  const counts = await getActualFollowCounts(userId);
  const db = getFirebaseDb();
  await updateDoc(doc(db, 'users', userId), {
    followingCount: counts.followingCount,
    followerCount: counts.followerCount,
  });
  return counts;
}

async function syncRelationshipCounts(followerId: string, followingId: string): Promise<void> {
  try {
    await Promise.all([
      syncUserFollowCounts(followerId),
      syncUserFollowCounts(followingId),
    ]);
  } catch (error) {
    if (__DEV__) {
      console.warn('[syncRelationshipCounts] failed', error);
    }
  }
}

async function deleteFollowRelationship(followerId: string, followingId: string): Promise<boolean> {
  const db = getFirebaseDb();
  let removed = false;
  const followId = getFollowDocId(followerId, followingId);
  const followRef = doc(db, 'follows', followId);
  const followSnap = await getDoc(followRef);

  if (followSnap.exists()) {
    await deleteDoc(followRef);
    removed = true;
  }

  const followerSnap = await getDocs(
    query(collection(db, 'follows'), where('followerId', '==', followerId)),
  );
  const orphanMatches = followerSnap.docs.filter(
    (docSnap) => docSnap.id !== followId && docSnap.data().followingId === followingId,
  );

  if (orphanMatches.length > 0) {
    await Promise.all(orphanMatches.map((docSnap) => deleteDoc(docSnap.ref)));
    removed = true;
  }

  return removed;
}

export async function followUser(
  followerId: string,
  followingId: string,
): Promise<FollowActionResult> {
  const authUid = getAuthUserId();
  if (authUid !== followerId) {
    throw new Error('You must be signed in to change who you follow.');
  }

  if (followerId === followingId) {
    throw new Error('You cannot follow yourself');
  }

  const target = await getUserById(followingId);
  if (!target) {
    throw new Error('User not found');
  }

  if (target.isPrivate) {
    const alreadyFollowing = await isFollowing(followerId, followingId);
    if (alreadyFollowing) {
      return 'followed';
    }

    await createFollowRequest(followerId, followingId);
    return 'requested';
  }

  await followUserImmediately(followerId, followingId);
  return 'followed';
}

async function followUserImmediately(followerId: string, followingId: string): Promise<Follow> {
  const db = getFirebaseDb();
  const followId = getFollowDocId(followerId, followingId);
  const followRef = doc(db, 'follows', followId);
  const existing = await getDoc(followRef);

  if (!existing.exists()) {
    await setDoc(followRef, {
      followerId,
      followingId,
      createdAt: serverTimestamp(),
    });

    await syncRelationshipCounts(followerId, followingId);

    const actor = await getUserById(followerId);
    if (actor) {
      await createNotification({
        recipientId: followingId,
        actorId: followerId,
        actorUsername: actor.username,
        actorDisplayName: actor.displayName,
        actorPhotoURL: actor.photoURL,
        type: 'follow',
      });
    }
  }

  const snap = await getDoc(followRef);
  return mapFollowDoc(snap.id, snap.data()!);
}

export async function unfollowUser(followerId: string, followingId: string): Promise<void> {
  const authUid = getAuthUserId();
  if (authUid !== followerId) {
    throw new Error('You must be signed in to change who you follow.');
  }

  const removedFollow = await deleteFollowRelationship(followerId, followingId);
  const hadRequest = await hasPendingFollowRequest(followerId, followingId);

  if (hadRequest) {
    await cancelFollowRequest(followerId, followingId);
  }

  if (removedFollow) {
    await syncRelationshipCounts(followerId, followingId);
  }
}

export async function isFollowing(followerId: string, followingId: string): Promise<boolean> {
  const db = getFirebaseDb();
  const followId = getFollowDocId(followerId, followingId);
  const directSnap = await getDoc(doc(db, 'follows', followId));
  if (directSnap.exists()) return true;

  const followerSnap = await getDocs(
    query(collection(db, 'follows'), where('followerId', '==', followerId)),
  );
  return followerSnap.docs.some((docSnap) => docSnap.data().followingId === followingId);
}

export async function getFollowingIds(userId: string): Promise<string[]> {
  const db = getFirebaseDb();
  const q = query(collection(db, 'follows'), where('followerId', '==', userId));
  const snap = await getDocs(q);
  return [...new Set(snap.docs.map((d) => d.data().followingId as string))];
}

export async function getFollowers(userId: string): Promise<Follow[]> {
  const db = getFirebaseDb();
  const q = query(collection(db, 'follows'), where('followingId', '==', userId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => mapFollowDoc(d.id, d.data()));
}

export async function getFollowing(userId: string): Promise<Follow[]> {
  const db = getFirebaseDb();
  const q = query(collection(db, 'follows'), where('followerId', '==', userId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => mapFollowDoc(d.id, d.data()));
}

export async function getFollowingUsers(userId: string): Promise<User[]> {
  const follows = await getFollowing(userId);
  const users = await Promise.all(follows.map((follow) => getUserById(follow.followingId)));
  return users.filter((user): user is User => user !== null);
}

export async function getFollowerUsers(userId: string): Promise<User[]> {
  const follows = await getFollowers(userId);
  const users = await Promise.all(follows.map((follow) => getUserById(follow.followerId)));
  return users.filter((user): user is User => user !== null);
}

export { hasPendingFollowRequest } from './followRequests';
