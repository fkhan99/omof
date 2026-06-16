import { loginSchema, createPostSchema, commentSchema } from '@/utils/validation';

describe('loginSchema', () => {
  it('validates correct login data', () => {
    const result = loginSchema.safeParse({
      email: 'test@example.com',
      password: 'password123',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe('test@example.com');
    }
  });

  it('normalizes email by trimming and lowercasing', () => {
    const result = loginSchema.safeParse({
      email: '  Test@Example.COM  ',
      password: 'password123',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe('test@example.com');
    }
  });

  it('rejects invalid email', () => {
    const result = loginSchema.safeParse({
      email: 'not-an-email',
      password: 'password123',
    });
    expect(result.success).toBe(false);
  });

  it('rejects short password', () => {
    const result = loginSchema.safeParse({
      email: 'test@example.com',
      password: '123',
    });
    expect(result.success).toBe(false);
  });
});

describe('createPostSchema', () => {
  it('validates correct post data', () => {
    const result = createPostSchema.safeParse({
      caption: 'Having a rough day',
      moodTag: 'Exhausted',
    });
    expect(result.success).toBe(true);
  });

  it('rejects caption over 280 characters', () => {
    const result = createPostSchema.safeParse({
      caption: 'a'.repeat(281),
      moodTag: 'Other',
    });
    expect(result.success).toBe(false);
  });

  it('requires mood tag', () => {
    const result = createPostSchema.safeParse({
      caption: 'Test caption',
    });
    expect(result.success).toBe(false);
  });
});

describe('commentSchema', () => {
  it('validates non-empty comments', () => {
    const result = commentSchema.safeParse({ text: 'Sending support!' });
    expect(result.success).toBe(true);
  });

  it('rejects empty comments', () => {
    const result = commentSchema.safeParse({ text: '' });
    expect(result.success).toBe(false);
  });
});
