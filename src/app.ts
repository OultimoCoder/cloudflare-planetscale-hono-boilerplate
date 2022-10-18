import { Hono } from 'hono'
import { cors } from 'hono/cors'
import httpStatus from 'http-status'
import { errorHandler } from './middlewares/error'
import { ApiError } from './utils/ApiError'
const app = new Hono()

app.use('*', cors())

app.notFound(() => {
  throw new ApiError(httpStatus.NOT_FOUND, 'Not found')
})

app.onError(errorHandler)

export default app
