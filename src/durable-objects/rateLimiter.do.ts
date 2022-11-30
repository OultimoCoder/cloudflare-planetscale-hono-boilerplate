import dayjs from 'dayjs'
import { Context, Hono } from 'hono'
import { StatusCode } from 'hono/utils/http-status'
import httpStatus  from 'http-status'
import { z, ZodError } from 'zod'
import { generateErrorMessage, ErrorMessageOptions } from 'zod-error'

interface Config {
  scope: string
  key: string
  limit: number
  interval: number
}

const configValidation = z.object({
  scope: z.string(),
  key: z.string(),
  limit: z.number().int().positive(),
  interval: z.number().int().positive()
})

const zodErrorOptions: ErrorMessageOptions = {
  transform: ({ errorMessage, index }) => `Error #${index + 1}: ${errorMessage}`
}

class RateLimiter {
  state: DurableObjectState
  env: Bindings
  app: Hono = new Hono()

  constructor(state: DurableObjectState, env: Bindings) {
      this.state = state
      this.env = env

      this.app.post('/', async (c) => {
        await this.setAlarm()
        let config
        try {
          config = await this.getConfig(c)
        } catch (err: any) {
          let errorMessage = err.message
          if (err instanceof ZodError) {
            errorMessage = generateErrorMessage(err.issues, zodErrorOptions)
          }
          return c.json({
            statusCode: httpStatus.BAD_REQUEST,
            error: errorMessage
          }, httpStatus.BAD_REQUEST as StatusCode)
        }
        const rate = await this.calculateRate(config)
        const blocked = this.isRateLimited(rate, config.limit)
        const headers = this.getHeaders(blocked, rate, config)
        return c.json({blocked}, httpStatus.OK as StatusCode, headers)
      })
  }

  async alarm() {
    const values = await this.state.storage.list()
    for await (const [key, _value] of values) {
      const [_scope, _key, _limit, interval, timestamp] = key.split('|')
      const currentWindow = Math.floor(this.nowUnix() / parseInt(interval))
      const timestampLessThan = currentWindow - 2 // expire all keys after 2 intervals have passed
      if (parseInt(timestamp) < timestampLessThan) {
        await this.state.storage.delete(key)
      }
    }
  }

  async setAlarm() {
    const alarm = await this.state.storage.getAlarm()
    if (!alarm) {
      this.state.storage.setAlarm(dayjs().add(6, 'hours').toDate())
    }
  }

  async getConfig(c: Context) {
    const body = await c.req.clone().json<Config>()
    const config = configValidation.parse(body)
    return config
  }

  async incrementRequestCount(key: string) {
    const currentRequestCount = await this.getRequestCount(key)
    await this.state.storage.put(key, currentRequestCount + 1)
  }

  async getRequestCount(key: string): Promise<number> {
    return parseInt((await this.state.storage.get(key)) as string) || 0
  }

  nowUnix() {
    return dayjs().unix()
  }

  async calculateRate(config: Config) {
    const keyPrefix = `${config.scope}|${config.key}|${config.limit}|${config.interval}`
    const currentWindow = Math.floor(this.nowUnix() / config.interval)
    const distanceFromLastWindow = this.nowUnix() % config.interval
    const currentKey = `${keyPrefix}|${currentWindow}`
    const previousKey = `${keyPrefix}|${currentWindow - 1}`
    const currentCount = await this.getRequestCount(currentKey)
    const previousCount = await this.getRequestCount(previousKey) || config.limit
    const rate = (previousCount * (config.interval - distanceFromLastWindow)) / config.interval
      + currentCount
    if (!this.isRateLimited(rate, config.limit)) {
      await this.incrementRequestCount(currentKey)
    }
    return rate
  }

  isRateLimited(rate: number, limit: number) {
    return rate >= limit
  }

  getHeaders(blocked: boolean, rate: number, config: Config) {
    let headers = {}
    if (!blocked) {
      return headers
    }
    const expires = this.expirySeconds(rate, config)
    const retryAfter = this.retryAfter(expires)
    headers = {
      'expires': retryAfter.toString(),
      'cache-control': `public, max-age=${expires}, s-maxage=${expires}, must-revalidate`
    }
    return headers
  }

  expirySeconds(rate: number, config: Config) {
    return Math.floor(((rate / config.limit) -1) * config.interval) || config.interval
  }

  retryAfter(expires: number) {
    return dayjs().add(expires, 'seconds').toString()
  }

  async fetch(request: Request): Promise<Response> {
    return this.app.fetch(request)
  }
}

export {
  RateLimiter
}
