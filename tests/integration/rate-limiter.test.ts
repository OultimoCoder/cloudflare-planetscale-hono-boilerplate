import { env, runInDurableObject, runDurableObjectAlarm } from 'cloudflare:test'
import dayjs from 'dayjs'
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore'
import httpStatus from 'http-status'
import MockDate from 'mockdate'
import { test, describe, expect, beforeEach } from 'vitest'
import { RateLimiter } from '../../src'

dayjs.extend(isSameOrBefore)

const key = '127.0.0.1'
const id = env.RATE_LIMITER.idFromName(key)
const fakeDomain = 'http://iamaratelimiter.com/'

describe('Durable Object RateLimiter', () => {
  describe('Fetch /', () => {
    beforeEach(async () => {
      const stub = env.RATE_LIMITER.get(id)
      await runInDurableObject(stub, async (_, state) => {
        await state.storage.deleteAll()
      })
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
      const res = await runInDurableObject(rateLimiter, async (instance: RateLimiter, _) => {
        const res = new Request(fakeDomain, {
          method: 'POST',
          body: JSON.stringify(config)
        })
        return await instance.fetch(res)
      })
      const body = await res.json()
      expect(res.status).toBe(httpStatus.OK)
      expect(body).toEqual({ blocked: false, remaining: 0, expires: expect.any(String) })
    })

    test('should return 200 and rate limit if limit hit', async () => {
      const config = {
        scope: '/v1/auth/send-verification-email',
        key,
        limit: 200,
        interval: 600
      }
      const currentWindow = Math.floor(dayjs().unix() / config.interval)
      const storageKey =
        `${config.scope}|${config.key.toString()}|${config.limit}|` +
        `${config.interval}|${currentWindow}`
      const rateLimiter = env.RATE_LIMITER.get(id)
      await runInDurableObject(rateLimiter, async (_, state) => {
        await state.storage.put(storageKey, config.limit + 1)
      })
      const start = dayjs()
      const res = await runInDurableObject(rateLimiter, async (instance: RateLimiter, _) => {
        const res = new Request(fakeDomain, {
          method: 'POST',
          body: JSON.stringify(config)
        })
        return await instance.fetch(res)
      })
      const body = await res.json()
      expect(res.status).toBe(httpStatus.OK)
      expect(body).toEqual({ blocked: true, remaining: 0, expires: expect.any(String) })

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
      const storageKey =
        `${config.scope}|${config.key.toString()}|${config.limit}|` +
        `${config.interval}|${currentWindow}`
      const rateLimiter = env.RATE_LIMITER.get(id)
      await runInDurableObject(rateLimiter, async (_, state) => {
        await state.storage.put(storageKey, config.limit + 1)
      })
      const res = await runInDurableObject(rateLimiter, async (instance: RateLimiter, _) => {
        const res = new Request(fakeDomain, {
          method: 'POST',
          body: JSON.stringify(config)
        })
        return await instance.fetch(res)
      })
      const body = await res.json()
      expect(res.status).toBe(httpStatus.OK)
      expect(body).toEqual({ blocked: true, remaining: 0, expires: expect.any(String) })

      config.scope = '/v1/different-endpoint'
      const res2 = await runInDurableObject(rateLimiter, async (instance: RateLimiter, _) => {
        const res = new Request(fakeDomain, {
          method: 'POST',
          body: JSON.stringify(config)
        })
        return await instance.fetch(res)
      })
      const body2 = await res2.json()
      expect(res2.status).toBe(httpStatus.OK)
      expect(body2).toEqual({ blocked: false, remaining: 199, expires: expect.any(String) })
    })

    test('should return 200 and not rate limit if different key used', async () => {
      const config = {
        scope: '/v1/auth/send-verification-email',
        key,
        limit: 200,
        interval: 600
      }
      const currentWindow = Math.floor(dayjs().unix() / config.interval)
      const storageKey =
        `${config.scope}|${config.key.toString()}|${config.limit}|` +
        `${config.interval}|${currentWindow}`
      const rateLimiter = env.RATE_LIMITER.get(id)
      await runInDurableObject(rateLimiter, async (_, state) => {
        await state.storage.put(storageKey, config.limit + 1)
      })
      const res = await runInDurableObject(rateLimiter, async (instance: RateLimiter, _) => {
        const res = new Request(fakeDomain, {
          method: 'POST',
          body: JSON.stringify(config)
        })
        return await instance.fetch(res)
      })
      const body = await res.json()
      expect(res.status).toBe(httpStatus.OK)
      expect(body).toEqual({ blocked: true, remaining: 0, expires: expect.any(String) })
      config.key = '192.169.2.1'
      const res2 = await runInDurableObject(rateLimiter, async (instance: RateLimiter, _) => {
        const res = new Request(fakeDomain, {
          method: 'POST',
          body: JSON.stringify(config)
        })
        return await instance.fetch(res)
      })
      const body2 = await res2.json()
      expect(res2.status).toBe(httpStatus.OK)
      expect(body2).toEqual({ blocked: false, remaining: 199, expires: expect.any(String) })
    })

    test('should return 200 and not rate limit if window expired', async () => {
      const config = {
        scope: '/v1/auth/send-verification-email',
        key,
        limit: 200,
        interval: 600
      }
      const currentWindow = Math.floor(dayjs().unix() / config.interval)
      const storageKey =
        `${config.scope}|${config.key.toString()}|${config.limit}|` +
        `${config.interval}|${currentWindow}`
      const rateLimiter = env.RATE_LIMITER.get(id)
      await runInDurableObject(rateLimiter, async (_, state) => {
        await state.storage.put(storageKey, config.limit)
      })
      const res = await runInDurableObject(rateLimiter, async (instance: RateLimiter, _) => {
        const res = new Request(fakeDomain, {
          method: 'POST',
          body: JSON.stringify(config)
        })
        return await instance.fetch(res)
      })
      const body = await res.json()
      expect(res.status).toBe(httpStatus.OK)
      expect(body).toEqual({ blocked: true, remaining: 0, expires: expect.any(String) })
      const expires = dayjs(res.headers.get('expires'))
      MockDate.set(expires.add(1, 'second').toDate())
      const res2 = await runInDurableObject(rateLimiter, async (instance: RateLimiter, _) => {
        const res = new Request(fakeDomain, {
          method: 'POST',
          body: JSON.stringify(config)
        })
        return await instance.fetch(res)
      })
      const body2 = await res2.json()
      expect(res2.status).toBe(httpStatus.OK)
      expect(body2).toEqual({ blocked: false, remaining: 0, expires: expect.any(String) })
    })

    test('should return 200 and rate limit if just before window expiry', async () => {
      const config = {
        scope: '/v1/auth/send-verification-email',
        key,
        limit: 200,
        interval: 600
      }
      const currentWindow = Math.floor(dayjs().unix() / config.interval)
      const storageKey =
        `${config.scope}|${config.key.toString()}|${config.limit}|` +
        `${config.interval}|${currentWindow}`
      const rateLimiter = env.RATE_LIMITER.get(id)
      await runInDurableObject(rateLimiter, async (_, state) => {
        await state.storage.put(storageKey, config.limit + 1)
      })
      const res = await runInDurableObject(rateLimiter, async (instance: RateLimiter, _) => {
        const res = new Request(fakeDomain, {
          method: 'POST',
          body: JSON.stringify(config)
        })
        return await instance.fetch(res)
      })
      const body = await res.json()
      expect(res.status).toBe(httpStatus.OK)
      expect(body).toEqual({ blocked: true, remaining: 0, expires: expect.any(String) })

      const expires = dayjs(res.headers.get('expires')).subtract(1, 'second')
      MockDate.set(expires.toDate())

      const res2 = await runInDurableObject(rateLimiter, async (instance: RateLimiter, _) => {
        const res = new Request(fakeDomain, {
          method: 'POST',
          body: JSON.stringify(config)
        })
        return await instance.fetch(res)
      })
      const body2 = await res2.json()
      expect(res2.status).toBe(httpStatus.OK)
      expect(body2).toEqual({ blocked: true, remaining: 0, expires: expect.any(String) })
    })

    test('should return 400 if config is invalid', async () => {
      const config = {
        key,
        limit: 1,
        interval: 60
      }
      expect(true).toBe(true)
      const rateLimiter = env.RATE_LIMITER.get(id)
      const res = await runInDurableObject(rateLimiter, async (instance: RateLimiter, _) => {
        const res = new Request(fakeDomain, {
          method: 'POST',
          body: JSON.stringify(config)
        })
        return await instance.fetch(res)
      })
      const _ = await res.json() // https://github.com/cloudflare/workers-sdk/issues/5629
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
      const res = await runInDurableObject(rateLimiter, async (instance: RateLimiter, _) => {
        const res = new Request(fakeDomain, {
          method: 'POST',
          body: JSON.stringify(config)
        })
        return await instance.fetch(res)
      })
      const _ = await res.json() // https://github.com/cloudflare/workers-sdk/issues/5629
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
      const res = await runInDurableObject(rateLimiter, async (instance: RateLimiter, _) => {
        const res = new Request(fakeDomain, {
          method: 'POST',
          body: JSON.stringify(config)
        })
        return await instance.fetch(res)
      })
      const _ = await res.json() // https://github.com/cloudflare/workers-sdk/issues/5629
      expect(res.status).toBe(httpStatus.BAD_REQUEST)
    })
  })

  describe('Alarm', () => {
    beforeEach(async () => {
      MockDate.reset()
    })

    test('should expire key after 2 intervals have passed', async () => {
      const doConfig = {
        scope: '/v1/auth/send-verification-email',
        key,
        limit: 1,
        interval: 60
      }
      const rateLimiter = env.RATE_LIMITER.get(id)
      const currentWindow = Math.floor(dayjs().unix() / doConfig.interval)
      const storageKey =
        `${doConfig.scope}|${doConfig.key.toString()}|${doConfig.limit}|` +
        `${doConfig.interval}|${currentWindow}`

      const res = await runInDurableObject(rateLimiter, async (instance: RateLimiter, _) => {
        const res = new Request(fakeDomain, {
          method: 'POST',
          body: JSON.stringify(doConfig)
        })
        return await instance.fetch(res)
      })
      const _ = await res.json() // https://github.com/cloudflare/workers-sdk/issues/5629
      expect(res.status).toBe(httpStatus.OK)
      const values = await runInDurableObject(rateLimiter, async (_, state) => {
        return await state.storage.list()
      })
      expect(values.size).toBe(1)
      expect(values.get(storageKey)).toBe(1)

      MockDate.set(
        dayjs()
          .add(doConfig.interval * 3, 'seconds')
          .toDate()
      )
      await runInDurableObject(rateLimiter, async (_, state) => {
        await state.storage.put(storageKey, doConfig.limit + 1)
      })
      await runDurableObjectAlarm(rateLimiter)
      const values2 = await runInDurableObject(rateLimiter, async (_, state) => {
        return await state.storage.list()
      })
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
      const storageKey =
        `${config.scope}|${config.key.toString()}|${config.limit}|` +
        `${config.interval}|${currentWindow}`

      const res = await runInDurableObject(rateLimiter, async (instance: RateLimiter, _) => {
        const res = new Request(fakeDomain, {
          method: 'POST',
          body: JSON.stringify(config)
        })
        return await instance.fetch(res)
      })
      const _ = await res.json() // https://github.com/cloudflare/workers-sdk/issues/5629
      expect(res.status).toBe(httpStatus.OK)
      const values = await runInDurableObject(rateLimiter, async (_, state) => {
        return await state.storage.list()
      })
      expect(values.size).toBe(1)
      expect(values.get(storageKey)).toBe(1)

      MockDate.set(
        dayjs()
          .add(config.interval * 1.5, 'seconds')
          .toDate()
      )
      await runDurableObjectAlarm(rateLimiter)
      const values2 = await runInDurableObject(rateLimiter, async (_, state) => {
        return await state.storage.list()
      })
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
      const storageKey =
        `${config.scope}|${config.key.toString()}|${config.limit}|` +
        `${config.interval}|${currentWindow}`

      const res = await runInDurableObject(rateLimiter, async (instance: RateLimiter, _) => {
        const res = new Request(fakeDomain, {
          method: 'POST',
          body: JSON.stringify(config)
        })
        return await instance.fetch(res)
      })
      const _ = await res.json() // https://github.com/cloudflare/workers-sdk/issues/5629
      expect(res.status).toBe(httpStatus.OK)

      const expiredWindow = Math.floor(dayjs().unix() / config.interval - 3)
      const expiredStorageKey =
        `${config.scope}|${config.key.toString()}|${config.limit}|` +
        `${config.interval}|${expiredWindow}`

      await runInDurableObject(rateLimiter, async (_, state) => {
        await state.storage.put(expiredStorageKey, 45)
      })

      const expiredWindow2 = Math.floor(dayjs().unix() / config.interval - 7)
      const expiredStorageKey2 =
        `${config.scope}|${config.key.toString()}|${config.limit}|` +
        `${config.interval}|${expiredWindow2}`

      await runInDurableObject(rateLimiter, async (_, state) => {
        await state.storage.put(expiredStorageKey2, 33)
      })

      const expiredWindow3 = Math.floor(dayjs().unix() / config.interval - 4)
      const expiredStorageKey3 =
        `${config.scope}|${config.key.toString()}|${config.limit}|` +
        `${config.interval}|${expiredWindow3}`

      await runInDurableObject(rateLimiter, async (_, state) => {
        await state.storage.put(expiredStorageKey3, 12)
      })

      const window2 = Math.floor(dayjs().unix() / config.interval - 1.5)
      const storageKey2 =
        `${config.scope}|${config.key.toString()}|${config.limit}|` +
        `${config.interval}|${window2}`

      await runInDurableObject(rateLimiter, async (_, state) => {
        await state.storage.put(storageKey2, 12)
      })

      const values = await runInDurableObject(rateLimiter, async (_, state) => {
        return await state.storage.list()
      })
      expect(values.size).toBe(5)

      await runDurableObjectAlarm(rateLimiter)

      const values2 = await runInDurableObject(rateLimiter, async (_, state) => {
        return await state.storage.list()
      })
      expect(values2.size).toBe(2)
      expect(values2.get(expiredStorageKey)).toBeUndefined()
      expect(values2.get(expiredStorageKey2)).toBeUndefined()
      expect(values2.get(expiredStorageKey3)).toBeUndefined()
      expect(values2.get(storageKey)).toBe(1)
      expect(values2.get(storageKey2)).toBe(12)
    })
  })
})
