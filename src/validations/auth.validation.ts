import { z } from 'zod';
import { Role } from '../config/roles';
import { password } from './custom.refine.validation';
import { hashPassword } from './custom.transform.validation';

export const register = z.object({
  email: z.string().email(),
  password: z.string().superRefine(password).transform(hashPassword),
  first_name: z.string(),
  last_name: z.string(),
  is_email_verified: z.any().optional().transform(() => false),
  role: z.any().optional().transform(() => 'user' as Role)
});

export const login = z.object({
  email: z.string(),
  password: z.string()
});

export const refreshTokens = z.object({
  refresh_token: z.string()
});

export const forgotPassword = z.object({
  body: z.object({
    email: z.string().email()
  })
});

export const resetPassword = z.object({
  query: z.object({
    token: z.string()
  }),
  body: z.object({
    password: z.string().superRefine(password)
  })
});

export const verifyEmail = z.object({
  query: z.object({
    token: z.string()
  })
});
