import httpStatus from 'http-status'
import { ApiError } from '../utils/ApiError'

const fakeDomain = 'http://rate-limiter.com'

const getRateLimitKey = (c: any) => {
  const ip = c.req.headers.get('cf-connecting-ip')
  const user = c.get('payload')?.sub
  const uniqueKey = user ? user : ip
  return uniqueKey
}

const getCacheKey = (endpoint: string, key: number | string, limit: number, interval: number) => {
  return `${fakeDomain}${endpoint}/${key}/${limit}/${interval}`
}

const isRateLimited = async (res: Response) => {
  const body = await res.json<{ blocked: boolean }>()
  return body.blocked
}

const rateLimit = (interval: number, limit: number) => async (c: any, next: Function) => {
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
    c.executionCtx.waitUntil(cache.put(cacheKey, res.clone()))
  } else {
    res = cached
  }
  if (await isRateLimited(res))
    throw new ApiError(httpStatus.TOO_MANY_REQUESTS, 'Too many requests')
  await next()
}

export { rateLimit }
