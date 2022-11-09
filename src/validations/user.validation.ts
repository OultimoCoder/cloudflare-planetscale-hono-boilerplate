import { z } from 'zod';
import { password } from './custom.refine.validation';
import { Role } from '../config/roles';
import { hashPassword } from './custom.transform.validation';

export const createUser = z.object({
  email: z.string().email(),
  password: z.string().superRefine(password).transform(hashPassword),
  first_name: z.string(),
  last_name: z.string(),
  is_email_verified: z.any().optional().transform(() => false),
  role: z.union([z.literal('admin'), z.literal('user')]),
});

export type CreateUser = z.infer<typeof createUser>;

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
});

export const getUser = z.object({
  userId: z.preprocess(
      (v) => parseInt(z.string().parse(v), 10),
      z.number().positive().int()
  )
});

export const updateUser = z.object({
  params: z.object({
    userId: z.preprocess(
      (v) => parseInt(z.string().parse(v), 10),
      z.number().positive().int()
    )
  }),
  body: z.object({
    email: z.string().email().optional(),
    first_name: z.string().optional(),
    last_name: z.string().optional(),
    role: z.union([z.literal('admin'), z.literal('user')]).optional(),
  })
  .refine(
    ({email, first_name, last_name, role}) =>
      email || first_name || last_name || role,
    {message: "At least one field is required"}
  )
});

export type UpdateUser = z.infer<typeof updateUser>['body'];

export const deleteUser = z.object({
  userId: z.preprocess(
    (v) => parseInt(z.string().parse(v), 10),
    z.number().positive().int()
  )
});
