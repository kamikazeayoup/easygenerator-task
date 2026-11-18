import isEmail from 'validator/es/lib/isEmail';
import isLength from 'validator/es/lib/isLength';
import { z } from 'zod';

const email = z.string().trim().toLowerCase()
  .refine((value) => isLength(value, { max: 254 }), 'Email must be at most 254 characters.')
  .refine(
    (value) => isEmail(value, { allow_utf8_local_part: false, ignore_max_length: true }),
    'Enter a valid email address.',
  );

export const passwordRequirements = 'Use 8 to 128 characters with a letter (A to Z), a number, and punctuation.';
const signUpPasswordPattern = /^(?=.*[A-Za-z])(?=.*[0-9])(?=.*[!-/:-@\[-`{-~])/s;

export const signInSchema = z.object({
  email,
  password: z.string()
    .min(1, 'Enter your password.')
    .refine((value) => isLength(value, { max: 128 }), 'Password must be at most 128 characters.'),
});

export const signUpSchema = z.object({
  name: z.string().trim().refine(
    (value) => isLength(value, { min: 3, max: 100 }),
    'Name must be between 3 and 100 characters.',
  ),
  email,
  password: z.string()
    .refine((value) => isLength(value, { min: 8, max: 128 }), 'Password must be between 8 and 128 characters.')
    .regex(signUpPasswordPattern, 'Include a letter (A to Z), a number, and punctuation.'),
});

export const publicUserSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  email: z.string().min(1),
});

export type SignInInput = z.infer<typeof signInSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;
export type PublicUser = z.infer<typeof publicUserSchema>;
