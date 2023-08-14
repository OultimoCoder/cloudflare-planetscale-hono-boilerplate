import { AuthProviderType, OAuthUserType } from '../../types/oauth.types'
import { BaseModel } from '../base.model'

export interface AuthProviderTable {
  provider_user_id: string
  provider_type: string
  user_id: number
}

export class OAuthUserModel extends BaseModel implements OAuthUserType {
  _id: string
  _email: string
  _name?: string
  providerType: AuthProviderType

  private_fields = []

  constructor(user: OAuthUserType) {
    super()
    this._id = `${user._id}`
    this._email = user._email
    this._name = user._name || undefined
    this.providerType = user.providerType
  }
}
