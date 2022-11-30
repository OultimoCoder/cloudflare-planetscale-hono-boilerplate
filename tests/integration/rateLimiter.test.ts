import dayjs from 'dayjs'
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore'
import httpStatus from 'http-status'
import MockDate from 'mockdate'

dayjs.extend(isSameOrBefore)

const env = getMiniflareBindings()
const key = '127.0.0.1'
const id = env.RATE_LIMITER.idFromName(key)
const fakeDomain = 'http://iamaratelimiter.com/'

describe('Durable Object RateLimiter', () => {
  describe('Fetch /', () => {
    let storage: DurableObjectStorage

    beforeEach(async () => {
      storage = await getMiniflareDurableObjectStorage(id)
      storage.deleteAll()
      MockDate.reset()
    })

    test('should return 200 and not rate limit if limit not hit', async () => {
      const config = {
        scope: '/v1/auth/send-verification-email',
        key,
        limit: 1,
        interval: 60
      }
      const rateLimiter = env.RATE_LIMITER.get(id)
      const res = await rateLimiter.fetch(
        new Request(fakeDomain, {
          method: 'POST',
          body: JSON.stringify(config)
        })
      )
      const body = await res.json()
      expect(res.status).toBe(httpStatus.OK)
      expect(body).toEqual({ blocked: false })
    })

    test('should return 200 and rate limit if limit hit', async () => {
      const config = {
        scope: '/v1/auth/send-verification-email',
        key,
        limit: 200,
        interval: 600
      }
      const currentWindow = Math.floor(dayjs().unix() / config.interval)
      const storageKey = `${config.scope}|${config.key.toString()}|${config.limit}|` +
        `${config.interval}|${currentWindow}`

      await storage.put(storageKey, config.limit+1)

      const rateLimiter = env.RATE_LIMITER.get(id)
      const start = dayjs()
      const res = await rateLimiter.fetch(
        new Request(fakeDomain, {
          method: 'POST',
          body: JSON.stringify(config)
        })
      )
      const body = await res.json()
      expect(res.status).toBe(httpStatus.OK)
      expect(body).toEqual({ blocked: true })

      const expires = dayjs(res.headers.get('expires'))
      expect(start.isSameOrBefore(expires)).toBe(true)

      const cacheControl = res.headers.get('cache-control')
      expect(cacheControl).toBeDefined()
    })

    test('should return 200 and not rate limit if different endpoint hit', async () => {
      const config = {
        scope: '/v1/auth/send-verification-email',
        key,
        limit: 200,
        interval: 600
      }
      const currentWindow = Math.floor(dayjs().unix() / config.interval)
      const storageKey = `${config.scope}|${config.key.toString()}|${config.limit}|` +
        `${config.interval}|${currentWindow}`

      await storage.put(storageKey, config.limit+1)

      const rateLimiter = env.RATE_LIMITER.get(id)
      const res = await rateLimiter.fetch(
        new Request(fakeDomain, {
          method: 'POST',
          body: JSON.stringify(config)
        })
      )
      const body = await res.json()
      expect(res.status).toBe(httpStatus.OK)
      expect(body).toEqual({ blocked: true })

      config.scope = '/v1/different-endpoint'
      const res2 = await rateLimiter.fetch(
        new Request(fakeDomain, {
          method: 'POST',
          body: JSON.stringify(config)
        })
      )
      const body2 = await res2.json()
      expect(res2.status).toBe(httpStatus.OK)
      expect(body2).toEqual({ blocked: false })
    })

    test('should return 200 and not rate limit if different key used', async () => {
      const config = {
        scope: '/v1/auth/send-verification-email',
        key,
        limit: 200,
        interval: 600
      }
      const currentWindow = Math.floor(dayjs().unix() / config.interval)
      const storageKey = `${config.scope}|${config.key.toString()}|${config.limit}|` +
        `${config.interval}|${currentWindow}`

      await storage.put(storageKey, config.limit+1)

      const rateLimiter = env.RATE_LIMITER.get(id)
      const res = await rateLimiter.fetch(
        new Request(fakeDomain, {
          method: 'POST',
          body: JSON.stringify(config)
        })
      )
      const body = await res.json()
      expect(res.status).toBe(httpStatus.OK)
      expect(body).toEqual({ blocked: true })

      config.key = '192.169.2.1'
      const res2 = await rateLimiter.fetch(
        new Request(fakeDomain, {
          method: 'POST',
          body: JSON.stringify(config)
        })
      )
      const body2 = await res2.json()
      expect(res2.status).toBe(httpStatus.OK)
      expect(body2).toEqual({ blocked: false })
    })

    test('should return 200 and not rate limit if window expired', async () => {
      const config = {
        scope: '/v1/auth/send-verification-email',
        key,
        limit: 200,
        interval: 600
      }
      const currentWindow = Math.floor(dayjs().unix() / config.interval)
      const storageKey = `${config.scope}|${config.key.toString()}|${config.limit}|` +
        `${config.interval}|${currentWindow}`

      await storage.put(storageKey, config.limit+1)

      const rateLimiter = env.RATE_LIMITER.get(id)
      const res = await rateLimiter.fetch(
        new Request(fakeDomain, {
          method: 'POST',
          body: JSON.stringify(config)
        })
      )
      const body = await res.json()
      expect(res.status).toBe(httpStatus.OK)
      expect(body).toEqual({ blocked: true })
      const expires = dayjs(res.headers.get('expires'))
      MockDate.set(expires.add(1, 'second').toDate())
      const res2 = await rateLimiter.fetch(
        new Request(fakeDomain, {
          method: 'POST',
          body: JSON.stringify(config)
        })
      )
      const body2 = await res2.json()
      expect(res2.status).toBe(httpStatus.OK)
      expect(body2).toEqual({ blocked: false })
    })

    test('should return 200 and rate limit if just before window expiry', async () => {
      const config = {
        scope: '/v1/auth/send-verification-email',
        key,
        limit: 200,
        interval: 600
      }
      const currentWindow = Math.floor(dayjs().unix() / config.interval)
      const storageKey = `${config.scope}|${config.key.toString()}|${config.limit}|` +
        `${config.interval}|${currentWindow}`

      await storage.put(storageKey, config.limit+1)

      const rateLimiter = env.RATE_LIMITER.get(id)
      const res = await rateLimiter.fetch(
        new Request(fakeDomain, {
          method: 'POST',
          body: JSON.stringify(config)
        })
      )
      const body = await res.json()
      expect(res.status).toBe(httpStatus.OK)
      expect(body).toEqual({ blocked: true })

      const expires = dayjs(res.headers.get('expires')).subtract(1, 'second')
      MockDate.set(expires.toDate())

      const res2 = await rateLimiter.fetch(
        new Request(fakeDomain, {
          method: 'POST',
          body: JSON.stringify(config)
        })
      )
      const body2 = await res2.json()
      expect(res2.status).toBe(httpStatus.OK)
      expect(body2).toEqual({ blocked: true })
    })

    test('should return 400 if config is invalid', async () => {
      const config = {
        key,
        limit: 1,
        interval: 60
      }
      const rateLimiter = env.RATE_LIMITER.get(id)
      const res = await rateLimiter.fetch(
        new Request(fakeDomain, {
          method: 'POST',
          body: JSON.stringify(config)
        })
      )
      expect(res.status).toBe(httpStatus.BAD_REQUEST)
    })

    test('should return 400 if limit is not an integer', async () => {
      const config = {
        scope: '/v1/auth/send-verification-email',
        key,
        limit: 'hi',
        interval: 60
      }
      const rateLimiter = env.RATE_LIMITER.get(id)
      const res = await rateLimiter.fetch(
        new Request(fakeDomain, {
          method: 'POST',
          body: JSON.stringify(config)
        })
      )
      expect(res.status).toBe(httpStatus.BAD_REQUEST)
    })

    test('should return 400 if interval is not an integer', async () => {
      const config = {
        scope: '/v1/auth/send-verification-email',
        key,
        limit: 1,
        interval: 'hiiam interval'
      }
      const rateLimiter = env.RATE_LIMITER.get(id)
      const res = await rateLimiter.fetch(
        new Request(fakeDomain, {
          method: 'POST',
          body: JSON.stringify(config)
        })
      )
      expect(res.status).toBe(httpStatus.BAD_REQUEST)
    })
  })

  describe('Alarm', () => {
    let storage: DurableObjectStorage

    beforeEach(async () => {
      storage = await getMiniflareDurableObjectStorage(id)
      MockDate.reset()
    })

    test('should expire key after 2 intervals have passed', async () => {
      const config = {
        scope: '/v1/auth/send-verification-email',
        key,
        limit: 1,
        interval: 60
      }
      const rateLimiter = env.RATE_LIMITER.get(id)
      const currentWindow = Math.floor(dayjs().unix() / config.interval)
      const storageKey = `${config.scope}|${config.key.toString()}|${config.limit}|` +
        `${config.interval}|${currentWindow}`

      const res = await rateLimiter.fetch(
        new Request(fakeDomain, {
          method: 'POST',
          body: JSON.stringify(config)
        })
      )
      expect(res.status).toBe(httpStatus.OK)
      const values = await storage.list()
      expect(values.size).toBe(1)
      expect(values.get(storageKey)).toBe(1)

      MockDate.set(dayjs().add(config.interval * 3, 'seconds').toDate())
      await flushMiniflareDurableObjectAlarms()
      const values2 = await storage.list()
      expect(values2.size).toBe(0)
    })

    test('should not expire key if within 2 intervals', async () => {
      const config = {
        scope: '/v1/auth/send-verification-email',
        key,
        limit: 1,
        interval: 60
      }
      const rateLimiter = env.RATE_LIMITER.get(id)
      const currentWindow = Math.floor(dayjs().unix() / config.interval)
      const storageKey = `${config.scope}|${config.key.toString()}|${config.limit}|` +
        `${config.interval}|${currentWindow}`

      const res = await rateLimiter.fetch(
        new Request(fakeDomain, {
          method: 'POST',
          body: JSON.stringify(config)
        })
      )
      expect(res.status).toBe(httpStatus.OK)
      const values = await storage.list()
      expect(values.size).toBe(1)
      expect(values.get(storageKey)).toBe(1)

      MockDate.set(dayjs().add(config.interval * 1.5, 'seconds').toDate())
      await flushMiniflareDurableObjectAlarms()
      const values2 = await storage.list()
      expect(values2.size).toBe(1)
      expect(values2.get(storageKey)).toBe(1)
    })

    test('should expire keys that are more than 2 intervals old and keep the others', async () => {
      const config = {
        scope: '/v1/auth/send-verification-email',
        key,
        limit: 1,
        interval: 60
      }
      const rateLimiter = env.RATE_LIMITER.get(id)

      const currentWindow = Math.floor(dayjs().unix() / config.interval)
      const storageKey = `${config.scope}|${config.key.toString()}|${config.limit}|` +
        `${config.interval}|${currentWindow}`

      const res = await rateLimiter.fetch(
        new Request(fakeDomain, {
          method: 'POST',
          body: JSON.stringify(config)
        })
      )
      expect(res.status).toBe(httpStatus.OK)

      const expiredWindow = Math.floor(dayjs().unix() / config.interval - 3) 
      const expiredStorageKey = `${config.scope}|${config.key.toString()}|${config.limit}|` +
        `${config.interval}|${expiredWindow}`

      await storage.put(expiredStorageKey, 45)

      const expiredWindow2 = Math.floor(dayjs().unix() / config.interval - 7) 
      const expiredStorageKey2 = `${config.scope}|${config.key.toString()}|${config.limit}|` +
        `${config.interval}|${expiredWindow2}`

      await storage.put(expiredStorageKey2, 33)

      const expiredWindow3 = Math.floor(dayjs().unix() / config.interval - 4) 
      const expiredStorageKey3 = `${config.scope}|${config.key.toString()}|${config.limit}|` +
        `${config.interval}|${expiredWindow3}`

      await storage.put(expiredStorageKey3, 12)

      const window2 = Math.floor(dayjs().unix() / config.interval - 1.5)
      const storageKey2 = `${config.scope}|${config.key.toString()}|${config.limit}|` +
        `${config.interval}|${window2}`

      await storage.put(storageKey2, 12)

      const values = await storage.list()
      expect(values.size).toBe(5)

      await flushMiniflareDurableObjectAlarms()

      const values2 = await storage.list()
      expect(values2.size).toBe(2)
      expect(values2.get(expiredStorageKey)).toBeUndefined()
      expect(values2.get(expiredStorageKey2)).toBeUndefined()
      expect(values2.get(expiredStorageKey3)).toBeUndefined()
      expect(values2.get(storageKey)).toBe(1)
      expect(values2.get(storageKey2)).toBe(12)
    })
  })
})
