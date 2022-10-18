import httpStatus from 'http-status'
import { config } from '../config/config'
import { ApiError } from '../utils/ApiError'
import { Context } from 'hono';

const errorConverter = (err: any) => {
  let error = err
  if (!(error instanceof ApiError)) {
    const statusCode = error.statusCode || httpStatus.INTERNAL_SERVER_ERROR
    const message = error.description || error.message || httpStatus[statusCode]
    error = new ApiError(statusCode, message, false, err.stack)
  }
  return error
}

const errorHandler = (err: any, c: Context) => {
  let { statusCode, message } = errorConverter(err)
  if (config.env === 'production' && !err.isOperational) {
    statusCode = httpStatus.INTERNAL_SERVER_ERROR
    message = httpStatus[httpStatus.INTERNAL_SERVER_ERROR]
  }

  c.set('errorMessage', err.message)

  const response = {
    code: statusCode,
    message,
    ...(config.env !== 'production' && { stack: err.stack }),
  }

  return c.json(response, statusCode)
}

export {
  errorHandler
}
