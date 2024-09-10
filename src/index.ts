import { sentry } from '@hono/sentry'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import httpStatus from 'http-status'
import { Environment } from '../bindings'
import { errorHandler } from './middlewares/error'
import { defaultRoutes } from './routes'
import { ApiError } from './utils/api-error'
export { RateLimiter } from './durable-objects/rate-limiter.do'

const app = new Hono<Environment>()

app.use('*', sentry())
app.use('*', cors())

app.notFound(() => {
  throw new ApiError(httpStatus.NOT_FOUND, 'Not found')
})

app.onError(errorHandler)

defaultRoutes.forEach((route) => {
  app.route(`${route.path}`, route.route)
})

export default app
