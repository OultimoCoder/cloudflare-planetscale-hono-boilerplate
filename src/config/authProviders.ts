export const authProviders = {
  GITHUB: 'github',
  SPOTIFY: 'spotify',
  DISCORD: 'discord',
  GOOGLE: 'google',
  FACEBOOK: 'facebook'
} as const

export type AuthProviderType = typeof authProviders[keyof typeof authProviders]
