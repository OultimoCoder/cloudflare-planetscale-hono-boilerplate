import httpStatus from 'http-status'
import { getConfig } from '../config/config'
import { ApiError } from '../utils/ApiError'
import { ZodError } from 'zod'
import { generateErrorMessage, ErrorMessageOptions } from 'zod-error';

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

const errorHandler = (err, c) => {
  const config = getConfig(c.env)
  let { statusCode, message } = errorConverter(err)
  if (config.env === 'production' && !err.isOperational) {
    statusCode = httpStatus.INTERNAL_SERVER_ERROR
    message = httpStatus[httpStatus.INTERNAL_SERVER_ERROR]
  }

  const response = {
    code: statusCode,
    message,
    ...(config.env !== 'production' && { stack: err.stack }),
  }

  return c.json(response, statusCode)
}

export {
  errorHandler,
  errorConverter
}
