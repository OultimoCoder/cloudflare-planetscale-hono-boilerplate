import { AuthProviderType } from '../config/authProviders'

interface AuthProviderTable {
  provider_user_id: string
  provider_type: string
  user_id: string
}

interface OauthUser {
  id: number
  email: string
  name: string
  provider_type: AuthProviderType
}

export { AuthProviderTable, OauthUser }
