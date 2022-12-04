interface AuthProviderTable {
  provider_user_id: string
  provider_type: string
  user_id: string
}

interface GithubUser {
  id: number
  email: string
  name: string
}

export { AuthProviderTable, GithubUser }
