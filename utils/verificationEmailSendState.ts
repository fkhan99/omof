import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_PREFIX = 'omof:verification-email-sent:';
/** Skip auto-send on refresh/navigation if we sent recently. */
export const VERIFICATION_AUTO_SEND_COOLDOWN_MS = 5 * 60 * 1000;

function storageKey(uid: string): string {
  return `${STORAGE_PREFIX}${uid}`;
}

export async function getVerificationEmailSentAt(uid: string): Promise<number | null> {
  const raw = await AsyncStorage.getItem(storageKey(uid));
  if (!raw) return null;
  const timestamp = Number(raw);
  return Number.isFinite(timestamp) ? timestamp : null;
}

export async function markVerificationEmailSent(uid: string): Promise<void> {
  await AsyncStorage.setItem(storageKey(uid), String(Date.now()));
}

export async function shouldAutoSendVerificationEmail(uid: string): Promise<boolean> {
  const sentAt = await getVerificationEmailSentAt(uid);
  if (sentAt === null) return true;
  return Date.now() - sentAt > VERIFICATION_AUTO_SEND_COOLDOWN_MS;
}

export function resendCooldownRemainingSeconds(
  sentAt: number | null,
  cooldownSeconds: number,
): number {
  if (sentAt === null) return 0;
  const elapsedSeconds = Math.floor((Date.now() - sentAt) / 1000);
  return Math.max(0, cooldownSeconds - elapsedSeconds);
}
