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
    displayName?: string;
    bio?: string;
    photoURL?: string | null;
    displayNameLower?: string;
    isPrivate?: boolean;
  },
): Promise<void> {
  const db = getFirebaseDb();
  const updates: Record<string, unknown> = { ...data, updatedAt: serverTimestamp() };
  if (data.displayName) {
    updates.displayNameLower = data.displayName.toLowerCase();
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

  const [usernameSnap, displayNameSnap] = await Promise.all([
    getDocs(usernameQuery),
    getDocs(displayNameQuery),
  ]);

  const usersMap = new Map<string, User>();
  [...usernameSnap.docs, ...displayNameSnap.docs].forEach((docSnap) => {
    usersMap.set(docSnap.id, mapUserDoc(docSnap.id, docSnap.data()));
  });

  return Array.from(usersMap.values());
}
