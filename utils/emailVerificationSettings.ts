import { Platform } from 'react-native';
import type { ActionCodeSettings } from 'firebase/auth';

const HOSTED_ONBOARDING_URL = 'https://omof.net/onboarding';

export function getEmailVerificationContinueUrl(): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location.origin) {
    return `${window.location.origin}/onboarding`;
  }
  return HOSTED_ONBOARDING_URL;
}

export function getEmailVerificationActionSettings(): ActionCodeSettings {
  return {
    url: getEmailVerificationContinueUrl(),
    handleCodeInApp: true,
  };
}
