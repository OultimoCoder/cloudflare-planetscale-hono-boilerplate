import { z } from 'zod'
import { password } from './custom.refine.validation'
import { hashPassword } from './custom.transform.validation'
import { roleZodType } from './custom.type.validation'

export const register = z.strictObject({
  email: z.string().email(),
  password: z.string().superRefine(password).transform(hashPassword),
  name: z.string(),
  is_email_verified: z
    .any()
    .optional()
    .transform(() => false),
  role: roleZodType
})

export const login = z.strictObject({
  email: z.string(),
  password: z.string()
})

export const refreshTokens = z.strictObject({
  refresh_token: z.string()
})

export const forgotPassword = z.strictObject({
  email: z.string().email()
})

export const resetPassword = z.strictObject({
  query: z.object({
    token: z.string()
  }),
  body: z.object({
    password: z.string().superRefine(password).transform(hashPassword)
  })
})

export const verifyEmail = z.strictObject({
  token: z.string()
})

export const changePassword = z.strictObject({
  oldPassword: z.string().superRefine(password).transform(hashPassword),
  newPassword: z.string().superRefine(password).transform(hashPassword)
})

export const oauthCallback = z.strictObject({
  code: z.string()
})
