import { Hono } from 'hono'
import { cors } from 'hono/cors'
import httpStatus from 'http-status'
import errorHandler from './middlewares/error.mjs'
import ApiError from './utils/ApiError.mjs'
const app = new Hono()

app.onError(errorHandler)
app.use('*', cors())

app.notFound(() => {
  throw new ApiError(httpStatus.NOT_FOUND, 'Not found')
})

export default app
