import { AuthProviderType } from '../config/authProviders'

export interface AuthProviderTable {
  provider_user_id: string
  provider_type: string
  user_id: number
}

export interface OauthUser {
  id: number
  email: string
  name: string
  providerType: AuthProviderType
}

export interface FacebookUser extends OauthUser {
  first_name: string
  last_name: string
}
