export interface Bindings {
  ENV: string
  MYSQL_URL: string
  JWT_SECRET: string
  JWT_ACCESS_EXPIRATION_MINUTES: number
  JWT_REFRESH_EXPIRATION_DAYS: number
  JWT_RESET_PASSWORD_EXPIRATION_MINUTES: number
  JWT_VERIFY_EMAIL_EXPIRATION_MINUTES: number
}

declare global {
  function getMiniflareBindings(): Bindings
}
