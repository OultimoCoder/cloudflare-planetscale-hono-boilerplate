import { z } from 'zod'
import { password } from './custom.refine.validation'
import { hashPassword } from './custom.transform.validation'

export const createUser = z.object({
  email: z.string().email(),
  password: z.string().superRefine(password).transform(hashPassword),
  name: z.string(),
  is_email_verified: z
    .any()
    .optional()
    .transform(() => false),
  role: z.union([z.literal('admin'), z.literal('user')])
})

export type CreateUser = z.infer<typeof createUser>

export const getUsers = z.object({
  email: z.string().optional(),
  sort_by: z.string().optional().default('id:asc'),
  limit: z
    .string()
    .transform((v) => parseInt(v, 10))
    .optional()
    .default('10'),
  page: z
    .string()
    .transform((v) => parseInt(v, 10))
    .optional()
    .default('0')
})

export const getUser = z.object({
  userId: z.preprocess((v) => parseInt(z.string().parse(v), 10), z.number().positive().int())
})

export const updateUser = z.object({
  params: z.object({
    userId: z.preprocess((v) => parseInt(z.string().parse(v), 10), z.number().positive().int())
  }),
  body: z
    .object({
      email: z.string().email().optional(),
      name: z.string().optional(),
      role: z.union([z.literal('admin'), z.literal('user')]).optional()
    })
    .refine(({ email, name, role }) => email || name || role, {
      message: 'At least one field is required'
    })
})

export type UpdateUser =
  | z.infer<typeof updateUser>['body']
  | { password: string }
  | { is_email_verified: boolean }

export const deleteUser = z.object({
  userId: z.preprocess((v) => parseInt(z.string().parse(v), 10), z.number().positive().int())
})
