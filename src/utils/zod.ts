import { ZodError } from 'zod'
import { fromError } from 'zod-validation-error'

export const generateZodErrorMessage = (error: ZodError): string => {
  return fromError(error).message
}
