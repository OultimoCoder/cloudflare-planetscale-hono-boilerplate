import { Selectable } from 'kysely'
import { OneTimeOauthCodeTable } from '../tables/one-time-oauth-code.table'
import { BaseModel } from './base.model'

export class OneTimeOauthCode extends BaseModel implements Selectable<OneTimeOauthCodeTable> {
  code: string
  user_id: string
  access_token: string
  access_token_expires_at: Date
  refresh_token: string
  refresh_token_expires_at: Date
  expires_at: Date
  created_at: Date
  updated_at: Date

  private_fields = ['created_at', 'updated_at']

  constructor(oneTimeCode: Selectable<OneTimeOauthCodeTable>) {
    super()
    this.code = oneTimeCode.code
    this.user_id = oneTimeCode.user_id
    this.access_token = oneTimeCode.access_token
    this.access_token_expires_at = oneTimeCode.access_token_expires_at
    this.refresh_token = oneTimeCode.refresh_token
    this.refresh_token_expires_at = oneTimeCode.refresh_token_expires_at
    this.expires_at = oneTimeCode.expires_at
    this.created_at = oneTimeCode.created_at
    this.updated_at = oneTimeCode.updated_at
  }
}
