import { Hono } from 'hono'
import { cors } from 'hono/cors'
import httpStatus from 'http-status'
import { errorHandler } from './middlewares/error'
import { ApiError } from './utils/ApiError'
import { Bindings } from '../bindings'

const app = new Hono<{ Bindings: Bindings }>()

app.use('*', cors())

app.notFound(() => {
  throw new ApiError(httpStatus.NOT_FOUND, 'Not found')
})

app.onError(errorHandler)

export default app
