import { getFirebaseAuthErrorMessage } from '@/utils/authErrors';

describe('getFirebaseAuthErrorMessage', () => {
  it('maps auth/email-already-in-use to a sign-in prompt', () => {
    const error = { code: 'auth/email-already-in-use', message: 'Firebase: Error (auth/email-already-in-use).' };
    expect(getFirebaseAuthErrorMessage(error, 'fallback')).toBe(
      'An account with this email already exists. Please sign in instead.',
    );
  });

  it('returns fallback for unknown errors', () => {
    expect(getFirebaseAuthErrorMessage({ code: 'auth/unknown' }, 'Something failed')).toBe(
      'Something failed',
    );
  });
});
