import dayjs from 'dayjs'
import { Context, MiddlewareHandler } from 'hono'
import httpStatus from 'http-status'
import { Environment } from '../../bindings'
import { ApiError } from '../utils/api-error'

const fakeDomain = 'http://rate-limiter.com/'

const getRateLimitKey = (c: Context) => {
  const ip = c.req.raw.headers.get('cf-connecting-ip')
  const user = c.get('payload')?.sub
  const uniqueKey = user ? user : ip
  return uniqueKey
}

const getCacheKey = (endpoint: string, key: number | string, limit: number, interval: number) => {
  return `${fakeDomain}${endpoint}/${key}/${limit}/${interval}`
}

const setRateLimitHeaders = (
  c: Context,
  secondsExpires: number,
  limit: number,
  remaining: number,
  interval: number
) => {
  c.header('X-RateLimit-Limit', limit.toString())
  c.header('X-RateLimit-Remaining', remaining.toString())
  c.header('X-RateLimit-Reset', secondsExpires.toString())
  c.header('X-RateLimit-Policy', `${limit};w=${interval};comment="Sliding window"`)
}

export const rateLimit = (interval: number, limit: number): MiddlewareHandler<Environment> => {
  return async (c, next) => {
    const key = getRateLimitKey(c)
    const endpoint = new URL(c.req.url).pathname
    const id = c.env.RATE_LIMITER.idFromName(key)
    const rateLimiter = c.env.RATE_LIMITER.get(id)
    const cache = await caches.open('rate-limiter')
    const cacheKey = getCacheKey(endpoint, key, limit, interval)
    const cached = await cache.match(cacheKey)
    let res: Response
    if (!cached) {
      res = await rateLimiter.fetch(
        new Request(fakeDomain, {
          method: 'POST',
          body: JSON.stringify({
            scope: endpoint,
            key,
            limit,
            interval
          })
        })
      )
    } else {
      res = cached
    }
    const clonedRes = res.clone()
    // eslint-disable-next-line no-console
    console.log() // This randomly fixes isolated storage errors
    const body = await clonedRes.json<{ blocked: boolean; remaining: number; expires: string }>()
    const secondsExpires = dayjs(body.expires).unix() - dayjs().unix()
    setRateLimitHeaders(c, secondsExpires, limit, body.remaining, interval)
    if (body.blocked) {
      if (!cached) {
        // Only cache blocked responses
        c.executionCtx.waitUntil(cache.put(cacheKey, res))
      }
      throw new ApiError(httpStatus.TOO_MANY_REQUESTS, 'Too many requests')
    }
    await next()
  }
}
