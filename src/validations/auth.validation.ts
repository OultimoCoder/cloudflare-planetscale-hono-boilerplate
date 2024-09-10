import { z } from 'zod'
import { password } from './custom.refine.validation'
import { hashPassword } from './custom.transform.validation'

export const register = z.strictObject({
  email: z.string().email(),
  password: z.string().superRefine(password).transform(hashPassword),
  name: z.string()
})

export type Register = z.infer<typeof register>

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

export const oauthCallback = z.object({
  code: z.string(),
  platform: z.union([z.literal('web'), z.literal('ios'), z.literal('android')])
})

export const linkApple = z.object({
  code: z.string()
})

export const oauthRedirect = z.object({
  state: z.string()
})

export const validateOneTimeCode = z.object({
  code: z.string()
})

export const stateValidation = z.object({
  platform: z.union([z.literal('web'), z.literal('ios'), z.literal('android')])
})
