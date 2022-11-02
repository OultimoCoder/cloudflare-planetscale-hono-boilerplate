import { z } from 'zod';
import { Bindings } from 'hono/dist/types';

const envVarsSchema = z.object({
  ENV: z.union([z.literal('production'), z.literal('development'), z.literal('test')]),
  // MYSQL DB url
  MYSQL_URL: z.string(),
  // JWT secret key
  JWT_SECRET: z.string(),
  // Minutes after which access tokens expire
  JWT_ACCESS_EXPIRATION_MINUTES: z.string().default('30').transform((str) => parseInt(str, 10)),
  // Days after which refresh tokens expire
  JWT_REFRESH_EXPIRATION_DAYS: z.string().default('30').transform((str) => parseInt(str, 10)),
  // Minutes after which reset password token expires
  JWT_RESET_PASSWORD_EXPIRATION_MINUTES: z
    .string()
    .default('10')
    .transform((str) => parseInt(str, 10)),
  // Minutes after which verify email token expires
  JWT_VERIFY_EMAIL_EXPIRATION_MINUTES: z
    .string()
    .default('10')
    .transform((str) => parseInt(str, 10)),
});

const env = {
  ENV,
  MYSQL_URL,
  JWT_SECRET,
  JWT_ACCESS_EXPIRATION_MINUTES,
  JWT_REFRESH_EXPIRATION_DAYS,
  JWT_RESET_PASSWORD_EXPIRATION_MINUTES,
  JWT_VERIFY_EMAIL_EXPIRATION_MINUTES
} as Bindings;

const envVars = envVarsSchema.parse(env);

export const config = {
  env: envVars.ENV,
  mysql: {
    url: envVars.MYSQL_URL + (envVars.ENV === 'development' ? '-development' : '')
  },
  jwt: {
    secret: envVars.JWT_SECRET,
    accessExpirationMinutes: envVars.JWT_ACCESS_EXPIRATION_MINUTES,
    refreshExpirationDays: envVars.JWT_REFRESH_EXPIRATION_DAYS,
    resetPasswordExpirationMinutes: envVars.JWT_RESET_PASSWORD_EXPIRATION_MINUTES,
    verifyEmailExpirationMinutes: envVars.JWT_VERIFY_EMAIL_EXPIRATION_MINUTES
  }
};
