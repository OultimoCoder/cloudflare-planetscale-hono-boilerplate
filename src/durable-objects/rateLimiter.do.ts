import dayjs from 'dayjs'
import { Context, Hono } from 'hono'
import httpStatus from 'http-status'
import { z, ZodError } from 'zod'
import { fromError } from 'zod-validation-error'
import { Environment } from '../../bindings'

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

export class RateLimiter {
  state: DurableObjectState
  env: Environment['Bindings']
  app: Hono = new Hono()

  constructor(state: DurableObjectState, env: Environment['Bindings']) {
    this.state = state
    this.env = env

    this.app.post('/', async (c) => {
      await this.setAlarm()
      let config
      try {
        config = await this.getConfig(c)
      } catch (err: unknown) {
        let errorMessage
        if (err instanceof ZodError) {
          errorMessage = fromError(err)
        }
        return c.json(
          {
            statusCode: httpStatus.BAD_REQUEST,
            error: errorMessage
          },
          httpStatus.BAD_REQUEST
        )
      }
      const rate = await this.calculateRate(config)
      const blocked = this.isRateLimited(rate, config.limit)
      const headers = this.getHeaders(blocked, config)
      const remaining = blocked ? 0 : Math.floor(config.limit - rate - 1)
      // If the remaining requests is negative set it to 0 to indicate 100% throughput
      const remainingHeader = remaining >= 0 ? remaining : 0
      return c.json(
        {
          blocked,
          remaining: remainingHeader,
          expires: headers.expires
        },
        httpStatus.OK,
        headers
      )
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
    const body = await c.req.json<Config>()
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
    const previousCount = (await this.getRequestCount(previousKey)) || 0
    const rate =
      (previousCount * (config.interval - distanceFromLastWindow)) / config.interval + currentCount
    if (!this.isRateLimited(rate, config.limit)) {
      await this.incrementRequestCount(currentKey)
    }
    return rate
  }

  isRateLimited(rate: number, limit: number) {
    return rate >= limit
  }

  getHeaders(blocked: boolean, config: Config) {
    const expires = this.expirySeconds(config)
    const retryAfter = this.retryAfter(expires)
    const headers: { expires: string; 'cache-control'?: string } = {
      expires: retryAfter.toString()
    }
    if (!blocked) {
      return headers
    }
    headers['cache-control'] = `public, max-age=${expires}, s-maxage=${expires}, must-revalidate`
    return headers
  }

  expirySeconds(config: Config) {
    const currentWindowStart = Math.floor(this.nowUnix() / config.interval)
    const currentWindowEnd = currentWindowStart + 1
    const secondsRemaining = currentWindowEnd * config.interval - this.nowUnix()
    return secondsRemaining
  }

  retryAfter(expires: number) {
    return dayjs().add(expires, 'seconds').toString()
  }

  async fetch(request: Request): Promise<Response> {
    return this.app.fetch(request)
  }
}
