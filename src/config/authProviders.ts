const authProviders = {
  GITHUB: 'github',
  SPOTIFY: 'spotify',
  DISCORD: 'discord',
  GOOGLE: 'google'
} as const

type AuthProviderType = typeof authProviders[keyof typeof authProviders]
export { authProviders, AuthProviderType }
