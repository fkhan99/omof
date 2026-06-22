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
import { getFirebaseDb, getFirebaseAuth } from './config';
import { mapFollowRequestDoc } from './mappers';
import { FollowRequest } from '@/types';
import { getFollowRequestDocId, getFollowDocId } from '@/utils';
import { getUserById } from './users';
import { createNotification, createFollowReceivedNotification } from './notifications';

export async function hasPendingFollowRequest(
  requesterId: string,
  targetId: string,
): Promise<boolean> {
  const db = getFirebaseDb();
  const requestId = getFollowRequestDocId(requesterId, targetId);
  const directSnap = await getDoc(doc(db, 'followRequests', requestId));
  if (directSnap.exists()) return true;

  const requesterSnap = await getDocs(
    query(collection(db, 'followRequests'), where('requesterId', '==', requesterId)),
  );
  return requesterSnap.docs.some((docSnap) => docSnap.data().targetId === targetId);
}

export async function createFollowRequest(
  requesterId: string,
  targetId: string,
): Promise<FollowRequest> {
  const authUid = getFirebaseAuth().currentUser?.uid ?? null;
  if (!authUid || authUid !== requesterId) {
    throw new Error('You must be signed in to send follow requests.');
  }

  if (requesterId === targetId) {
    throw new Error('You cannot follow yourself');
  }

  const db = getFirebaseDb();
  const requestId = getFollowRequestDocId(requesterId, targetId);
  const requestRef = doc(db, 'followRequests', requestId);
  const existing = await getDoc(requestRef);
  if (existing.exists()) {
    return mapFollowRequestDoc(existing.id, existing.data()!);
  }

  try {
    await setDoc(requestRef, {
      requesterId,
      targetId,
      createdAt: serverTimestamp(),
    });
  } catch (error: unknown) {
    const firebaseError = error as { code?: string; message?: string };
    if (firebaseError.code === 'permission-denied') {
      throw new Error(
        'Could not send follow request. Firestore rules may need deploying (npm run firebase:deploy:rules).',
      );
    }
    throw error;
  }

  const actor = await getUserById(requesterId);
  if (actor) {
    await createNotification({
      recipientId: targetId,
      actorId: requesterId,
      actorUsername: actor.username,
      actorDisplayName: actor.displayName,
      actorPhotoURL: actor.photoURL,
      type: 'follow_request',
    });
  }

  const snap = await getDoc(requestRef);
  return mapFollowRequestDoc(snap.id, snap.data()!);
}

export async function cancelFollowRequest(
  requesterId: string,
  targetId: string,
): Promise<void> {
  const db = getFirebaseDb();
  const requestId = getFollowRequestDocId(requesterId, targetId);
  await deleteDoc(doc(db, 'followRequests', requestId));
}

export async function rejectFollowRequest(
  targetId: string,
  requesterId: string,
): Promise<void> {
  const db = getFirebaseDb();
  const requestId = getFollowRequestDocId(requesterId, targetId);
  await deleteDoc(doc(db, 'followRequests', requestId));
}

export async function acceptFollowRequest(
  targetId: string,
  requesterId: string,
): Promise<void> {
  const authUid = getFirebaseAuth().currentUser?.uid ?? null;
  if (!authUid || authUid !== targetId) {
    throw new Error('You must be signed in to accept follow requests.');
  }

  const db = getFirebaseDb();
  const requestId = getFollowRequestDocId(requesterId, targetId);
  const followId = getFollowDocId(requesterId, targetId);
  const requestRef = doc(db, 'followRequests', requestId);
  const requestSnap = await getDoc(requestRef);
  if (!requestSnap.exists()) {
    throw new Error('Follow request not found');
  }

  const followRef = doc(db, 'follows', followId);
  const followSnap = await getDoc(followRef);
  if (!followSnap.exists()) {
    try {
      await setDoc(followRef, {
        followerId: requesterId,
        followingId: targetId,
        createdAt: serverTimestamp(),
      });
    } catch (error: unknown) {
      const firebaseError = error as { code?: string; message?: string };
      if (firebaseError.code === 'permission-denied') {
        throw new Error(
          'Could not confirm follow request. Firestore rules may need deploying (npm run firebase:deploy:rules).',
        );
      }
      throw error;
    }
  }

  await deleteDoc(requestRef);

  const requester = await getUserById(requesterId);
  if (requester) {
    await createFollowReceivedNotification(requesterId, targetId);
  }

  const actor = await getUserById(targetId);
  if (actor) {
    await createNotification({
      recipientId: requesterId,
      actorId: targetId,
      actorUsername: actor.username,
      actorDisplayName: actor.displayName,
      actorPhotoURL: actor.photoURL,
      type: 'follow_accepted',
    });
  }
}

export async function getIncomingFollowRequests(userId: string): Promise<FollowRequest[]> {
  const db = getFirebaseDb();
  const snap = await getDocs(
    query(collection(db, 'followRequests'), where('targetId', '==', userId)),
  );

  return snap.docs
    .map((docSnap) => mapFollowRequestDoc(docSnap.id, docSnap.data()))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export interface FollowRequestWithRequester {
  request: FollowRequest;
  requesterUsername: string;
  requesterName: string;
  requesterPhotoURL: string | null;
}

export async function enrichFollowRequests(
  requests: FollowRequest[],
): Promise<FollowRequestWithRequester[]> {
  return Promise.all(
    requests.map(async (request) => {
      const requester = await getUserById(request.requesterId);
      return {
        request,
        requesterUsername: requester?.username ?? 'user',
        requesterName: requester?.displayName ?? 'User',
        requesterPhotoURL: requester?.photoURL ?? null,
      };
    }),
  );
}

export async function getIncomingFollowRequestsWithRequesters(
  userId: string,
): Promise<FollowRequestWithRequester[]> {
  const requests = await getIncomingFollowRequests(userId);
  return enrichFollowRequests(requests);
}

export async function getOutgoingFollowRequestIds(requesterId: string): Promise<string[]> {
  const db = getFirebaseDb();
  const snap = await getDocs(
    query(collection(db, 'followRequests'), where('requesterId', '==', requesterId)),
  );
  return snap.docs.map((docSnap) => docSnap.data().targetId as string);
}
