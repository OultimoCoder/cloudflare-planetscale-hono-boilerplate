import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

dotenv.config({ path: path.join(__dirname, '../../.env') });

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
  // Server that will send the emails
  SMTP_HOST: z.string(),
  // Port to connect to the email server
  SMTP_PORT: z.string().transform((str) => parseInt(str, 10)),
  // Username for email server
  SMTP_USERNAME: z.string(),
  // Password for email server
  SMTP_PASSWORD: z.string(),
  // The from field in the emails sent by the app
  EMAIL_FROM: z.string()
});

const envVars = envVarsSchema.parse(process.env);

export const config = {
  env: envVars.ENV,
  mysql: {
    url: envVars.MYSQL_URL + (envVars.ENV === 'test' ? '-test' : '')
  },
  jwt: {
    secret: envVars.JWT_SECRET,
    accessExpirationMinutes: envVars.JWT_ACCESS_EXPIRATION_MINUTES,
    refreshExpirationDays: envVars.JWT_REFRESH_EXPIRATION_DAYS,
    resetPasswordExpirationMinutes: envVars.JWT_RESET_PASSWORD_EXPIRATION_MINUTES,
    verifyEmailExpirationMinutes: envVars.JWT_VERIFY_EMAIL_EXPIRATION_MINUTES
  },
  email: {
    smtp: {
      host: envVars.SMTP_HOST,
      port: envVars.SMTP_PORT,
      auth: {
        user: envVars.SMTP_USERNAME,
        pass: envVars.SMTP_PASSWORD
      },
    },
    from: envVars.EMAIL_FROM
  },
};
