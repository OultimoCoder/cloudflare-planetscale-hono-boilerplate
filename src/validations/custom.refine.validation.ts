import { z } from 'zod'

export const password = async (value: string, ctx: z.RefinementCtx): Promise<void> => {
  if (value.length < 8) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'password must be at least 8 characters'
    })
    return
  }
  if (!value.match(/\d/) || !value.match(/[a-zA-Z]/)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'password must contain at least 1 letter and 1 number'
    })
    return
  }
}
