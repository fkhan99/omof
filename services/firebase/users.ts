import {
  collection,
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
  query,
  where,
  getDocs,
  limit,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getFirebaseDb, getFirebaseStorage } from './config';
import { mapUserDoc } from './mappers';
import { User } from '@/types';
import { optimizeAvatarForUpload } from '@/utils/media';
import { AVATAR_MAX_DIMENSION } from '@/constants/theme';
import { SEARCH_RESULTS_LIMIT } from '@/constants/theme';

export async function getUserById(userId: string): Promise<User | null> {
  const db = getFirebaseDb();
  const snap = await getDoc(doc(db, 'users', userId));
  if (!snap.exists()) return null;
  return mapUserDoc(snap.id, snap.data());
}

export async function getUserByUsername(username: string): Promise<User | null> {
  const db = getFirebaseDb();
  const q = query(
    collection(db, 'users'),
    where('usernameLower', '==', username.toLowerCase()),
    limit(1),
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const docSnap = snap.docs[0];
  return mapUserDoc(docSnap.id, docSnap.data());
}

export async function updateUserProfile(
  userId: string,
  data: {
    fullName?: string;
    displayName?: string;
    bio?: string;
    photoURL?: string | null;
    location?: string;
    displayNameLower?: string;
    fullNameLower?: string;
    locationLower?: string;
    isPrivate?: boolean;
  },
): Promise<void> {
  const db = getFirebaseDb();
  const updates: Record<string, unknown> = { ...data, updatedAt: serverTimestamp() };
  if (data.displayName) {
    updates.displayNameLower = data.displayName.toLowerCase();
  }
  if (data.fullName) {
    updates.fullNameLower = data.fullName.trim().toLowerCase();
  }
  if (data.location) {
    updates.locationLower = data.location.trim().toLowerCase();
  }
  await updateDoc(doc(db, 'users', userId), updates);
}

export async function uploadProfilePhoto(userId: string, uri: string): Promise<string> {
  const storage = getFirebaseStorage();
  const optimized = await optimizeAvatarForUpload(uri, AVATAR_MAX_DIMENSION);
  const response = await fetch(optimized.uri);
  const blob = await response.blob();
  const storageRef = ref(storage, `profiles/${userId}/${Date.now()}.${optimized.extension}`);
  await uploadBytes(storageRef, blob, { contentType: optimized.contentType });
  return getDownloadURL(storageRef);
}

export async function searchUsers(searchTerm: string): Promise<User[]> {
  const db = getFirebaseDb();
  const term = searchTerm.toLowerCase().trim();
  if (!term) return [];

  const usernameQuery = query(
    collection(db, 'users'),
    where('usernameLower', '>=', term),
    where('usernameLower', '<=', term + '\uf8ff'),
    limit(SEARCH_RESULTS_LIMIT),
  );

  const displayNameQuery = query(
    collection(db, 'users'),
    where('displayNameLower', '>=', term),
    where('displayNameLower', '<=', term + '\uf8ff'),
    limit(SEARCH_RESULTS_LIMIT),
  );

  const fullNameQuery = query(
    collection(db, 'users'),
    where('fullNameLower', '>=', term),
    where('fullNameLower', '<=', term + '\uf8ff'),
    limit(SEARCH_RESULTS_LIMIT),
  );

  const [usernameSnap, displayNameSnap, fullNameSnap] = await Promise.all([
    getDocs(usernameQuery),
    getDocs(displayNameQuery),
    getDocs(fullNameQuery),
  ]);

  const usersMap = new Map<string, User>();
  [...usernameSnap.docs, ...displayNameSnap.docs, ...fullNameSnap.docs].forEach((docSnap) => {
    usersMap.set(docSnap.id, mapUserDoc(docSnap.id, docSnap.data()));
  });

  return Array.from(usersMap.values());
}

export async function getUsersByLocation(
  locationLower: string,
  viewerId: string,
  followingIds: string[],
  blockedIds: string[],
): Promise<User[]> {
  if (!locationLower.trim()) return [];

  const db = getFirebaseDb();
  const q = query(
    collection(db, 'users'),
    where('locationLower', '==', locationLower.trim().toLowerCase()),
    limit(50),
  );
  const snap = await getDocs(q);

  const followingSet = new Set(followingIds);
  const blockedSet = new Set(blockedIds);

  const users: User[] = [];
  for (const docSnap of snap.docs) {
    if (docSnap.id === viewerId) continue;
    if (blockedSet.has(docSnap.id)) continue;
    const user = mapUserDoc(docSnap.id, docSnap.data());
    if (user.isPrivate && !followingSet.has(user.id)) continue;
    users.push(user);
  }

  return users.slice(0, 20);
}

export async function findUsersByEmails(emails: string[]): Promise<User[]> {
  const db = getFirebaseDb();
  const normalized = [...new Set(emails.map((email) => email.trim().toLowerCase()).filter(Boolean))];
  if (normalized.length === 0) return [];

  const usersMap = new Map<string, User>();

  for (let index = 0; index < normalized.length; index += 10) {
    const batch = normalized.slice(index, index + 10);
    const snap = await getDocs(
      query(collection(db, 'users'), where('email', 'in', batch), limit(10)),
    );
    snap.docs.forEach((docSnap) => {
      usersMap.set(docSnap.id, mapUserDoc(docSnap.id, docSnap.data()));
    });
  }

  return Array.from(usersMap.values());
}
