import { Generated } from 'kysely'

export interface OneTimeOauthCodeTable {
  code: string
  user_id: string
  access_token: string
  access_token_expires_at: Date
  refresh_token: string
  refresh_token_expires_at: Date
  expires_at: Date
  created_at: Generated<Date>
  updated_at: Generated<Date>
}
