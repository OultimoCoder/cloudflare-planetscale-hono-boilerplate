import { z } from 'zod'

export const roleZodType = z.union([z.literal('admin'), z.literal('user')])
