import httpStatus from 'http-status'
import { getConfig } from '../config/config'
import { ApiError } from '../utils/ApiError'
import { ZodError } from 'zod'
import { generateErrorMessage, ErrorMessageOptions } from 'zod-error';
import type { ErrorHandler } from 'hono';

const zodErrorOptions: ErrorMessageOptions = {
  transform: ({ errorMessage, index }) => `Error #${index + 1}: ${errorMessage}`
};

const errorConverter = (err: any) => {
  let error = err
  if (error instanceof ZodError) {
    const errorMessage = generateErrorMessage(error.issues, zodErrorOptions)
    error = new ApiError(httpStatus.BAD_REQUEST, errorMessage)
  } else if (!(error instanceof ApiError)) {
    const statusCode = error.statusCode || httpStatus.INTERNAL_SERVER_ERROR
    const message = error.description || error.message || httpStatus[statusCode]
    error = new ApiError(statusCode, message, false, err.stack)
  }
  return error
}

const errorHandler: ErrorHandler<{ Bindings: Bindings }> = (err, c) => {
  const config = getConfig(c.env)
  const error = errorConverter(err)
  if (config.env === 'production' && !error.isOperational) {
    error.statusCode = httpStatus.INTERNAL_SERVER_ERROR
    error.message = httpStatus[httpStatus.INTERNAL_SERVER_ERROR]
  }

  const response = {
    code: error.statusCode,
    message: error.message,
    ...(config.env !== 'production' && { stack: err.stack }),
  }

  return c.json(response, error.statusCode)
}

export {
  errorHandler,
  errorConverter
}
