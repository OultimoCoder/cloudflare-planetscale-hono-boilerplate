import { ZodError } from 'zod'
import { ErrorMessageOptions, generateErrorMessage } from 'zod-error'

const zodErrorOptions: ErrorMessageOptions = {
  transform: ({ errorMessage, index }) => `Error #${index + 1}: ${errorMessage}`
}

export const generateZodErrorMessage = (error: ZodError): string => {
  return generateErrorMessage(error.issues, zodErrorOptions)
}
