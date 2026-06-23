import { Platform } from 'react-native';
import { User } from '@/types';

const CACHE_KEY = 'omof_profile_cache_v1';

interface ProfileCacheEntry {
  uid: string;
  profile: CachedUser;
}

type CachedUser = Omit<User, 'createdAt' | 'updatedAt' | 'termsAcceptedAt' | 'ageConfirmedAt'> & {
  createdAt: string;
  updatedAt: string;
  termsAcceptedAt: string | null;
  ageConfirmedAt: string | null;
};

function serializeUser(user: User): CachedUser {
  return {
    ...user,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
    termsAcceptedAt: user.termsAcceptedAt?.toISOString() ?? null,
    ageConfirmedAt: user.ageConfirmedAt?.toISOString() ?? null,
  };
}

function deserializeUser(data: CachedUser): User {
  return {
    ...data,
    createdAt: new Date(data.createdAt),
    updatedAt: new Date(data.updatedAt),
    termsAcceptedAt: data.termsAcceptedAt ? new Date(data.termsAcceptedAt) : null,
    ageConfirmedAt: data.ageConfirmedAt ? new Date(data.ageConfirmedAt) : null,
  };
}

export function readProfileCache(uid: string): User | null {
  if (Platform.OS !== 'web' || typeof sessionStorage === 'undefined') return null;

  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;

    const entry = JSON.parse(raw) as ProfileCacheEntry;
    if (entry.uid !== uid || !entry.profile?.username) return null;

    return deserializeUser(entry.profile);
  } catch {
    return null;
  }
}

export function writeProfileCache(uid: string, profile: User | null): void {
  if (Platform.OS !== 'web' || typeof sessionStorage === 'undefined') return;

  try {
    if (!profile) {
      sessionStorage.removeItem(CACHE_KEY);
      return;
    }

    const entry: ProfileCacheEntry = {
      uid,
      profile: serializeUser(profile),
    };
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(entry));
  } catch {
    // Ignore quota / private-mode failures.
  }
}

export function clearProfileCache(): void {
  if (Platform.OS !== 'web' || typeof sessionStorage === 'undefined') return;

  try {
    sessionStorage.removeItem(CACHE_KEY);
  } catch {
    // Ignore.
  }
}
