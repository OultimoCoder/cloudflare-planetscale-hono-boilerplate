import httpStatus from 'http-status'
import { ZodError, z } from 'zod'
import { Environment } from '../../bindings'
import { ApiError } from '../utils/api-error'
import { generateZodErrorMessage } from '../utils/zod'

const envVarsSchema = z.object({
  ENV: z.union([z.literal('production'), z.literal('development'), z.literal('test')]),
  DATABASE_NAME: z.string(),
  DATABASE_USERNAME: z.string(),
  DATABASE_PASSWORD: z.string(),
  DATABASE_HOST: z.string(),
  JWT_SECRET: z.string(),
  JWT_ACCESS_EXPIRATION_MINUTES: z.coerce.number().default(30),
  JWT_REFRESH_EXPIRATION_DAYS: z.coerce.number().default(30),
  JWT_RESET_PASSWORD_EXPIRATION_MINUTES: z.coerce.number().default(10),
  JWT_VERIFY_EMAIL_EXPIRATION_MINUTES: z.coerce.number().default(10),
  AWS_ACCESS_KEY_ID: z.string(),
  AWS_SECRET_ACCESS_KEY: z.string(),
  AWS_REGION: z.string(),
  EMAIL_SENDER: z.string(),
  OAUTH_WEB_REDIRECT_URL: z.string(),
  OAUTH_ANDROID_REDIRECT_URL: z.string(),
  OAUTH_IOS_REDIRECT_URL: z.string(),
  OAUTH_GITHUB_CLIENT_ID: z.string(),
  OAUTH_GITHUB_CLIENT_SECRET: z.string(),
  OAUTH_GOOGLE_CLIENT_ID: z.string(),
  OAUTH_GOOGLE_CLIENT_SECRET: z.string(),
  OAUTH_DISCORD_CLIENT_ID: z.string(),
  OAUTH_DISCORD_CLIENT_SECRET: z.string(),
  OAUTH_SPOTIFY_CLIENT_ID: z.string(),
  OAUTH_SPOTIFY_CLIENT_SECRET: z.string(),
  OAUTH_FACEBOOK_CLIENT_ID: z.string(),
  OAUTH_FACEBOOK_CLIENT_SECRET: z.string(),
  OAUTH_APPLE_CLIENT_ID: z.string(),
  OAUTH_APPLE_PRIVATE_KEY: z.string(),
  OAUTH_APPLE_KEY_ID: z.string(),
  OAUTH_APPLE_TEAM_ID: z.string(),
  OAUTH_APPLE_JWT_ACCESS_EXPIRATION_MINUTES: z.coerce.number().default(30),
  OAUTH_APPLE_REDIRECT_URL: z.string()
})

export type EnvVarsSchemaType = z.infer<typeof envVarsSchema>

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
    platform: {
      web: {
        redirectUrl: string
      }
      android: {
        redirectUrl: string
      }
      ios: {
        redirectUrl: string
      }
    }
    provider: {
      github: {
        clientId: string
        clientSecret: string
      }
      google: {
        clientId: string
        clientSecret: string
      }
      spotify: {
        clientId: string
        clientSecret: string
      }
      discord: {
        clientId: string
        clientSecret: string
      }
      facebook: {
        clientId: string
        clientSecret: string
      }
      apple: {
        clientId: string
        privateKey: string
        keyId: string
        teamId: string
        jwtAccessExpirationMinutes: number
        redirectUrl: string
      }
    }
  }
}

let config: Config

export const getConfig = (env: Environment['Bindings']) => {
  if (config) {
    return config
  }
  let envVars: EnvVarsSchemaType
  try {
    envVars = envVarsSchema.parse(env)
  } catch (err) {
    if (env.ENV && env.ENV === 'production') {
      throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Invalid server configuration')
    }
    if (err instanceof ZodError) {
      const errorMessage = generateZodErrorMessage(err)
      throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, errorMessage)
    }
    throw err
  }
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
      platform: {
        web: {
          redirectUrl: envVars.OAUTH_WEB_REDIRECT_URL
        },
        android: {
          redirectUrl: envVars.OAUTH_ANDROID_REDIRECT_URL
        },
        ios: {
          redirectUrl: envVars.OAUTH_IOS_REDIRECT_URL
        }
      },
      provider: {
        github: {
          clientId: envVars.OAUTH_GITHUB_CLIENT_ID,
          clientSecret: envVars.OAUTH_GITHUB_CLIENT_SECRET
        },
        google: {
          clientId: envVars.OAUTH_GOOGLE_CLIENT_ID,
          clientSecret: envVars.OAUTH_GOOGLE_CLIENT_SECRET
        },
        spotify: {
          clientId: envVars.OAUTH_SPOTIFY_CLIENT_ID,
          clientSecret: envVars.OAUTH_SPOTIFY_CLIENT_SECRET
        },
        discord: {
          clientId: envVars.OAUTH_DISCORD_CLIENT_ID,
          clientSecret: envVars.OAUTH_DISCORD_CLIENT_SECRET
        },
        facebook: {
          clientId: envVars.OAUTH_FACEBOOK_CLIENT_ID,
          clientSecret: envVars.OAUTH_FACEBOOK_CLIENT_SECRET
        },
        apple: {
          clientId: envVars.OAUTH_APPLE_CLIENT_ID,
          privateKey: envVars.OAUTH_APPLE_PRIVATE_KEY,
          keyId: envVars.OAUTH_APPLE_KEY_ID,
          teamId: envVars.OAUTH_APPLE_TEAM_ID,
          jwtAccessExpirationMinutes: envVars.OAUTH_APPLE_JWT_ACCESS_EXPIRATION_MINUTES,
          redirectUrl: envVars.OAUTH_APPLE_REDIRECT_URL
        }
      }
    }
  }
  return config
}
