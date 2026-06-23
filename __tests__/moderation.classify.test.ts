jest.mock('bad-words', () => ({
  Filter: class {
    isProfane(text: string) {
      return /\b(fuck|shit|bitch)\b/i.test(text);
    }
  },
}));

import { classifyContent } from '@/utils/moderation/classifyContent';

describe('classifyContent', () => {
  it('allows authentic academic setback without blocking', () => {
    const result = classifyContent(
      'Failed my exam today and feeling embarrassed, but trying to learn from it.',
    );
    expect(result.status).toBe('SAFE');
  });

  it('allows frustrated and anxious posts', () => {
    expect(classifyContent('Burned out and anxious about work this week.').status).toBe('SAFE');
    expect(classifyContent('Had a tough day, feeling lonely and disappointed.').status).toBe('SAFE');
  });

  it('routes severe distress to support without blocking', () => {
    const result = classifyContent('I want to die and have been thinking about suicide.');
    expect(result.status).toBe('SUPPORT_NEEDED');
  });

  it('blocks harassment and hate speech', () => {
    expect(classifyContent('kill yourself @someone').status).toBe('BLOCKED');
    expect(classifyContent('you are a faggot').status).toBe('BLOCKED');
  });

  it('prompts reflection for vague hopelessness', () => {
    const result = classifyContent('Nothing matters. What is the point anymore.');
    expect(result.status).toBe('NEEDS_GROWTH');
  });

  it('does not treat authentic struggle as doom-posting', () => {
    const result = classifyContent(
      'Nothing will ever change and I am exhausted and struggling to keep going.',
    );
    expect(result.status).toBe('SAFE');
  });

  it('flags spam links', () => {
    const result = classifyContent('https://scam.example https://x.com/a https://y.com/b');
    expect(result.status).toBe('SPAM');
  });
});
