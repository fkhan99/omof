/** Minimum seconds between manual resend requests. */
export const VERIFICATION_RESEND_COOLDOWN_SECONDS = 60;

export const VERIFICATION_EMAIL_SENT_MESSAGE =
  'Verification email sent. Please check your inbox and spam folder. You can resend in 60 seconds.';

export const VERIFICATION_TOO_MANY_REQUESTS_MESSAGE =
  'Too many verification emails were requested. Please wait 30 minutes before trying again.';

/**
 * When `EXPO_PUBLIC_REQUIRE_EMAIL_VERIFICATION=false`, password signups skip
 * inbox verification in local dev only. Production builds always require it.
 */
export function isEmailVerificationRequired(): boolean {
  const flag = process.env.EXPO_PUBLIC_REQUIRE_EMAIL_VERIFICATION?.trim().toLowerCase();
  if (flag === 'false' || flag === '0' || flag === 'no') {
    return __DEV__;
  }
  return true;
}
