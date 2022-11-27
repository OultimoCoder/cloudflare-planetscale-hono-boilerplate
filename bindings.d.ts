// declare global {
//   const ENV: string
//   const JWT_SECRET: string
//   const JWT_ACCESS_EXPIRATION_MINUTES: number
//   const JWT_REFRESH_EXPIRATION_DAYS: number
//   const JWT_RESET_PASSWORD_EXPIRATION_MINUTES: number
//   const JWT_VERIFY_EMAIL_EXPIRATION_MINUTES: number
//   const DATABASE_NAME: string
//   const DATABASE_USERNAME: string
//   const DATABASE_PASSWORD: string
//   const DATABASE_HOST: string
// }

interface Bindings {
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
  RATE_LIMITER: DurableObjectNamespace
}

// export {
//   Bindings
// }
