import AsyncStorage from '@react-native-async-storage/async-storage';

const PENDING_PREFIX = 'omof:welcome-pending:';
const SEEN_PREFIX = 'omof:welcome-seen:';

function pendingKey(uid: string): string {
  return `${PENDING_PREFIX}${uid}`;
}

function seenKey(uid: string): string {
  return `${SEEN_PREFIX}${uid}`;
}

/** Call after a brand-new profile is created (not for returning users). */
export async function scheduleWelcome(uid: string): Promise<void> {
  await AsyncStorage.setItem(pendingKey(uid), '1');
}

export async function isWelcomePending(uid: string): Promise<boolean> {
  const pending = await AsyncStorage.getItem(pendingKey(uid));
  if (pending !== '1') return false;
  const seen = await AsyncStorage.getItem(seenKey(uid));
  return seen !== '1';
}

export async function markWelcomeSeen(uid: string): Promise<void> {
  await AsyncStorage.multiSet([
    [seenKey(uid), '1'],
    [pendingKey(uid), '0'],
  ]);
}
