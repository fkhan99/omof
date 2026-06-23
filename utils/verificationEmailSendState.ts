import AsyncStorage from '@react-native-async-storage/async-storage';
import { VERIFICATION_RESEND_COOLDOWN_SECONDS } from '@/constants/emailVerification';

const STORAGE_PREFIX = 'omof:verification-email-sent:';

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

export function resendCooldownRemainingSeconds(
  sentAt: number | null,
  cooldownSeconds: number = VERIFICATION_RESEND_COOLDOWN_SECONDS,
): number {
  if (sentAt === null) return 0;
  const elapsedSeconds = Math.floor((Date.now() - sentAt) / 1000);
  return Math.max(0, cooldownSeconds - elapsedSeconds);
}

export async function assertVerificationResendAllowed(uid: string): Promise<void> {
  const sentAt = await getVerificationEmailSentAt(uid);
  const remaining = resendCooldownRemainingSeconds(sentAt);
  if (remaining > 0) {
    throw new Error(`Please wait ${remaining} seconds before resending.`);
  }
}
