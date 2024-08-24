import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config'

export default defineWorkersConfig({
  test: {
    poolOptions: {
      workers: {
        wrangler: { configPath: 'wrangler.toml' },
        isolatedStorage: true,
        singleWorker: true
      }
    }
  }
})
