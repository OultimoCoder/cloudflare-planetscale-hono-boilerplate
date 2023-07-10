import { z } from 'zod'
import { Environment } from '../../bindings'

const envVarsSchema = z.object({
  ENV: z.union([z.literal('production'), z.literal('development'), z.literal('test')]),
  // MYSQL Database name
  DATABASE_NAME: z.string(),
  // MYSQL Database username
  DATABASE_USERNAME: z.string(),
  // MYSQL Database password
  DATABASE_PASSWORD: z.string(),
  // MYSQL Database host
  DATABASE_HOST: z.string(),
  // JWT secret key
  JWT_SECRET: z.string(),
  // Minutes after which access tokens expire
  JWT_ACCESS_EXPIRATION_MINUTES: z
    .coerce
    .number()
    .default(30),
  // Days after which refresh tokens expire
  JWT_REFRESH_EXPIRATION_DAYS: z
    .coerce
    .number()
    .default(30),
  // Minutes after which reset password token expires
  JWT_RESET_PASSWORD_EXPIRATION_MINUTES: z
    .coerce
    .number()
    .default(10),
  // Minutes after which verify email token expires
  JWT_VERIFY_EMAIL_EXPIRATION_MINUTES: z
    .coerce
    .number()
    .default(10),
  AWS_ACCESS_KEY_ID: z.string(),
  AWS_SECRET_ACCESS_KEY: z.string(),
  AWS_REGION: z.string(),
  EMAIL_SENDER: z.string(),
  OAUTH_GITHUB_CLIENT_ID: z.string(),
  OAUTH_GITHUB_CLIENT_SECRET: z.string(),
  OAUTH_GOOGLE_CLIENT_ID: z.string(),
  OAUTH_GOOGLE_CLIENT_SECRET: z.string(),
  OAUTH_GOOGLE_REDIRECT_URL: z.string(),
  OAUTH_DISCORD_CLIENT_ID: z.string(),
  OAUTH_DISCORD_CLIENT_SECRET: z.string(),
  OAUTH_DISCORD_REDIRECT_URL: z.string(),
  OAUTH_SPOTIFY_CLIENT_ID: z.string(),
  OAUTH_SPOTIFY_CLIENT_SECRET: z.string(),
  OAUTH_SPOTIFY_REDIRECT_URL: z.string(),
  OAUTH_FACEBOOK_CLIENT_ID: z.string(),
  OAUTH_FACEBOOK_CLIENT_SECRET: z.string(),
  OAUTH_FACEBOOK_REDIRECT_URL: z.string()
})

export interface Config {
  env: 'production' | 'development' | 'test'
  database: {
    name: string
    username: string
    password: string
    host: string
  }
  jwt: {
    secret: string
    accessExpirationMinutes: number
    refreshExpirationDays: number
    resetPasswordExpirationMinutes: number
    verifyEmailExpirationMinutes: number
  }
  aws: {
    accessKeyId: string
    secretAccessKey: string
    region: string
  }
  email: {
    sender: string
  }
  oauth: {
    github: {
      clientId: string
      clientSecret: string
    }
    google: {
      clientId: string
      clientSecret: string
      redirectUrl: string
    }
    spotify: {
      clientId: string
      clientSecret: string
      redirectUrl: string
    }
    discord: {
      clientId: string
      clientSecret: string
      redirectUrl: string
    }
    facebook: {
      clientId: string
      clientSecret: string
      redirectUrl: string
    }
  }
}

let config: Config

export const getConfig = (env: Environment['Bindings']) => {
  if (config) {
    return config
  }
  const envVars = envVarsSchema.parse(env)
  config = {
    env: envVars.ENV,
    database: {
      name: envVars.DATABASE_NAME,
      username: envVars.DATABASE_USERNAME,
      password: envVars.DATABASE_PASSWORD,
      host: envVars.DATABASE_HOST
    },
    jwt: {
      secret: envVars.JWT_SECRET,
      accessExpirationMinutes: envVars.JWT_ACCESS_EXPIRATION_MINUTES,
      refreshExpirationDays: envVars.JWT_REFRESH_EXPIRATION_DAYS,
      resetPasswordExpirationMinutes: envVars.JWT_RESET_PASSWORD_EXPIRATION_MINUTES,
      verifyEmailExpirationMinutes: envVars.JWT_VERIFY_EMAIL_EXPIRATION_MINUTES
    },
    aws: {
      accessKeyId: envVars.AWS_ACCESS_KEY_ID,
      secretAccessKey: envVars.AWS_SECRET_ACCESS_KEY,
      region: envVars.AWS_REGION
    },
    email: {
      sender: envVars.EMAIL_SENDER
    },
    oauth: {
      github: {
        clientId: envVars.OAUTH_GITHUB_CLIENT_ID,
        clientSecret: envVars.OAUTH_GITHUB_CLIENT_SECRET
      },
      google: {
        clientId: envVars.OAUTH_GOOGLE_CLIENT_ID,
        clientSecret: envVars.OAUTH_GOOGLE_CLIENT_SECRET,
        redirectUrl: envVars.OAUTH_GOOGLE_REDIRECT_URL
      },
      spotify: {
        clientId: envVars.OAUTH_SPOTIFY_CLIENT_ID,
        clientSecret: envVars.OAUTH_SPOTIFY_CLIENT_SECRET,
        redirectUrl: envVars.OAUTH_SPOTIFY_REDIRECT_URL
      },
      discord: {
        clientId: envVars.OAUTH_DISCORD_CLIENT_ID,
        clientSecret: envVars.OAUTH_DISCORD_CLIENT_SECRET,
        redirectUrl: envVars.OAUTH_DISCORD_REDIRECT_URL
      },
      facebook: {
        clientId: envVars.OAUTH_FACEBOOK_CLIENT_ID,
        clientSecret: envVars.OAUTH_FACEBOOK_CLIENT_SECRET,
        redirectUrl: envVars.OAUTH_FACEBOOK_REDIRECT_URL
      }
    }
  }
  return config
}
