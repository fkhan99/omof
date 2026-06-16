import { CRISIS_PHRASES } from '@/constants/safety';
import { validateUsername } from '@/utils/validation';

function containsCrisisLanguage(text: string): boolean {
  const normalized = text.toLowerCase();
  return CRISIS_PHRASES.some((phrase) => normalized.includes(phrase));
}

describe('containsCrisisLanguage', () => {
  it('detects crisis phrases', () => {
    expect(containsCrisisLanguage('I want to die')).toBe(true);
    expect(containsCrisisLanguage('thinking about suicide')).toBe(true);
    expect(containsCrisisLanguage('having a tough day at work')).toBe(false);
  });

  it('is case insensitive', () => {
    expect(containsCrisisLanguage('SUICIDE')).toBe(true);
  });
});

describe('validateUsername', () => {
  it('rejects short usernames', () => {
    expect(validateUsername('ab')).toBeTruthy();
  });

  it('rejects invalid characters', () => {
    expect(validateUsername('user@name')).toBeTruthy();
  });

  it('accepts valid usernames', () => {
    expect(validateUsername('valid_user123')).toBeNull();
  });
});
