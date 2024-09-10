import type { JwtPayload } from '@tsndr/cloudflare-worker-jwt'
import type { Toucan } from 'toucan-js'
import type { RateLimiter } from './src/durable-objects/rate-limiter.do'

type Environment = {
  Bindings: {
    ENV: string
    JWT_SECRET: string
    JWT_ACCESS_EXPIRATION_MINUTES: number
    JWT_REFRESH_EXPIRATION_DAYS: number
    JWT_RESET_PASSWORD_EXPIRATION_MINUTES: number
    JWT_VERIFY_EMAIL_EXPIRATION_MINUTES: number
    DATABASE_NAME: string
    DATABASE_USERNAME: string
    DATABASE_PASSWORD: string
    DATABASE_HOST: string
    RATE_LIMITER: DurableObjectNamespace<RateLimiter>
    SENTRY_DSN: string
    AWS_ACCESS_KEY_ID: string
    AWS_SECRET_ACCESS_KEY: string
    AWS_REGION: string
    EMAIL_SENDER: string
    OAUTH_WEB_REDIRECT_URL: string
    OAUTH_ANDROID_REDIRECT_URL: string
    OAUTH_IOS_REDIRECT_URL: string
    OAUTH_GITHUB_CLIENT_ID: string
    OAUTH_GITHUB_CLIENT_SECRET: string
    OAUTH_GOOGLE_CLIENT_ID: string
    OAUTH_GOOGLE_CLIENT_SECRET: string
    OAUTH_DISCORD_CLIENT_ID: string
    OAUTH_DISCORD_CLIENT_SECRET: string
    OAUTH_SPOTIFY_CLIENT_ID: string
    OAUTH_SPOTIFY_CLIENT_SECRET: string
    OAUTH_FACEBOOK_CLIENT_ID: string
    OAUTH_FACEBOOK_CLIENT_SECRET: string
    OAUTH_APPLE_CLIENT_ID: string
    OAUTH_APPLE_KEY_ID: string
    OAUTH_APPLE_TEAM_ID: string
    OAUTH_APPLE_JWT_ACCESS_EXPIRATION_MINUTES: number
    OAUTH_APPLE_PRIVATE_KEY: string
  }
  Variables: {
    payload: JwtPayload
    sentry: Toucan
  }
}
