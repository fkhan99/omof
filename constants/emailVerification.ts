import { Platform } from 'react-native';

/** Minimum seconds between manual resend requests. */
export const VERIFICATION_RESEND_COOLDOWN_SECONDS = 60;

export const VERIFICATION_EMAIL_SENT_MESSAGE =
  'Verification email sent. Please check your inbox and spam folder. You can resend in 60 seconds.';

export const VERIFICATION_TOO_MANY_REQUESTS_MESSAGE =
  'Too many verification emails were requested. Please wait 30 minutes before trying again.';

function isLocalDevRuntime(): boolean {
  if (__DEV__) return true;
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const host = window.location.hostname;
    return host === 'localhost' || host === '127.0.0.1';
  }
  return false;
}

/**
 * Password signups require inbox verification unless explicitly disabled for
 * local dev. EXPO_PUBLIC_REQUIRE_EMAIL_VERIFICATION=false only applies on
 * localhost — never on omof.net or other deployed hosts.
 */
export function isEmailVerificationRequired(): boolean {
  const flag = process.env.EXPO_PUBLIC_REQUIRE_EMAIL_VERIFICATION?.trim().toLowerCase();
  if (flag === 'false' || flag === '0' || flag === 'no') {
    return !isLocalDevRuntime();
  }
  return true;
}
