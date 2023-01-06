import { sentry } from '@honojs/sentry'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import httpStatus from 'http-status'
import { errorHandler } from './middlewares/error'
import { defaultRoutes } from './routes'
import { ApiError } from './utils/ApiError'

const app = new Hono<{ Bindings: Bindings }>()

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
