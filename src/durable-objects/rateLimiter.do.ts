import dayjs from 'dayjs'
import httpStatus  from 'http-status'

class RateLimiter {
  state: DurableObjectState
  env: Bindings

  constructor(state: DurableObjectState, env: Bindings) {
      this.state = state
      this.env = env
  }

  async alarm() {
    const values = await this.state.storage.list();
    for await (const [key, _value] of values) {
      const [_scope, _key, _limit, interval, timestamp] = key.split('|');
      const now = dayjs().unix()
      const currentWindow = Math.floor(now / parseInt(interval))
      const timestampLessThan = currentWindow - (parseInt(interval) * 2)
      console.log(timestampLessThan > parseInt(timestamp))
      if (parseInt(timestamp) < timestampLessThan) {
        await this.state.storage.delete(key);
      }
    }
  }

  async setAlarm() {
    const alarm = await this.state.storage.getAlarm();
    if (!alarm) {
      this.state.storage.setAlarm(dayjs().add(6, 'hours').toDate());
    }
  }

  async getConfig(request: Request) {
    return request.clone().json();
  }

  getKeyPrefix(config) {
    return `${config.scope}|${config.key}|${config.limit}|${config.interval}`
  }

  async incrementRequestCount(key: string) {
    const currentRequestCount = await this.getRequestCount(key)
    await this.state.storage.put(key, currentRequestCount + 1);
  }

  async getRequestCount(key: string): Promise<number> {
    return parseInt((await this.state.storage.get(key)) as string) || 0
  }

  async fetch(request: Request): Promise<Response> {
    await this.setAlarm()
    const config = await this.getConfig(request)
    const keyPrefix = this.getKeyPrefix(config)
    const unixTimestamp = dayjs().unix()
    const currentWindow = Math.floor(unixTimestamp / config.interval);
    const distanceFromLastWindow = unixTimestamp % config.interval;
    const currentKey = `${keyPrefix}|${currentWindow}`;
    const previousKey = `${keyPrefix}|${currentWindow - 1}`;

    const currentCount = await this.getRequestCount(currentKey)
    const previousCount = await this.getRequestCount(previousKey) || config.limit

    const rate = (previousCount * (config.interval - distanceFromLastWindow)) / config.interval + currentCount;
    const blocked = rate >= config.limit

    const headers: Headers = new Headers();
    headers.set('Content-Type', 'application/json');

    if (!blocked) {
      await this.incrementRequestCount(currentKey);
      return new Response(JSON.stringify({ blocked }), { status: httpStatus.OK, headers });
    }
    const expires = Math.floor(((rate / config.limit) -1) * config.interval) || config.interval
    const retryAfter = dayjs().add(expires, 'seconds')
    headers.set('Expires', retryAfter.toString());
    headers.set('Cache-Control', `public, max-age=${expires}, s-maxage=${expires}, must-revalidate`)
    return new Response(JSON.stringify({ blocked }), { status: httpStatus.OK, headers });
  }
}

export {
  RateLimiter
}
