import { AuthProviderType } from '../config/authProviders'

interface AuthProviderTable {
  provider_user_id: string
  provider_type: string
  user_id: number
}

interface OauthUser {
  id: number
  email: string
  name: string
  providerType: AuthProviderType
}

interface FacebookUser extends OauthUser{
  first_name: string
  last_name: string
}

export { AuthProviderTable, OauthUser, FacebookUser }
