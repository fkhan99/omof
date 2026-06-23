import { z } from 'zod';
import { MOOD_TAGS, REPORT_REASONS } from '@/types';
import {
  CAPTION_MAX_LENGTH,
  BIO_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
  USERNAME_MAX_LENGTH,
  DISPLAY_NAME_MAX_LENGTH,
  COMMENT_MAX_LENGTH,
} from '@/constants/theme';

const emailSchema = z
  .string()
  .trim()
  .min(1, 'Please enter a valid email')
  .email('Please enter a valid email')
  .transform((email) => email.toLowerCase());

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const signupSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(3, 'Enter your full name')
      .max(80, 'Full name is too long')
      .refine((value) => /\S+\s+\S+/.test(value), {
        message: 'Enter your first and last name',
      }),
    email: emailSchema,
    password: z.string().min(6, 'Password must be at least 6 characters'),
    confirmPassword: z.string(),
    acceptedTerms: z.boolean().refine((value) => value === true, {
      message: 'You must accept the Terms of Service and Privacy Policy',
    }),
    confirmedAge: z.boolean().refine((value) => value === true, {
      message: 'You must confirm you meet the minimum age requirement',
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const onboardingSchema = z.object({
  username: z
    .string()
    .min(USERNAME_MIN_LENGTH, `Username must be at least ${USERNAME_MIN_LENGTH} characters`)
    .max(USERNAME_MAX_LENGTH, `Username must be at most ${USERNAME_MAX_LENGTH} characters`)
    .regex(/^[a-zA-Z0-9_]+$/, 'Only letters, numbers, and underscores allowed'),
  fullName: z
    .string()
    .trim()
    .min(3, 'Enter your full name')
    .max(80, 'Full name is too long')
    .refine((value) => /\S+\s+\S+/.test(value), {
      message: 'Enter your first and last name',
    }),
  displayName: z
    .string()
    .min(1, 'Display name is required')
    .max(DISPLAY_NAME_MAX_LENGTH, `Display name must be at most ${DISPLAY_NAME_MAX_LENGTH} characters`),
  location: z
    .string()
    .trim()
    .min(2, 'Enter your city or area')
    .max(80, 'Location is too long'),
  bio: z.string().max(BIO_MAX_LENGTH, `Bio must be at most ${BIO_MAX_LENGTH} characters`).optional(),
});

export const editProfileSchema = z.object({
  displayName: z
    .string()
    .min(1, 'Display name is required')
    .max(DISPLAY_NAME_MAX_LENGTH),
  bio: z.string().max(BIO_MAX_LENGTH).optional(),
});

export const createPostSchema = z.object({
  caption: z
    .string()
    .min(1, 'Caption is required')
    .max(CAPTION_MAX_LENGTH, `Caption must be at most ${CAPTION_MAX_LENGTH} characters`),
  moodTag: z.enum(MOOD_TAGS as unknown as [string, ...string[]], {
    message: 'Please select a mood',
  }),
});

export const commentSchema = z.object({
  text: z
    .string()
    .min(1, 'Comment cannot be empty')
    .max(COMMENT_MAX_LENGTH, `Comment must be at most ${COMMENT_MAX_LENGTH} characters`),
});

export const reportSchema = z.object({
  reason: z.enum(REPORT_REASONS as unknown as [string, ...string[]]),
  details: z.string().max(500).optional(),
});

export function validateUsername(username: string): string | null {
  if (username.length < 3) return 'Username must be at least 3 characters';
  if (username.length > 30) return 'Username must be at most 30 characters';
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    return 'Username can only contain letters, numbers, and underscores';
  }
  return null;
}

export type LoginFormData = z.infer<typeof loginSchema>;
export type SignupFormData = z.infer<typeof signupSchema>;
export type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;
export type OnboardingFormData = z.infer<typeof onboardingSchema>;
export type EditProfileFormData = z.infer<typeof editProfileSchema>;
export type CreatePostFormData = z.infer<typeof createPostSchema>;
export const editPostSchema = createPostSchema;
export type EditPostFormData = z.infer<typeof editPostSchema>;
export type CommentFormData = z.infer<typeof commentSchema>;
export type ReportFormData = z.infer<typeof reportSchema>;
