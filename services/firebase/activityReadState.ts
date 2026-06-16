import AsyncStorage from '@react-native-async-storage/async-storage';
import { getActivityReadKey } from '@/utils/activityRead';

function storageKey(userId: string): string {
  return `omof:activity:read:${userId}`;
}

export async function loadReadActivityKeys(userId: string): Promise<Set<string>> {
  const raw = await AsyncStorage.getItem(storageKey(userId));
  if (!raw) return new Set();

  try {
    const parsed = JSON.parse(raw) as string[];
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

async function saveReadActivityKeys(userId: string, keys: Set<string>): Promise<void> {
  await AsyncStorage.setItem(storageKey(userId), JSON.stringify([...keys]));
}

export async function markActivityKeyRead(userId: string, key: string): Promise<void> {
  const keys = await loadReadActivityKeys(userId);
  keys.add(key);
  await saveReadActivityKeys(userId, keys);
}

export async function markActivityKeysRead(userId: string, keysToAdd: string[]): Promise<void> {
  const keys = await loadReadActivityKeys(userId);
  keysToAdd.forEach((key) => keys.add(key));
  await saveReadActivityKeys(userId, keys);
}

export { applyPersistedReadState } from '@/utils/activityRead';
